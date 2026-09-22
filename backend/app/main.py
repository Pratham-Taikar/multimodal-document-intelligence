from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import register_exception_handlers
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events (startup and graceful shutdown)."""
    logger.info(f"Starting {settings.APP_NAME} in [{settings.APP_ENV}] mode...")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}...")


def create_application() -> FastAPI:
    """Factory function for FastAPI application instance."""
    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        description="Multimodal Document Intelligence Platform - Grounded Extraction, Retrieval & Learning System",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Configure CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register domain exception handlers
    register_exception_handlers(app)

    # Mount API v1 router
    app.include_router(api_router, prefix="/api/v1")

    @app.get("/", include_in_schema=False)
    async def root():
        """Root endpoint redirecting to interactive API documentation."""
        return RedirectResponse(url="/docs")

    @app.get("/health", include_in_schema=False)
    async def health_alias():
        """Health check convenience redirect to /api/v1/health."""
        return RedirectResponse(url="/api/v1/health")

    return app


app = create_application()
