"""Session state and conversation context management."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.session import CookingSession, Message


async def get_or_create_session(
    db: AsyncSession,
    session_id: int | None = None,
    recipe_id: int | None = None,
    language: str = "en",
) -> CookingSession:
    """Get an existing session or create a new one."""
    if session_id:
        result = await db.execute(
            select(CookingSession).where(CookingSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session:
            return session

    session = CookingSession(recipe_id=recipe_id, language=language)
    db.add(session)
    await db.flush()
    return session


async def add_message(
    db: AsyncSession, session_id: int, role: str, content: str
) -> Message:
    """Add a message to a cooking session."""
    message = Message(session_id=session_id, role=role, content=content)
    db.add(message)
    await db.flush()
    return message


async def get_conversation_history(
    db: AsyncSession, session_id: int, limit: int = 20
) -> list[dict]:
    """Get recent conversation history as a list of role/content dicts."""
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.timestamp.desc())
        .limit(limit)
    )
    messages = list(reversed(result.scalars().all()))
    return [{"role": m.role, "content": m.content} for m in messages]
