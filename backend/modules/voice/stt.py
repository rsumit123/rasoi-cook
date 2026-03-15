"""Speech-to-text using Sarvam AI Saaras v3."""

import io

from sarvamai import SarvamAI

from backend.config import settings


def get_client() -> SarvamAI:
    return SarvamAI(api_subscription_key=settings.SARVAM_API_KEY)


async def transcribe(audio_bytes: bytes, language_code: str | None = None) -> dict:
    """Transcribe audio bytes to text using Sarvam STT.

    Args:
        audio_bytes: Raw audio file bytes (WAV, MP3, etc.)
        language_code: Optional BCP-47 language code (e.g. "hi-IN").
                       If None, Sarvam auto-detects the language.

    Returns:
        dict with keys: transcript, language_code
    """
    client = get_client()

    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "audio.wav"

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
