"""Language detection and TTS voice routing."""

# Mapping from BCP-47 language codes to TTS language codes and default speakers
LANGUAGE_CONFIG = {
    "hi-IN": {"tts_code": "hi-IN", "speaker": "shubh"},
    "en-IN": {"tts_code": "en-IN", "speaker": "shubh"},
    "ta-IN": {"tts_code": "ta-IN", "speaker": "shubh"},
    "te-IN": {"tts_code": "te-IN", "speaker": "shubh"},
    "bn-IN": {"tts_code": "bn-IN", "speaker": "shubh"},
    "mr-IN": {"tts_code": "mr-IN", "speaker": "shubh"},
    "gu-IN": {"tts_code": "gu-IN", "speaker": "shubh"},
    "kn-IN": {"tts_code": "kn-IN", "speaker": "shubh"},
    "ml-IN": {"tts_code": "ml-IN", "speaker": "shubh"},
    "pa-IN": {"tts_code": "pa-IN", "speaker": "shubh"},
    "or-IN": {"tts_code": "or-IN", "speaker": "shubh"},
}

DEFAULT_LANGUAGE = "en-IN"


def get_tts_config(language_code: str | None) -> dict:
    """Get TTS configuration for a detected language.

    Returns dict with tts_code and speaker.
    """
    if not language_code:
        return LANGUAGE_CONFIG[DEFAULT_LANGUAGE]

    # Normalize: "hi" -> "hi-IN"
    if "-" not in language_code:
        language_code = f"{language_code}-IN"

    return LANGUAGE_CONFIG.get(language_code, LANGUAGE_CONFIG[DEFAULT_LANGUAGE])
