from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.recipe import Recipe


async def get_recipes(
    db: AsyncSession,
    q: str | None = None,
    region: str | None = None,
    difficulty: str | None = None,
) -> list[Recipe]:
    stmt = select(Recipe)

    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            Recipe.name.ilike(pattern)
            | Recipe.name_hi.ilike(pattern)
            | Recipe.cuisine.ilike(pattern)
            | Recipe.region.ilike(pattern)
        )

    if region:
        stmt = stmt.where(Recipe.region.ilike(f"%{region}%"))

    if difficulty:
        stmt = stmt.where(Recipe.difficulty == difficulty)

    stmt = stmt.order_by(Recipe.name)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_recipe_by_id(db: AsyncSession, recipe_id: int) -> Recipe | None:
    stmt = (
        select(Recipe)
        .where(Recipe.id == recipe_id)
        .options(selectinload(Recipe.ingredients), selectinload(Recipe.steps))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
