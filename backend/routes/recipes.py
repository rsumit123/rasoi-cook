from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db import get_db
from backend.modules.recipes.crud import get_recipe_by_id, get_recipes
from backend.modules.recipes.schemas import RecipeDetailResponse, RecipeListResponse

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


@router.get("", response_model=list[RecipeListResponse])
async def list_recipes(
    q: str | None = None,
    region: str | None = None,
    difficulty: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    recipes = await get_recipes(db, q=q, region=region, difficulty=difficulty)
    return recipes


@router.get("/{recipe_id}", response_model=RecipeDetailResponse)
async def get_recipe(recipe_id: int, db: AsyncSession = Depends(get_db)):
    recipe = await get_recipe_by_id(db, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe
