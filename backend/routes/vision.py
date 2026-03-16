# Image upload, identification, and visual Q&A endpoints

import asyncio

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db import get_db
from backend.models.recipe import Ingredient, Recipe
from backend.models.session import CookingSession
from backend.modules.conversation.context import add_message, get_conversation_history
from backend.modules.conversation.engine import _clean_think_tags
from backend.modules.vision.identify import identify_ingredient
from backend.modules.vision.processor import process_image

router = APIRouter(prefix="/api/vision", tags=["vision"])


@router.post("/identify")
async def identify(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Accept an image, identify the ingredient, and find matching recipes."""
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    # Preprocess image
    processed = process_image(raw_bytes)

    # Identify ingredient via Google Vision
    result = identify_ingredient(processed)
    # identify_ingredient is async
    result = await result

    if result.get("error"):
        return {
            "ingredient": None,
            "ingredient_hi": None,
            "confidence": 0.0,
            "matching_recipes": [],
            "error": result["error"],
        }

    ingredient_name = result.get("ingredient")
    matching_recipes: list[dict] = []

    if ingredient_name:
        # Search recipes that have this ingredient (case-insensitive partial match)
        stmt = (
            select(Recipe.id, Recipe.name)
            .join(Ingredient, Recipe.id == Ingredient.recipe_id)
            .where(Ingredient.name.ilike(f"%{ingredient_name}%"))
            .distinct()
        )
        rows = await db.execute(stmt)
        matching_recipes = [{"id": r.id, "name": r.name} for r in rows.all()]

    return {
        "ingredient": ingredient_name,
        "ingredient_hi": result.get("ingredient_hi"),
        "confidence": result.get("confidence", 0.0),
        "matching_recipes": matching_recipes,
    }


@router.post("/ask")
async def visual_ask(
    file: UploadFile = File(...),
    question: str = Form(...),
    session_id: int = Form(...),
    language: str = Form("hi"),
    db: AsyncSession = Depends(get_db),
):
    """Accept a photo + question, identify what's in the photo, and ask the LLM."""
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    # 1. Identify what's in the image
    processed = process_image(raw_bytes)
    vision_result = await identify_ingredient(processed)

    # Build a description of what Vision saw
    if vision_result.get("error"):
        image_description = "I couldn't analyze the image clearly."
    else:
        labels = vision_result.get("all_labels", [])
        label_names = [l["description"] for l in labels[:5]]
        ingredient = vision_result.get("ingredient", "")
        hindi = vision_result.get("ingredient_hi", "")
        if ingredient:
            image_description = f"The image shows: {ingredient}"
            if hindi:
                image_description += f" ({hindi})"
            image_description += f". Other detected labels: {', '.join(label_names)}."
        else:
            image_description = f"Detected in the image: {', '.join(label_names)}."

    # 2. Load recipe context
    result = await db.execute(
        select(CookingSession).where(CookingSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    recipe_data = None
    if session and session.recipe_id:
        recipe_result = await db.execute(
            select(Recipe)
            .where(Recipe.id == session.recipe_id)
            .options(selectinload(Recipe.ingredients), selectinload(Recipe.steps))
        )
        recipe = recipe_result.scalar_one_or_none()
        if recipe:
            from backend.routes.voice_ws import _load_recipe_data
            recipe_data = await _load_recipe_data(db, session.recipe_id)

    # 3. Build LLM prompt with image context + user question
    history = await get_conversation_history(db, session_id)

    combined_message = f"[The user sent a photo. {image_description}]\n\nUser's question about the photo: {question}"

    await add_message(db, session_id, "user", f"[Photo] {question}")

    # 4. Get LLM response
    from backend.modules.conversation.engine import get_client
    from backend.modules.conversation.prompts import SYSTEM_PROMPT, build_recipe_context
    from backend.config import settings

    def _call_llm():
        client = get_client()
        system_content = SYSTEM_PROMPT
        if recipe_data:
            system_content += f"\n\n{build_recipe_context(recipe_data)}"
        if language and language != "en":
            system_content += f"\n\nIMPORTANT: Respond in Hinglish. Language code: {language}."

        messages = [{"role": "system", "content": system_content}]
        messages.extend(history)
        messages.append({"role": "user", "content": combined_message})

        response = client.chat.completions(model=settings.SARVAM_LLM_MODEL, messages=messages)
        return _clean_think_tags(response.choices[0].message.content)

    reply = await asyncio.to_thread(_call_llm)

    await add_message(db, session_id, "assistant", reply)
    await db.commit()

    return {
        "reply": reply,
        "image_description": image_description,
    }
