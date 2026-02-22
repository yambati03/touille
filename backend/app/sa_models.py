from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .database import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    dietary_restrictions: Mapped[str | None] = mapped_column(Text, nullable=True)
    spice_tolerance: Mapped[int] = mapped_column(
        Integer, nullable=False, default=2, server_default="2"
    )
    custom_rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Recipe(Base):
    __tablename__ = "recipes"
    __table_args__ = (
        UniqueConstraint("url", "user_id", name="uq_recipes_url_user_id"),
        Index("ix_recipes_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[str] = mapped_column(
        String(255), nullable=False, default="__anonymous__"
    )
    transcript: Mapped[str] = mapped_column(Text, nullable=False)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    recipe: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, default=lambda: datetime.now(timezone.utc)
    )
