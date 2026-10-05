from datetime import datetime, timezone
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.db.session import check_db_connectivity

router = APIRouter()


@router.get(
    "/health",
    summary="Service Health & Dependency Status",
    description="Returns API service health, timestamp, and PostgreSQL/pgvector connectivity state.",
)
async def get_health():
    """Validates the health of the API process and its PostgreSQL/pgvector database."""
    db_health = await check_db_connectivity()

    is_healthy = db_health.get("status") == "connected"
    overall_status = "healthy" if is_healthy else "degraded"
    status_code = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    payload = {
        "status": overall_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": settings.APP_ENV,
        "version": settings.APP_VERSION,
        "services": {
            "api": {
                "status": "healthy",
            },
            "database": db_health,
        },
    }

    return JSONResponse(status_code=status_code, content=payload)
