"""API endpoints for MCQ Sets, Assessments, and Attempts."""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.entities import User
from app.schemas.domain import (
    MCQSetCreate,
    MCQSetRead,
    AssessmentCreate,
    AssessmentRead,
    AssessmentAttemptRead,
    AssessmentAnswerInput,
    AssessmentSubmitInput,
    AssessmentAttemptAnswerRead,
)
from app.services.persistence import MCQPersistenceService

router = APIRouter(prefix="/mcq", tags=["MCQ Sets & Assessments"])


@router.post("/{subject_id}/sets", response_model=MCQSetRead, status_code=status.HTTP_201_CREATED)
async def save_mcq_set(
    subject_id: uuid.UUID,
    payload: MCQSetCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Save a newly generated MCQ set with questions, options, and source references."""
    questions_dicts = [q.model_dump() for q in payload.questions]
    sources_dicts = [s.model_dump() for s in payload.sources] if payload.sources else None

    mcq_set = await MCQPersistenceService.save_mcq_set(
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

    _, formatted_q = await MCQPersistenceService.get_mcq_set(
        session=session,
        user_id=user.id,
        mcq_set_id=mcq_set.id,
        reveal_correct=True,
    )
    return MCQSetRead(
        id=mcq_set.id,
        user_id=mcq_set.user_id,
        subject_id=mcq_set.subject_id,
        resource_id=mcq_set.resource_id,
        title=mcq_set.title,
        description=mcq_set.description,
        difficulty=mcq_set.difficulty,
        question_count=mcq_set.question_count,
        generation_parameters=mcq_set.generation_parameters,
        created_at=mcq_set.created_at,
        updated_at=mcq_set.updated_at,
        questions=formatted_q,
    )


@router.get("/{subject_id}/sets", response_model=List[MCQSetRead])
async def list_mcq_sets(
    subject_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """List saved MCQ sets for an authorized subject."""
    return await MCQPersistenceService.list_mcq_sets(
        session=session,
        user_id=user.id,
        subject_id=subject_id,
    )


@router.get("/{subject_id}/sets/{set_id}", response_model=MCQSetRead)
async def open_mcq_set(
    subject_id: uuid.UUID,
    set_id: uuid.UUID,
    mode: str = Query("study", description="'study' reveals correct answers; 'quiz' hides them"),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Open an existing MCQ set with ordered questions, options, and source references."""
    reveal = (mode != "quiz")
    mcq_set, formatted_q = await MCQPersistenceService.get_mcq_set(
        session=session,
        user_id=user.id,
        mcq_set_id=set_id,
        reveal_correct=reveal,
    )
    return MCQSetRead(
        id=mcq_set.id,
        user_id=mcq_set.user_id,
        subject_id=mcq_set.subject_id,
        resource_id=mcq_set.resource_id,
        title=mcq_set.title,
        description=mcq_set.description,
        difficulty=mcq_set.difficulty,
        question_count=mcq_set.question_count,
        generation_parameters=mcq_set.generation_parameters,
        created_at=mcq_set.created_at,
        updated_at=mcq_set.updated_at,
        questions=formatted_q,
    )


# --- Assessments ---

@router.post("/{subject_id}/assessments", response_model=AssessmentRead, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    subject_id: uuid.UUID,
    payload: AssessmentCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Create an assessment definition referencing an MCQ set."""
    assessment = await MCQPersistenceService.create_assessment(
        session=session,
        user_id=user.id,
        subject_id=subject_id,
        title=payload.title,
        mcq_set_id=payload.mcq_set_id,
        description=payload.description,
    )
    await session.commit()
    return assessment


@router.post("/assessments/{assessment_id}/attempt", response_model=AssessmentAttemptRead, status_code=status.HTTP_201_CREATED)
async def start_assessment_attempt(
    assessment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Start an assessment attempt for the student."""
    attempt = await MCQPersistenceService.start_assessment_attempt(
        session=session,
        user_id=user.id,
        assessment_id=assessment_id,
    )
    await session.commit()
    return await MCQPersistenceService.get_assessment_attempt(
        session=session,
        user_id=user.id,
        attempt_id=attempt.id,
    )


@router.put("/attempts/{attempt_id}/answers", response_model=AssessmentAttemptAnswerRead)
async def save_attempt_answer(
    attempt_id: uuid.UUID,
    payload: AssessmentAnswerInput,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Save or update a student's answer in an active attempt."""
    ans = await MCQPersistenceService.save_or_update_attempt_answer(
        session=session,
        user_id=user.id,
        attempt_id=attempt_id,
        question_id=payload.question_id,
        selected_option_id=payload.selected_option_id,
    )
    await session.commit()
    return ans


@router.post("/attempts/{attempt_id}/submit", response_model=AssessmentAttemptRead)
async def submit_assessment_attempt(
    attempt_id: uuid.UUID,
    payload: AssessmentSubmitInput,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Submit and score an assessment attempt server-side.
    Guarantees idempotent submission: duplicate calls return existing score without corruption.
    """
    answers_dicts = [a.model_dump() for a in payload.answers]
    attempt = await MCQPersistenceService.submit_assessment_attempt(
        session=session,
        user_id=user.id,
        attempt_id=attempt_id,
        answers_input=answers_dicts,
        duration_seconds=payload.duration_seconds,
    )
    await session.commit()
    return await MCQPersistenceService.get_assessment_attempt(
        session=session,
        user_id=user.id,
        attempt_id=attempt.id,
    )


@router.get("/assessments/{assessment_id}/attempts", response_model=List[AssessmentAttemptRead])
async def list_assessment_attempts(
    assessment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieve historical attempts for an assessment."""
    return await MCQPersistenceService.list_assessment_attempts(
        session=session,
        user_id=user.id,
        assessment_id=assessment_id,
    )


@router.get("/attempts/{attempt_id}", response_model=AssessmentAttemptRead)
async def get_assessment_attempt(
    attempt_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Reopen a historical attempt and inspect recorded results and answers."""
    return await MCQPersistenceService.get_assessment_attempt(
        session=session,
        user_id=user.id,
        attempt_id=attempt_id,
    )
