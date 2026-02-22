import os

from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session


def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return url


_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(get_database_url(), pool_size=5, max_overflow=10)
    return _engine


def dispose_engine() -> None:
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None


class _SessionFactory:
    """Lazy sessionmaker that defers engine binding until first use."""

    def __init__(self) -> None:
        self._factory: sessionmaker[Session] | None = None

    def __call__(self) -> Session:
        if self._factory is None:
            self._factory = sessionmaker(bind=get_engine())
        return self._factory()


SessionLocal = _SessionFactory()


class Base(DeclarativeBase):
    pass
