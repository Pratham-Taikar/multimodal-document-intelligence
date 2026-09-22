from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from app.core.logging import logger


class AppException(Exception):
    """Base exception class for application-level domain errors."""
    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class DatabaseConnectionError(AppException):
    """Raised when the primary database is unreachable or unhealthy."""
    def __init__(self, message: str = "Database connection failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="DATABASE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=details,
        )


class EntityNotFoundError(AppException):
    """Raised when a requested entity cannot be found."""
    def __init__(self, entity_name: str, identifier: Any):
        super().__init__(
            message=f"{entity_name} with identifier '{identifier}' was not found",
            code="ENTITY_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"entity": entity_name, "identifier": str(identifier)},
        )


def register_exception_handlers(app: FastAPI) -> None:
    """Registers global exception handlers on the FastAPI application."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        logger.warning(f"Handled application exception [{exc.code}]: {exc.message}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                    "path": request.url.path,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(f"Unhandled exception on {request.url.path}: {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected internal server error occurred.",
                    "details": {},
                    "path": request.url.path,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
