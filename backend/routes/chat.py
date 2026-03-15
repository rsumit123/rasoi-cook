"""Chat and session endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from backend.db import get_db
from backend.models.recipe import Recipe
from backend.models.session import CookingSession
from backend.modules.conversation.context import (
    add_message,
    get_conversation_history,
    get_or_create_session,
)
from backend.modules.conversation.engine import chat
from backend.modules.recipes.schemas import (
    ChatRequest,
    ChatResponse,
    SessionCreate,
    SessionResponse,
)

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/sessions", response_model=SessionResponse)
async def create_session(body: SessionCreate, db: AsyncSession = Depends(get_db)):
    session = await get_or_create_session(
        db, recipe_id=body.recipe_id, language=body.language
    )
    await db.commit()
    return session


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CookingSession).where(CookingSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    # Get session
    result = await db.execute(
        select(CookingSession).where(CookingSession.id == body.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Load recipe data if session has a recipe
    recipe_data = None
    if session.recipe_id:
        recipe_result = await db.execute(
            select(Recipe)
            .where(Recipe.id == session.recipe_id)
            .options(selectinload(Recipe.ingredients), selectinload(Recipe.steps))
        )
        recipe = recipe_result.scalar_one_or_none()
        if recipe:
            recipe_data = {
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

    # Get conversation history
    history = await get_conversation_history(db, session.id)

    # Save user message
    await add_message(db, session.id, "user", body.message)

    # Get LLM response
    reply = await chat(
        user_message=body.message,
        conversation_history=history,
        recipe_data=recipe_data,
        language=body.language,
    )

    # Save assistant message
    await add_message(db, session.id, "assistant", reply)
    await db.commit()

    return ChatResponse(reply=reply, recipe_context=recipe_data)
