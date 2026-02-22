import json
import os
from contextlib import contextmanager
from urllib.parse import urlparse, urlunparse

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_pool: ConnectionPool | None = None


def _normalize_tiktok_url(raw_url: str) -> str:
    """Strip query params / fragments so the same video always matches."""
    parsed = urlparse(raw_url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        raise RuntimeError("Database pool not initialised — call init_db() first")
    return _pool


def init_db() -> None:
    global _pool
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL environment variable is not set")

    _pool = ConnectionPool(dsn, min_size=1, max_size=5, open=True)

    with _pool.connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS recipes (
                id          SERIAL PRIMARY KEY,
                url         TEXT UNIQUE NOT NULL,
                transcript  TEXT NOT NULL,
                caption     TEXT,
                recipe      JSONB NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        conn.commit()


def close_db() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def lookup_recipe(raw_url: str) -> dict | None:
    url = _normalize_tiktok_url(raw_url)
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            row = cur.execute(
                "SELECT transcript, caption, recipe FROM recipes WHERE url = %s",
                (url,),
            ).fetchone()

    if row is None:
        return None

    return {
        "transcript": row["transcript"],
        "caption": row["caption"],
        "recipe": row["recipe"],
    }


def save_recipe(
    raw_url: str,
    transcript: str,
    caption: str | None,
    recipe: dict,
) -> None:
    url = _normalize_tiktok_url(raw_url)
    with get_pool().connection() as conn:
        conn.execute(
            """
            INSERT INTO recipes (url, transcript, caption, recipe)
            VALUES (%s, %s, %s, %s::jsonb)
            ON CONFLICT (url) DO UPDATE
                SET transcript = EXCLUDED.transcript,
                    caption    = EXCLUDED.caption,
                    recipe     = EXCLUDED.recipe
            """,
            (url, transcript, caption, json.dumps(recipe)),
        )
        conn.commit()
