"""Seed the database with initial recipe data from seed_recipes.json."""

import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from backend.db import Base, async_session, engine
from backend.models.recipe import Ingredient, Recipe, Step


async def seed():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Load seed data
    seed_file = Path(__file__).parent.parent / "data" / "seed_recipes.json"
    with open(seed_file) as f:
        recipes_data = json.load(f)

    async with async_session() as session:
        # Check if already seeded
        result = await session.execute(select(Recipe).limit(1))
        if result.scalar_one_or_none():
            print("Database already seeded. Skipping.")
            return

        for recipe_data in recipes_data:
            ingredients_data = recipe_data.pop("ingredients")
            steps_data = recipe_data.pop("steps")

            recipe = Recipe(**recipe_data)
            session.add(recipe)
            await session.flush()

            for ing in ingredients_data:
                session.add(Ingredient(recipe_id=recipe.id, **ing))

            for step in steps_data:
                session.add(Step(recipe_id=recipe.id, **step))

        await session.commit()
        print(f"Seeded {len(recipes_data)} recipes successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
