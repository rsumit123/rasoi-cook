from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_hi: Mapped[str | None] = mapped_column(String(255))
    cuisine: Mapped[str | None] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(100))
    difficulty: Mapped[str | None] = mapped_column(String(20))
    prep_time: Mapped[int | None] = mapped_column(Integer)
    cook_time: Mapped[int | None] = mapped_column(Integer)

    ingredients: Mapped[list["Ingredient"]] = relationship(back_populates="recipe", cascade="all, delete-orphan")
    steps: Mapped[list["Step"]] = relationship(back_populates="recipe", cascade="all, delete-orphan", order_by="Step.step_number")


class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_hi: Mapped[str | None] = mapped_column(String(255))
    quantity: Mapped[str | None] = mapped_column(String(50))
    unit: Mapped[str | None] = mapped_column(String(50))
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False)

    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients")


class Step(Base):
    __tablename__ = "steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    instruction: Mapped[str] = mapped_column(Text, nullable=False)
    instruction_hi: Mapped[str | None] = mapped_column(Text)
    duration_mins: Mapped[int | None] = mapped_column(Integer)
    tips: Mapped[str | None] = mapped_column(Text)

    recipe: Mapped["Recipe"] = relationship(back_populates="steps")
