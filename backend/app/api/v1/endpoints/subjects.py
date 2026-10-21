"""API endpoints for Subject management."""

import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.entities import User
from app.schemas.domain import (
    SubjectCreate,
    SubjectUpdate,
    SubjectRead,
    SubjectDetailRead,
)
from app.services.persistence import SubjectPersistenceService

router = APIRouter(prefix="/subjects", tags=["Subjects"])


@router.post("", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
async def create_subject(
    payload: SubjectCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Create a new subject belonging to the authenticated user."""
    subject = await SubjectPersistenceService.create_subject(
        session=session,
        user_id=user.id,
        name=payload.name,
        description=payload.description,
    )
    await session.commit()
    return subject


@router.get("", response_model=List[SubjectRead])
async def list_subjects(
    include_archived: bool = False,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """List all subjects owned by the authenticated user."""
    return await SubjectPersistenceService.list_subjects(
        session=session,
        user_id=user.id,
        include_archived=include_archived,
    )


@router.get("/{subject_id}", response_model=SubjectDetailRead)
async def get_subject(
    subject_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Get subject details along with active document and resource counts."""
    subject, doc_count, res_count = await SubjectPersistenceService.get_subject_with_counts(
        session=session,
        user_id=user.id,
        subject_id=subject_id,
    )
    return SubjectDetailRead(
        id=subject.id,
        user_id=subject.user_id,
        name=subject.name,
        description=subject.description,
        archived_at=subject.archived_at,
        created_at=subject.created_at,
        updated_at=subject.updated_at,
        document_count=doc_count,
        resource_count=res_count,
    )


@router.patch("/{subject_id}", response_model=SubjectRead)
async def update_subject(
    subject_id: uuid.UUID,
    payload: SubjectUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Rename or archive a subject."""
    archived_val = None
    if payload.archived_at is not None:
        archived_val = True
    subject = await SubjectPersistenceService.update_subject(
        session=session,
        user_id=user.id,
        subject_id=subject_id,
        name=payload.name,
        description=payload.description,
        archived=archived_val,
    )
    await session.commit()
    return subject


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Delete a subject and all associated resources."""
    await SubjectPersistenceService.delete_subject(
        session=session,
        user_id=user.id,
        subject_id=subject_id,
    )
    await session.commit()
