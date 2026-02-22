from urllib.parse import urlparse, urlunparse

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .database import SessionLocal
from .sa_models import Recipe

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
            select(Recipe.transcript, Recipe.caption, Recipe.recipe).where(
                Recipe.url == url, Recipe.user_id == effective_user
            )
        ).first()

    if row is None:
        return None

    return {
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
) -> None:
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
    )

    with SessionLocal() as session:
        session.execute(stmt)
        session.commit()


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
