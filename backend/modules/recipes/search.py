from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.recipe import Recipe


async def fuzzy_search(db: AsyncSession, query: str, limit: int = 10) -> list[Recipe]:
    """Search recipes with basic fuzzy matching using LIKE patterns.

    Splits the query into words and matches recipes where any word
    appears in the name, Hindi name, cuisine, or region.
    """
    words = query.strip().split()
    if not words:
        return []

    stmt = select(Recipe)

    for word in words:
        pattern = f"%{word}%"
        stmt = stmt.where(
            Recipe.name.ilike(pattern)
            | Recipe.name_hi.ilike(pattern)
            | Recipe.cuisine.ilike(pattern)
            | Recipe.region.ilike(pattern)
        )

    stmt = stmt.limit(limit).order_by(Recipe.name)
    result = await db.execute(stmt)
    return list(result.scalars().all())
