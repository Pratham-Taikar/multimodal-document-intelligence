from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    subjects,
    documents,
    mcq,
    short_answer,
    study_activity,
)

api_router = APIRouter()

# Include version 1 endpoint routers
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(subjects.router)
api_router.include_router(documents.router)
api_router.include_router(mcq.router)
api_router.include_router(short_answer.router)
api_router.include_router(study_activity.router)
