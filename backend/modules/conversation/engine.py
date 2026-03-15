"""LLM conversation engine using Sarvam AI."""

import re

from sarvamai import SarvamAI

from backend.config import settings
from backend.modules.conversation.prompts import SYSTEM_PROMPT, build_recipe_context


def get_client() -> SarvamAI:
    return SarvamAI(api_subscription_key=settings.SARVAM_API_KEY)


async def chat(
    user_message: str,
    conversation_history: list[dict],
    recipe_data: dict | None = None,
    language: str = "en",
) -> str:
    """Generate a cooking assistant response using Sarvam LLM.

    Args:
        user_message: The user's current message.
        conversation_history: List of prior messages [{"role": "user"|"assistant", "content": "..."}].
        recipe_data: Optional recipe dict to inject as context.
        language: Language code for response preference.

    Returns:
        The assistant's response text.
    """
    client = get_client()

    # Build system prompt with recipe context
    system_content = SYSTEM_PROMPT
    if recipe_data:
        recipe_context = build_recipe_context(recipe_data)
        system_content += f"\n\n{recipe_context}"

    if language and language != "en":
        system_content += f"\n\nThe user prefers communicating in language code: {language}. Respond in that language when appropriate."

    # Build messages array
    messages = [{"role": "system", "content": system_content}]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions(
        model=settings.SARVAM_LLM_MODEL,
        messages=messages,
    )

    content = response.choices[0].message.content
    return _clean_think_tags(content)


def _clean_think_tags(content: str) -> str:
    """Strip reasoning <think> tags from Sarvam model output."""
    if "</think>" in content:
        # Closed think block — take everything after it
        after = content.split("</think>", 1)[1].strip()
        if after:
            return after
    # Strip any remaining <think> / </think> tags
    return re.sub(r"</?think>", "", content).strip()
