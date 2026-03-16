"""Language detection and TTS voice routing."""

# Default speaker per language — using female voices for the "mom-like" persona
LANGUAGE_CONFIG = {
    "hi-IN": {"tts_code": "hi-IN", "speaker": "ritu"},
    "en-IN": {"tts_code": "en-IN", "speaker": "ritu"},
    "ta-IN": {"tts_code": "ta-IN", "speaker": "ritu"},
    "te-IN": {"tts_code": "te-IN", "speaker": "ritu"},
    "bn-IN": {"tts_code": "bn-IN", "speaker": "ritu"},
    "mr-IN": {"tts_code": "mr-IN", "speaker": "ritu"},
    "gu-IN": {"tts_code": "gu-IN", "speaker": "ritu"},
    "kn-IN": {"tts_code": "kn-IN", "speaker": "ritu"},
    "ml-IN": {"tts_code": "ml-IN", "speaker": "ritu"},
    "pa-IN": {"tts_code": "pa-IN", "speaker": "ritu"},
    "or-IN": {"tts_code": "or-IN", "speaker": "ritu"},
}

# Available voices for user selection
AVAILABLE_VOICES = [
    {"id": "ritu", "name": "Ritu", "gender": "female"},
    {"id": "priya", "name": "Priya", "gender": "female"},
    {"id": "kavya", "name": "Kavya", "gender": "female"},
    {"id": "shreya", "name": "Shreya", "gender": "female"},
    {"id": "neha", "name": "Neha", "gender": "female"},
    {"id": "shubh", "name": "Shubh", "gender": "male"},
    {"id": "aditya", "name": "Aditya", "gender": "male"},
    {"id": "rahul", "name": "Rahul", "gender": "male"},
    {"id": "rohan", "name": "Rohan", "gender": "male"},
    {"id": "amit", "name": "Amit", "gender": "male"},
]

DEFAULT_LANGUAGE = "hi-IN"
DEFAULT_PACE = 0.9


def get_tts_config(language_code: str | None, speaker: str | None = None) -> dict:
    """Get TTS configuration for a detected language.

    Returns dict with tts_code, speaker, and pace.
    """
    if not language_code:
        language_code = DEFAULT_LANGUAGE

    # Normalize: "hi" -> "hi-IN"
    if "-" not in language_code:
        language_code = f"{language_code}-IN"

    config = LANGUAGE_CONFIG.get(language_code, LANGUAGE_CONFIG[DEFAULT_LANGUAGE])

    return {
        "tts_code": config["tts_code"],
        "speaker": speaker or config["speaker"],
        "pace": DEFAULT_PACE,
    }
