"""Voice endpoints — REST transcribe + WebSocket streaming."""

import asyncio
import base64
import logging

from fastapi import APIRouter, Depends, File, Form, UploadFile, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db import async_session, get_db
from backend.models.recipe import Recipe
from backend.models.session import CookingSession
from backend.modules.conversation.context import (
    add_message,
    get_conversation_history,
    get_or_create_session,
)
from backend.modules.conversation.engine import chat, _clean_think_tags
from backend.modules.voice.language import get_tts_config
from backend.modules.voice.stt import transcribe
from backend.modules.voice.tts import synthesize

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.get("/voices")
async def list_voices():
    """List available TTS voices."""
    from backend.modules.voice.language import AVAILABLE_VOICES
    return AVAILABLE_VOICES


@router.post("/transcribe")
async def voice_transcribe(
    file: UploadFile = File(...),
    session_id: int = Form(...),
    language: str = Form("hi"),
    db: AsyncSession = Depends(get_db),
):
    """Accept audio file, transcribe, get LLM response, return all."""
    audio_bytes = await file.read()
    if not audio_bytes:
        return {"error": "Empty audio file"}

    # Normalize language for STT
    stt_language = language
    if stt_language and "-" not in stt_language:
        stt_language = f"{stt_language}-IN"

    # 1. Speech-to-text
    try:
        stt_result = await asyncio.to_thread(
            _rest_transcribe, audio_bytes, stt_language, file.filename or "audio.webm"
        )
        transcript = stt_result["transcript"]
        detected_language = stt_result.get("language_code", stt_language)
    except Exception as e:
        logger.exception("STT failed")
        return {"error": f"Speech recognition failed: {str(e)}", "transcript": "", "reply": ""}

    # 2. Load recipe + conversation context
    result = await db.execute(
        select(CookingSession).where(CookingSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    recipe_data = None
    if session and session.recipe_id:
        recipe_data = await _load_recipe_data(db, session.recipe_id)

    history = await get_conversation_history(db, session_id)
    await add_message(db, session_id, "user", transcript)

    # 3. LLM response
    try:
        from backend.modules.conversation.engine import get_client as get_llm_client
        from backend.modules.conversation.prompts import SYSTEM_PROMPT, build_recipe_context
        from backend.config import settings

        reply = await asyncio.to_thread(
            _rest_chat, transcript, history, recipe_data, language
        )
    except Exception as e:
        logger.exception("LLM failed")
        reply = "Sorry, I couldn't process that. Please try again."

    await add_message(db, session_id, "assistant", reply)
    await db.commit()

    return {
        "transcript": transcript,
        "language": detected_language,
        "reply": reply,
    }


def _rest_transcribe(audio_bytes: bytes, language_code: str, filename: str) -> dict:
    """Synchronous STT call for REST endpoint."""
    import io
    from backend.modules.voice.stt import get_client
    from backend.config import settings

    client = get_client()
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename

    response = client.speech_to_text.transcribe(
        file=audio_file,
        model=settings.SARVAM_STT_MODEL,
        mode="transcribe",
        language_code=language_code,
    )
    return {
        "transcript": response.transcript,
        "language_code": response.language_code,
    }


def _rest_chat(user_message: str, history: list[dict], recipe_data: dict | None, language: str) -> str:
    """Synchronous LLM call for REST endpoint."""
    from backend.modules.conversation.engine import get_client
    from backend.modules.conversation.prompts import SYSTEM_PROMPT, build_recipe_context
    from backend.config import settings

    client = get_client()
    system_content = SYSTEM_PROMPT
    if recipe_data:
        system_content += f"\n\n{build_recipe_context(recipe_data)}"
    if language and language != "en":
        system_content += f"\n\nIMPORTANT: The user prefers Hindi/Hinglish. Always respond in Hinglish (Hindi written in Roman script mixed with English cooking terms). Language code: {language}."

    messages = [{"role": "system", "content": system_content}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions(model=settings.SARVAM_LLM_MODEL, messages=messages)
    return _clean_think_tags(response.choices[0].message.content)


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

            # Handle disconnect
            if message.get("type") == "websocket.disconnect":
                break

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
        system_content += f"\n\nIMPORTANT: The user prefers Hindi/Hinglish. Always respond in Hinglish (Hindi written in Roman script mixed with English cooking terms). Language code: {language}."

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
