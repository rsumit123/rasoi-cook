"""Text-to-speech using Sarvam AI Bulbul v3."""

import base64

from sarvamai import SarvamAI

from backend.config import settings


def get_client() -> SarvamAI:
    return SarvamAI(api_subscription_key=settings.SARVAM_API_KEY)


async def synthesize(
    text: str,
    language_code: str = "en-IN",
    speaker: str | None = None,
    pace: float = 1.0,
) -> bytes:
    """Convert text to speech audio using Sarvam TTS.

    Args:
        text: Text to convert (max 2500 chars).
        language_code: BCP-47 language code (e.g. "hi-IN", "en-IN").
        speaker: Voice name (e.g. "shubh", "ritu"). Defaults to config setting.
        pace: Speech speed multiplier.

    Returns:
        WAV audio bytes.
    """
    client = get_client()

    response = client.text_to_speech.convert(
        text=text,
        model=settings.SARVAM_TTS_MODEL,
        target_language_code=language_code,
        speaker=speaker or settings.SARVAM_TTS_SPEAKER,
        pace=pace,
        speech_sample_rate=24000,
    )

    combined_audio = "".join(response.audios)
    return base64.b64decode(combined_audio)
