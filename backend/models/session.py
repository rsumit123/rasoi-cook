from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db import Base


class CookingSession(Base):
    __tablename__ = "cooking_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String(255))
    recipe_id: Mapped[int | None] = mapped_column(ForeignKey("recipes.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    current_step: Mapped[int] = mapped_column(Integer, default=1)
    language: Mapped[str] = mapped_column(String(10), default="en")

    messages: Mapped[list["Message"]] = relationship(back_populates="session", cascade="all, delete-orphan", order_by="Message.timestamp")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("cooking_sessions.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    session: Mapped["CookingSession"] = relationship(back_populates="messages")
