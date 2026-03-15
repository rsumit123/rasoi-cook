# Image upload and ingredient identification endpoint

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db import get_db
from backend.models.recipe import Ingredient, Recipe
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
