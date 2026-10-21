"""API endpoints for Resource Viewing and Study Activity History."""

import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.entities import User
from app.schemas.domain import (
    StudyActivityRead,
)
from app.services.persistence import StudyActivityPersistenceService

router = APIRouter(prefix="/activity", tags=["Study Activity"])


@router.post("/view/{resource_id}", response_model=Dict[str, Any])
async def record_resource_view(
    resource_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Record that a student has reopened or viewed a learning resource.
    Atomically increments view_count and updates last_viewed_at timestamp.
    """
    count, last_viewed = await StudyActivityPersistenceService.record_view(
        session=session,
        user_id=user.id,
        resource_id=resource_id,
    )
    await session.commit()
    return {
        "resource_id": str(resource_id),
        "view_count": count,
        "last_viewed_at": last_viewed.isoformat(),
    }


@router.get("/subject/{subject_id}", response_model=List[StudyActivityRead])
async def get_subject_activity(
    subject_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieve recent study activity and material access history for a subject."""
    activities = await StudyActivityPersistenceService.get_recent_activities(
        session=session,
        user_id=user.id,
        subject_id=subject_id,
        limit=limit,
    )
    return [
        StudyActivityRead(
            id=a.id,
            user_id=a.user_id,
            subject_id=a.subject_id,
            resource_id=a.resource_id,
            document_id=a.document_id,
            activity_type=a.activity_type,
            occurred_at=a.occurred_at,
            metadata_=a.metadata_,
        )
        for a in activities
    ]
