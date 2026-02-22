from urllib.parse import urlparse, urlunparse

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.sql import func

from .database import SessionLocal
from .sa_models import Recipe, UserSettings

_ANON = "__anonymous__"


def _normalize_tiktok_url(raw_url: str) -> str:
    """Strip query params / fragments so the same video always matches."""
    parsed = urlparse(raw_url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


def lookup_recipe(raw_url: str, user_id: str | None = None) -> dict | None:
    url = _normalize_tiktok_url(raw_url)
    effective_user = user_id or _ANON

    with SessionLocal() as session:
        row = session.execute(
            select(Recipe.id, Recipe.transcript, Recipe.caption, Recipe.recipe).where(
                Recipe.url == url, Recipe.user_id == effective_user
            )
        ).first()

    if row is None:
        return None

    return {
        "id": row.id,
        "transcript": row.transcript,
        "caption": row.caption,
        "recipe": row.recipe,
    }


def save_recipe(
    raw_url: str,
    transcript: str,
    caption: str | None,
    recipe: dict,
    user_id: str | None = None,
) -> int:
    url = _normalize_tiktok_url(raw_url)
    effective_user = user_id or _ANON

    stmt = pg_insert(Recipe).values(
        url=url,
        user_id=effective_user,
        transcript=transcript,
        caption=caption,
        recipe=recipe,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_recipes_url_user_id",
        set_={
            "transcript": stmt.excluded.transcript,
            "caption": stmt.excluded.caption,
            "recipe": stmt.excluded.recipe,
        },
    ).returning(Recipe.id)

    with SessionLocal() as session:
        (rid,) = session.execute(stmt).first()
        session.commit()
        return rid


def get_recipe_by_id(recipe_id: int, user_id: str) -> dict | None:
    with SessionLocal() as session:
        row = session.execute(
            select(Recipe.id, Recipe.url, Recipe.recipe, Recipe.created_at).where(
                Recipe.id == recipe_id, Recipe.user_id == user_id
            )
        ).first()
    if row is None:
        return None
    return {
        "id": row.id,
        "url": row.url,
        "recipe": row.recipe,
        "created_at": row.created_at.isoformat(),
    }


def get_user_settings(user_id: str) -> dict | None:
    with SessionLocal() as session:
        row = session.scalars(
            select(UserSettings).where(UserSettings.user_id == user_id)
        ).first()
    if row is None:
        return None
    return {
        "user_id": row.user_id,
        "dietary_restrictions": row.dietary_restrictions,
        "spice_tolerance": row.spice_tolerance,
        "custom_rules": row.custom_rules,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def set_user_settings(
    user_id: str,
    dietary_restrictions: str | None = None,
    spice_tolerance: int | None = None,
    custom_rules: str | None = None,
) -> dict:
    existing = get_user_settings(user_id)
    merged = {
        "dietary_restrictions": dietary_restrictions if dietary_restrictions is not None else (existing or {}).get("dietary_restrictions"),
        "spice_tolerance": spice_tolerance if spice_tolerance is not None else (existing or {}).get("spice_tolerance", 2),
        "custom_rules": custom_rules if custom_rules is not None else (existing or {}).get("custom_rules"),
    }
    stmt = pg_insert(UserSettings).values(
        user_id=user_id,
        dietary_restrictions=merged["dietary_restrictions"],
        spice_tolerance=merged["spice_tolerance"],
        custom_rules=merged["custom_rules"],
        updated_at=func.now(),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["user_id"],
        set_={
            "dietary_restrictions": stmt.excluded.dietary_restrictions,
            "spice_tolerance": stmt.excluded.spice_tolerance,
            "custom_rules": stmt.excluded.custom_rules,
            "updated_at": func.now(),
        },
    )
    with SessionLocal() as session:
        session.execute(stmt)
        session.commit()
    return get_user_settings(user_id) or {}


def list_recipes_for_user(user_id: str) -> list[dict]:
    with SessionLocal() as session:
        rows = session.execute(
            select(Recipe.id, Recipe.url, Recipe.recipe, Recipe.created_at)
            .where(Recipe.user_id == user_id)
            .order_by(Recipe.created_at.desc())
        ).all()

    return [
        {
            "id": r.id,
            "url": r.url,
            "recipe": r.recipe,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
