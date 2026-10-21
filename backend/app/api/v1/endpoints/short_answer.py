"""API endpoints for Short Answer Sets, Practice Attempts, and Evaluations."""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.entities import User
from app.schemas.domain import (
    ShortAnswerSetCreate,
    ShortAnswerSetRead,
    ShortAnswerAttemptRead,
    ShortAnswerSubmitInput,
)
from app.services.persistence import ShortAnswerPersistenceService

router = APIRouter(prefix="/short-answers", tags=["Short Answer Sets"])


@router.post("/{subject_id}/sets", response_model=ShortAnswerSetRead, status_code=status.HTTP_201_CREATED)
async def save_short_answer_set(
    subject_id: uuid.UUID,
    payload: ShortAnswerSetCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Save a newly generated short-answer question set."""
    questions_dicts = [q.model_dump() for q in payload.questions]
    sources_dicts = [s.model_dump() for s in payload.sources] if payload.sources else None

    sa_set = await ShortAnswerPersistenceService.save_short_answer_set(
        session=session,
        user_id=user.id,
        subject_id=subject_id,
        title=payload.title,
        questions_data=questions_dicts,
        description=payload.description,
        difficulty=payload.difficulty,
        generation_parameters=payload.generation_parameters,
        sources=sources_dicts,
    )
    await session.commit()

    return await ShortAnswerPersistenceService.get_short_answer_set(
        session=session,
        user_id=user.id,
        set_id=sa_set.id,
    )


@router.get("/{subject_id}/sets", response_model=List[ShortAnswerSetRead])
async def list_short_answer_sets(
    subject_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """List saved short-answer sets for an authorized subject."""
    return await ShortAnswerPersistenceService.list_short_answer_sets(
        session=session,
        user_id=user.id,
        subject_id=subject_id,
    )


@router.get("/{subject_id}/sets/{set_id}", response_model=ShortAnswerSetRead)
async def open_short_answer_set(
    subject_id: uuid.UUID,
    set_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Open a saved short-answer set with questions and model answers."""
    return await ShortAnswerPersistenceService.get_short_answer_set(
        session=session,
        user_id=user.id,
        set_id=set_id,
    )


@router.post("/sets/{set_id}/attempt", response_model=ShortAnswerAttemptRead, status_code=status.HTTP_201_CREATED)
async def start_practice_attempt(
    set_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Start a student practice attempt."""
    attempt = await ShortAnswerPersistenceService.start_practice_attempt(
        session=session,
        user_id=user.id,
        short_answer_set_id=set_id,
    )
    await session.commit()
    return await ShortAnswerPersistenceService.get_short_answer_attempt(
        session=session,
        user_id=user.id,
        attempt_id=attempt.id,
    )


@router.post("/attempts/{attempt_id}/responses", response_model=ShortAnswerAttemptRead)
async def save_student_responses(
    attempt_id: uuid.UUID,
    payload: ShortAnswerSubmitInput,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Save student responses and optional evaluation feedback."""
    responses_dicts = [r.model_dump() for r in payload.responses]
    await ShortAnswerPersistenceService.save_student_responses(
        session=session,
        user_id=user.id,
        attempt_id=attempt_id,
        responses_data=responses_dicts,
    )
    await session.commit()
    return await ShortAnswerPersistenceService.get_short_answer_attempt(
        session=session,
        user_id=user.id,
        attempt_id=attempt_id,
    )


@router.get("/attempts/{attempt_id}", response_model=ShortAnswerAttemptRead)
async def get_practice_attempt(
    attempt_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieve an attempt with student responses and evaluation scores."""
    return await ShortAnswerPersistenceService.get_short_answer_attempt(
        session=session,
        user_id=user.id,
        attempt_id=attempt_id,
    )


@router.get("/sets/{set_id}/history", response_model=List[ShortAnswerAttemptRead])
async def list_practice_history(
    set_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieve historical practice attempts for a question set."""
    return await ShortAnswerPersistenceService.list_practice_history(
        session=session,
        user_id=user.id,
        short_answer_set_id=set_id,
    )
