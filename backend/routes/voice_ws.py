"""WebSocket endpoint for voice streaming."""

import asyncio
import base64
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.db import async_session
from backend.models.recipe import Recipe
from backend.models.session import CookingSession
from backend.modules.conversation.context import (
    add_message,
    get_conversation_history,
    get_or_create_session,
)
from backend.modules.conversation.engine import chat
from backend.modules.voice.language import get_tts_config
from backend.modules.voice.stt import transcribe
from backend.modules.voice.tts import synthesize

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])


async def _load_recipe_data(db, recipe_id: int) -> dict | None:
    """Load recipe data from DB, mirroring the pattern in chat.py."""
    recipe_result = await db.execute(
        select(Recipe)
        .where(Recipe.id == recipe_id)
        .options(selectinload(Recipe.ingredients), selectinload(Recipe.steps))
    )
    recipe = recipe_result.scalar_one_or_none()
    if not recipe:
        return None

    return {
        "name": recipe.name,
        "name_hi": recipe.name_hi,
        "region": recipe.region,
        "difficulty": recipe.difficulty,
        "prep_time": recipe.prep_time,
        "cook_time": recipe.cook_time,
        "ingredients": [
            {
                "name": i.name,
                "name_hi": i.name_hi,
                "quantity": i.quantity,
                "unit": i.unit,
                "is_optional": i.is_optional,
            }
            for i in recipe.ingredients
        ],
        "steps": [
            {
                "step_number": s.step_number,
                "instruction": s.instruction,
                "instruction_hi": s.instruction_hi,
                "duration_mins": s.duration_mins,
                "tips": s.tips,
            }
            for s in recipe.steps
        ],
    }


@router.websocket("/stream")
async def voice_stream(websocket: WebSocket):
    await websocket.accept()

    session_id: int | None = None
    recipe_data: dict | None = None
    language: str = "en"

    try:
        while True:
            message = await websocket.receive()

            # Handle JSON text messages (session_start)
            if "text" in message:
                import json

                data = json.loads(message["text"])

                if data.get("type") == "session_start":
                    recipe_id = data.get("recipe_id")
                    language = data.get("language", "en")

                    async with async_session() as db:
                        # Create a cooking session
                        session = await get_or_create_session(
                            db, recipe_id=recipe_id, language=language
                        )
                        await db.commit()
                        session_id = session.id

                        # Load recipe data
                        if recipe_id:
                            recipe_data = await _load_recipe_data(db, recipe_id)

                    await websocket.send_json(
                        {"type": "session_ready", "session_id": session_id}
                    )

            # Handle binary frames (audio data)
            elif "bytes" in message:
                audio_bytes = message["bytes"]

                if session_id is None:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "Session not initialized. Send session_start first.",
                        }
                    )
                    continue

                try:
                    # Normalize language code for STT
                    stt_language = language
                    if stt_language and "-" not in stt_language:
                        stt_language = f"{stt_language}-IN"

                    # 1. Speech-to-text (SDK is synchronous, run in thread)
                    stt_result = await asyncio.to_thread(
                        _sync_transcribe, audio_bytes, stt_language
                    )
                    transcript = stt_result["transcript"]
                    detected_language = stt_result.get("language_code", stt_language)

                    # Send transcript to client
                    await websocket.send_json(
                        {
                            "type": "transcript",
                            "text": transcript,
                            "language": detected_language,
                        }
                    )

                    # 2. Get conversation response
                    async with async_session() as db:
                        history = await get_conversation_history(db, session_id)
                        await add_message(db, session_id, "user", transcript)

                        reply = await asyncio.to_thread(
                            _sync_chat,
                            transcript,
                            history,
                            recipe_data,
                            language,
                        )

                        await add_message(db, session_id, "assistant", reply)
                        await db.commit()

                    # 3. Text-to-speech (SDK is synchronous, run in thread)
                    tts_config = get_tts_config(detected_language)
                    audio_wav = await asyncio.to_thread(
                        _sync_synthesize,
                        reply,
                        tts_config["tts_code"],
                        tts_config["speaker"],
                    )
                    audio_b64 = base64.b64encode(audio_wav).decode("utf-8")

                    # Send response with audio
                    await websocket.send_json(
                        {
                            "type": "response",
                            "text": reply,
                            "audio": audio_b64,
                        }
                    )

                except Exception as e:
                    logger.exception("Error processing voice message")
                    await websocket.send_json(
                        {"type": "error", "message": f"Processing error: {str(e)}"}
                    )

    except WebSocketDisconnect:
        logger.info("Voice WebSocket disconnected (session=%s)", session_id)
    except Exception as e:
        logger.exception("Voice WebSocket error")
        try:
            await websocket.send_json(
                {"type": "error", "message": f"Server error: {str(e)}"}
            )
        except Exception:
            pass


def _sync_transcribe(audio_bytes: bytes, language_code: str) -> dict:
    """Synchronous wrapper for STT since the SDK is sync under the hood."""
    from backend.modules.voice.stt import get_client
    import io

    from backend.config import settings

    client = get_client()
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "audio.webm"

    kwargs: dict = {
        "file": audio_file,
        "model": settings.SARVAM_STT_MODEL,
        "mode": "transcribe",
    }
    if language_code:
        kwargs["language_code"] = language_code

    response = client.speech_to_text.transcribe(**kwargs)
    return {
        "transcript": response.transcript,
        "language_code": response.language_code,
    }


def _sync_chat(
    user_message: str,
    conversation_history: list[dict],
    recipe_data: dict | None,
    language: str,
) -> str:
    """Synchronous wrapper for chat engine."""
    from backend.modules.conversation.engine import get_client
    from backend.modules.conversation.prompts import SYSTEM_PROMPT, build_recipe_context
    from backend.config import settings

    client = get_client()

    system_content = SYSTEM_PROMPT
    if recipe_data:
        recipe_context = build_recipe_context(recipe_data)
        system_content += f"\n\n{recipe_context}"

    if language and language != "en":
        system_content += f"\n\nThe user prefers communicating in language code: {language}. Respond in that language when appropriate."

    messages = [{"role": "system", "content": system_content}]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions(
        model=settings.SARVAM_LLM_MODEL,
        messages=messages,
    )
    from backend.modules.conversation.engine import _clean_think_tags
    content = response.choices[0].message.content
    return _clean_think_tags(content)


def _sync_synthesize(text: str, language_code: str, speaker: str) -> bytes:
    """Synchronous wrapper for TTS."""
    from backend.modules.voice.tts import get_client
    from backend.config import settings

    client = get_client()

    response = client.text_to_speech.convert(
        text=text,
        model=settings.SARVAM_TTS_MODEL,
        target_language_code=language_code,
        speaker=speaker,
        pace=1.0,
        speech_sample_rate=24000,
    )

    combined_audio = "".join(response.audios)
    return base64.b64decode(combined_audio)
