import time
from typing import AsyncGenerator, Dict, Any
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
    AsyncEngine,
)
from sqlalchemy import text
from app.core.config import settings
from app.core.logging import logger

# Create the asynchronous engine with connection pooling and pre-ping
engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=(settings.APP_ENV == "development" and settings.LOG_LEVEL == "DEBUG"),
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Create session factory
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields an active async database session and closes it on exit."""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_db_connectivity() -> Dict[str, Any]:
    """
    Validates database connectivity and checks whether the pgvector extension is installed.
    Returns status, latency in milliseconds, and pgvector version.
    """
    start_time = time.perf_counter()
    try:
        async with engine.connect() as conn:
            # 1. Connectivity test
            await conn.execute(text("SELECT 1"))
            latency_ms = (time.perf_counter() - start_time) * 1000

            # 2. pgvector availability check
            result = await conn.execute(
                text("SELECT extversion FROM pg_extension WHERE extname = 'vector';")
            )
            row = result.fetchone()
            pgvector_installed = row is not None
            pgvector_version = row[0] if row else None

            return {
                "status": "connected",
                "latency_ms": round(latency_ms, 2),
                "pgvector_installed": pgvector_installed,
                "pgvector_version": pgvector_version,
                "database": settings.POSTGRES_DB,
            }
    except Exception as exc:
        latency_ms = (time.perf_counter() - start_time) * 1000
        logger.error(f"Database health check failed: {exc}")
        return {
            "status": "disconnected",
            "latency_ms": round(latency_ms, 2),
            "pgvector_installed": False,
            "pgvector_version": None,
            "database": settings.POSTGRES_DB,
            "error": str(exc),
        }
