"""Production-grade persistence services for Multimodal Document Intelligence."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple

from sqlalchemy import select, func, and_, or_, desc, update
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import (
    User,
    Subject,
    Document,
    DocumentVersion,
    DocumentEvidence,
    LearningResource,
    ResourceSourceAssociation,
    MCQSet,
    MCQQuestion,
    MCQOption,
    Assessment,
    AssessmentAttempt,
    AssessmentAttemptAnswer,
    ShortAnswerSet,
    ShortAnswerQuestion,
    ShortAnswerAttempt,
    ShortAnswerResponse,
    StudyActivity,
    utc_now,
)
from app.core.exceptions import (
    EntityNotFoundError,
    PermissionDeniedError,
    ValidationAppError,
)


# --- Subjects ---

class SubjectPersistenceService:
    @staticmethod
    async def create_subject(
        session: AsyncSession,
        user_id: uuid.UUID,
        name: str,
        description: Optional[str] = None,
    ) -> Subject:
        name = name.strip()
        if not name:
            raise ValidationAppError("Subject name cannot be empty")

        subject = Subject(
            user_id=user_id,
            name=name,
            description=description.strip() if description else None,
        )
        session.add(subject)
        await session.flush()
        return subject

    @staticmethod
    async def list_subjects(
        session: AsyncSession,
        user_id: uuid.UUID,
        include_archived: bool = False,
    ) -> List[Subject]:
        stmt = select(Subject).where(Subject.user_id == user_id)
        if not include_archived:
            stmt = stmt.where(Subject.archived_at.is_(None))
        stmt = stmt.order_by(Subject.updated_at.desc())
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_subject(
        session: AsyncSession,
        user_id: uuid.UUID,
        subject_id: uuid.UUID,
    ) -> Subject:
        stmt = select(Subject).where(
            and_(Subject.id == subject_id, Subject.user_id == user_id)
        )
        result = await session.execute(stmt)
        subject = result.scalar_one_or_none()
        if not subject:
            raise EntityNotFoundError(f"Subject {subject_id} not found or access denied")
        return subject

    @staticmethod
    async def get_subject_with_counts(
        session: AsyncSession,
        user_id: uuid.UUID,
        subject_id: uuid.UUID,
    ) -> Tuple[Subject, int, int]:
        subject = await SubjectPersistenceService.get_subject(session, user_id, subject_id)

        # Count active documents
        doc_stmt = select(func.count(Document.id)).where(
            and_(
                Document.subject_id == subject_id,
                Document.user_id == user_id,
                Document.deleted_at.is_(None),
            )
        )
        doc_count = (await session.execute(doc_stmt)).scalar() or 0

        # Count learning resources
        res_stmt = select(func.count(LearningResource.id)).where(
            and_(
                LearningResource.subject_id == subject_id,
                LearningResource.user_id == user_id,
            )
        )
        res_count = (await session.execute(res_stmt)).scalar() or 0

        return subject, doc_count, res_count

    @staticmethod
    async def update_subject(
        session: AsyncSession,
        user_id: uuid.UUID,
        subject_id: uuid.UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        archived: Optional[bool] = None,
    ) -> Subject:
        subject = await SubjectPersistenceService.get_subject(session, user_id, subject_id)
        if name is not None:
            name_clean = name.strip()
            if not name_clean:
                raise ValidationAppError("Subject name cannot be empty")
            subject.name = name_clean
        if description is not None:
            subject.description = description.strip() if description else None
        if archived is not None:
            subject.archived_at = utc_now() if archived else None

        subject.updated_at = utc_now()
        await session.flush()
        return subject

    @staticmethod
    async def delete_subject(
        session: AsyncSession,
        user_id: uuid.UUID,
        subject_id: uuid.UUID,
    ) -> None:
        subject = await SubjectPersistenceService.get_subject(session, user_id, subject_id)
        await session.delete(subject)
        await session.flush()


# --- Documents ---

class DocumentPersistenceService:
    @staticmethod
    async def create_document(
        session: AsyncSession,
        user_id: uuid.UUID,
        subject_id: uuid.UUID,
        original_filename: str,
        display_name: str,
        file_type: str,
        mime_type: str,
        file_size_bytes: int,
        storage_key: str,
        content_hash: Optional[str] = None,
    ) -> Document:
        # Validate that subject belongs to user
        await SubjectPersistenceService.get_subject(session, user_id, subject_id)

        document = Document(
            user_id=user_id,
            subject_id=subject_id,
            original_filename=original_filename,
            display_name=display_name,
            file_type=file_type.lower(),
            mime_type=mime_type,
            file_size_bytes=file_size_bytes,
            storage_key=storage_key,
            content_hash=content_hash,
            processing_status="uploaded",
        )
        session.add(document)
        await session.flush()

        # Create version 1
        version = DocumentVersion(
            document_id=document.id,
            version_number=1,
            storage_key=storage_key,
            file_size_bytes=file_size_bytes,
            content_hash=content_hash,
        )
        session.add(version)
        await session.flush()

        # Log document activity
        activity = StudyActivity(
            user_id=user_id,
            subject_id=subject_id,
            document_id=document.id,
            activity_type="document_opened",
            occurred_at=utc_now(),
            metadata_={"action": "created", "filename": original_filename},
        )
        session.add(activity)
        await session.flush()

        return document

    @staticmethod
    async def list_documents(
        session: AsyncSession,
        user_id: uuid.UUID,
        subject_id: uuid.UUID,
        include_deleted: bool = False,
    ) -> List[Document]:
        await SubjectPersistenceService.get_subject(session, user_id, subject_id)
        stmt = (
            select(Document)
            .where(
                and_(
                    Document.user_id == user_id,
                    Document.subject_id == subject_id,
                )
            )
            .options(selectinload(Document.versions))
            .order_by(Document.created_at.desc())
        )
        if not include_deleted:
            stmt = stmt.where(Document.deleted_at.is_(None))
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_document(
        session: AsyncSession,
        user_id: uuid.UUID,
        document_id: uuid.UUID,
    ) -> Document:
        stmt = (
            select(Document)
            .where(and_(Document.id == document_id, Document.user_id == user_id))
            .options(selectinload(Document.versions))
        )
        result = await session.execute(stmt)
        document = result.scalar_one_or_none()
        if not document:
            raise EntityNotFoundError(f"Document {document_id} not found or access denied")
        return document

    @staticmethod
    async def update_processing_status(
        session: AsyncSession,
        user_id: uuid.UUID,
        document_id: uuid.UUID,
        status: str,
        error: Optional[str] = None,
    ) -> Document:
        valid_statuses = {"uploaded", "queued", "processing", "completed", "failed"}
        if status not in valid_statuses:
            raise ValidationAppError(f"Invalid processing status: {status}")

        document = await DocumentPersistenceService.get_document(session, user_id, document_id)
        document.processing_status = status
        document.processing_error = error
        document.updated_at = utc_now()
        await session.flush()
        return document

    @staticmethod
    async def add_evidence_items(
        session: AsyncSession,
        document_version_id: uuid.UUID,
        evidence_items: List[Dict[str, Any]],
    ) -> List[DocumentEvidence]:
        created = []
        for item in evidence_items:
            evidence = DocumentEvidence(
                document_version_id=document_version_id,
                page_number=item.get("page_number"),
                slide_number=item.get("slide_number"),
                element_id=item.get("element_id"),
                element_type=item.get("element_type", "text_block"),
                content=item["content"],
                bounding_box=item.get("bounding_box"),
                parser_metadata=item.get("parser_metadata"),
            )
            session.add(evidence)
            created.append(evidence)
        await session.flush()
        return created

    @staticmethod
    async def delete_document(
        session: AsyncSession,
        user_id: uuid.UUID,
        document_id: uuid.UUID,
        soft_delete: bool = True,
    ) -> None:
        document = await DocumentPersistenceService.get_document(session, user_id, document_id)
        if soft_delete:
            document.deleted_at = utc_now()
            document.updated_at = utc_now()
        else:
            await session.delete(document)
        await session.flush()


# --- MCQ Sets & Assessments ---

class MCQPersistenceService:
    @staticmethod
    async def save_mcq_set(
        session: AsyncSession,
        user_id: uuid.UUID,
        subject_id: uuid.UUID,
        title: str,
        questions_data: List[Dict[str, Any]],
        description: Optional[str] = None,
        difficulty: Optional[str] = None,
        generation_parameters: Optional[Dict[str, Any]] = None,
        sources: Optional[List[Dict[str, Any]]] = None,
    ) -> MCQSet:
        # Verify subject ownership
        await SubjectPersistenceService.get_subject(session, user_id, subject_id)

        if not questions_data:
            raise ValidationAppError("MCQ set must contain at least one question")

        # Verify that all source documents belong to the same user and subject
        if sources:
            for src in sources:
                doc_id = src.get("document_id")
                if doc_id:
                    doc = await session.get(Document, doc_id)
                    if not doc or doc.user_id != user_id or doc.subject_id != subject_id:
                        raise PermissionDeniedError(
                            f"Source document {doc_id} does not belong to authorized user subject"
                        )

        # 1. Create common LearningResource registry entry
        resource = LearningResource(
            user_id=user_id,
            subject_id=subject_id,
            resource_type="mcq_set",
            title=title,
            generation_status="completed",
            generation_parameters=generation_parameters,
            source_snapshot={"sources_count": len(sources) if sources else 0},
            view_count=1,
            last_viewed_at=utc_now(),
        )
        session.add(resource)
        await session.flush()

        # 2. Create typed MCQSet
        mcq_set = MCQSet(
            user_id=user_id,
            subject_id=subject_id,
            resource_id=resource.id,
            title=title,
            description=description,
            difficulty=difficulty,
            question_count=len(questions_data),
            generation_parameters=generation_parameters,
        )
        session.add(mcq_set)
        await session.flush()

        # 3. Create questions & options
        for q_idx, q_data in enumerate(questions_data):
            q_text = q_data.get("question_text", "").strip()
            if not q_text:
                raise ValidationAppError(f"Question {q_idx + 1} text cannot be empty")

            options_list = q_data.get("options", [])
            if len(options_list) != 4:
                raise ValidationAppError(
                    f"Question {q_idx + 1} must have exactly 4 options, found {len(options_list)}"
                )

            question = MCQQuestion(
                mcq_set_id=mcq_set.id,
                question_text=q_text,
                explanation=q_data.get("explanation"),
                difficulty=q_data.get("difficulty", difficulty),
                question_order=q_idx,
            )
            session.add(question)
            await session.flush()

            # Create options
            correct_label = q_data.get("correct_option_label")
            correct_option_id = None

            for o_idx, o_data in enumerate(options_list):
                o_label = o_data.get("option_label", ["A", "B", "C", "D"][o_idx]).strip().upper()
                o_text = o_data.get("option_text", "").strip()
                if not o_text:
                    raise ValidationAppError(f"Option {o_label} text cannot be empty")

                option = MCQOption(
                    question_id=question.id,
                    option_text=o_text,
                    option_label=o_label,
                    option_order=o_idx,
                )
                session.add(option)
                await session.flush()

                if correct_label and o_label == correct_label.upper():
                    correct_option_id = option.id

            # Set correct option
            if correct_option_id:
                question.correct_option_id = correct_option_id
                await session.flush()

        # 4. Attach source associations
        if sources:
            for src in sources:
                assoc = ResourceSourceAssociation(
                    resource_id=resource.id,
                    document_id=src["document_id"],
                    document_version_id=src.get("document_version_id"),
                    evidence_id=src.get("evidence_id"),
                    source_snapshot=src.get("source_snapshot"),
                )
                session.add(assoc)

        # 5. Log activity
        activity = StudyActivity(
            user_id=user_id,
            subject_id=subject_id,
            resource_id=resource.id,
            activity_type="resource_generated",
            occurred_at=utc_now(),
            metadata_={"type": "mcq_set", "questions": len(questions_data)},
        )
        session.add(activity)
        await session.flush()

        return mcq_set

    @staticmethod
    async def list_mcq_sets(
        session: AsyncSession,
        user_id: uuid.UUID,
        subject_id: uuid.UUID,
    ) -> List[MCQSet]:
        await SubjectPersistenceService.get_subject(session, user_id, subject_id)
        stmt = (
            select(MCQSet)
            .where(and_(MCQSet.user_id == user_id, MCQSet.subject_id == subject_id))
            .order_by(MCQSet.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_mcq_set(
        session: AsyncSession,
        user_id: uuid.UUID,
        mcq_set_id: uuid.UUID,
        reveal_correct: bool = True,
    ) -> Tuple[MCQSet, List[Dict[str, Any]]]:
        stmt = (
            select(MCQSet)
            .where(and_(MCQSet.id == mcq_set_id, MCQSet.user_id == user_id))
            .options(
                selectinload(MCQSet.questions).selectinload(MCQQuestion.options),
                selectinload(MCQSet.resource).selectinload(LearningResource.source_associations),
            )
        )
        result = await session.execute(stmt)
        mcq_set = result.scalar_one_or_none()
        if not mcq_set:
            raise EntityNotFoundError(f"MCQ set {mcq_set_id} not found or access denied")

        # Format questions, optionally masking correct_option_id
        formatted_questions = []
        for q in mcq_set.questions:
            q_dict = {
                "id": q.id,
                "question_text": q.question_text,
                "explanation": q.explanation if reveal_correct else None,
                "difficulty": q.difficulty,
                "question_order": q.question_order,
                "correct_option_id": q.correct_option_id if reveal_correct else None,
                "options": [
                    {
                        "id": opt.id,
                        "option_text": opt.option_text,
                        "option_label": opt.option_label,
                        "option_order": opt.option_order,
                    }
                    for opt in q.options
                ],
            }
            formatted_questions.append(q_dict)

        # Update view stats
        if mcq_set.resource:
            mcq_set.resource.view_count += 1
            mcq_set.resource.last_viewed_at = utc_now()
            await session.flush()

        return mcq_set, formatted_questions

    # --- Assessments & Attempts ---

    @staticmethod
    async def create_assessment(
        session: AsyncSession,
        user_id: uuid.UUID,
        subject_id: uuid.UUID,
        title: str,
        mcq_set_id: uuid.UUID,
        description: Optional[str] = None,
    ) -> Assessment:
        await SubjectPersistenceService.get_subject(session, user_id, subject_id)

        # Verify MCQ set ownership
        mcq_set = await session.get(MCQSet, mcq_set_id)
        if not mcq_set or mcq_set.user_id != user_id or mcq_set.subject_id != subject_id:
            raise PermissionDeniedError(f"MCQ set {mcq_set_id} does not belong to authorized user subject")

        # Create registry entry
        resource = LearningResource(
            user_id=user_id,
            subject_id=subject_id,
            resource_type="assessment",
            title=title,
            generation_status="completed",
            generation_parameters={"mcq_set_id": str(mcq_set_id)},
            view_count=1,
            last_viewed_at=utc_now(),
        )
        session.add(resource)
        await session.flush()

        assessment = Assessment(
            user_id=user_id,
            subject_id=subject_id,
            resource_id=resource.id,
            mcq_set_id=mcq_set_id,
            title=title,
            description=description,
        )
        session.add(assessment)
        await session.flush()
        return assessment

    @staticmethod
    async def start_assessment_attempt(
        session: AsyncSession,
        user_id: uuid.UUID,
        assessment_id: uuid.UUID,
    ) -> AssessmentAttempt:
        stmt = select(Assessment).where(
            and_(Assessment.id == assessment_id, Assessment.user_id == user_id)
        )
        result = await session.execute(stmt)
        assessment = result.scalar_one_or_none()
        if not assessment:
            raise EntityNotFoundError(f"Assessment {assessment_id} not found or access denied")

        attempt = AssessmentAttempt(
            user_id=user_id,
            subject_id=assessment.subject_id,
            assessment_id=assessment_id,
            started_at=utc_now(),
            status="in_progress",
        )
        session.add(attempt)
        await session.flush()

        # Log activity
        activity = StudyActivity(
            user_id=user_id,
            subject_id=assessment.subject_id,
            resource_id=assessment.resource_id,
            activity_type="assessment_started",
            occurred_at=utc_now(),
            metadata_={"attempt_id": str(attempt.id)},
        )
        session.add(activity)
        await session.flush()

        return attempt

    @staticmethod
    async def save_or_update_attempt_answer(
        session: AsyncSession,
        user_id: uuid.UUID,
        attempt_id: uuid.UUID,
        question_id: uuid.UUID,
        selected_option_id: Optional[uuid.UUID] = None,
    ) -> AssessmentAttemptAnswer:
        attempt = await session.get(AssessmentAttempt, attempt_id)
        if not attempt or attempt.user_id != user_id:
            raise PermissionDeniedError(f"Attempt {attempt_id} not found or access denied")

        if attempt.status == "completed":
            raise ValidationAppError("Cannot modify answers for a completed assessment attempt")

        # Find or create answer
        stmt = select(AssessmentAttemptAnswer).where(
            and_(
                AssessmentAttemptAnswer.attempt_id == attempt_id,
                AssessmentAttemptAnswer.question_id == question_id,
            )
        )
        result = await session.execute(stmt)
        answer = result.scalar_one_or_none()

        if answer:
            answer.selected_option_id = selected_option_id
            answer.answered_at = utc_now()
        else:
            answer = AssessmentAttemptAnswer(
                attempt_id=attempt_id,
                question_id=question_id,
                selected_option_id=selected_option_id,
                answered_at=utc_now(),
            )
            session.add(answer)

        await session.flush()
        return answer

    @staticmethod
    async def submit_assessment_attempt(
        session: AsyncSession,
        user_id: uuid.UUID,
        attempt_id: uuid.UUID,
        answers_input: List[Dict[str, Any]],
        duration_seconds: Optional[int] = None,
    ) -> AssessmentAttempt:
        stmt = (
            select(AssessmentAttempt)
            .where(
                and_(AssessmentAttempt.id == attempt_id, AssessmentAttempt.user_id == user_id)
            )
            .options(joinedload(AssessmentAttempt.assessment))
        )
        result = await session.execute(stmt)
        attempt = result.scalar_one_or_none()
        if not attempt:
            raise EntityNotFoundError(f"Attempt {attempt_id} not found or access denied")

        # Idempotence: If already completed, return existing result without re-evaluating
        if attempt.status == "completed":
            return attempt

        assessment = attempt.assessment
        mcq_set = await session.get(MCQSet, assessment.mcq_set_id)
        if not mcq_set:
            raise EntityNotFoundError("Associated MCQ Set not found")

        # Fetch questions and correct options
        q_stmt = (
            select(MCQQuestion)
            .where(MCQQuestion.mcq_set_id == mcq_set.id)
            .options(selectinload(MCQQuestion.options))
        )
        q_result = await session.execute(q_stmt)
        questions = {q.id: q for q in q_result.scalars().all()}

        total_questions = len(questions)
        correct_count = 0
        incorrect_count = 0
        unanswered_count = 0

        # Save answers and evaluate server-side
        answers_dict = {ans["question_id"]: ans.get("selected_option_id") for ans in answers_input}

        for q_id, question in questions.items():
            selected_option_id = answers_dict.get(q_id)

            if selected_option_id is None:
                unanswered_count += 1
                is_correct = False
                points = 0.0
            else:
                if str(selected_option_id) == str(question.correct_option_id):
                    correct_count += 1
                    is_correct = True
                    points = 1.0
                else:
                    incorrect_count += 1
                    is_correct = False
                    points = 0.0

            # Upsert answer record
            ans_stmt = select(AssessmentAttemptAnswer).where(
                and_(
                    AssessmentAttemptAnswer.attempt_id == attempt_id,
                    AssessmentAttemptAnswer.question_id == q_id,
                )
            )
            existing_ans = (await session.execute(ans_stmt)).scalar_one_or_none()

            if existing_ans:
                existing_ans.selected_option_id = selected_option_id
                existing_ans.is_correct = is_correct
                existing_ans.points_awarded = points
                existing_ans.answered_at = utc_now()
            else:
                new_ans = AssessmentAttemptAnswer(
                    attempt_id=attempt_id,
                    question_id=q_id,
                    selected_option_id=selected_option_id,
                    is_correct=is_correct,
                    points_awarded=points,
                    answered_at=utc_now(),
                )
                session.add(new_ans)

        # Update attempt status and results
        score = float(correct_count)
        max_score = float(total_questions)
        percentage = round((score / max_score) * 100.0, 2) if max_score > 0 else 0.0

        attempt.status = "completed"
        attempt.submitted_at = utc_now()
        attempt.score = score
        attempt.max_score = max_score
        attempt.percentage = percentage
        attempt.correct_count = correct_count
        attempt.incorrect_count = incorrect_count
        attempt.unanswered_count = unanswered_count
        attempt.duration_seconds = duration_seconds

        # Log activity
        activity = StudyActivity(
            user_id=user_id,
            subject_id=attempt.subject_id,
            resource_id=assessment.resource_id,
            activity_type="assessment_submitted",
            occurred_at=utc_now(),
            metadata_={
                "attempt_id": str(attempt.id),
                "score": score,
                "percentage": percentage,
            },
        )
        session.add(activity)
        await session.flush()

        return attempt

    @staticmethod
    async def get_assessment_attempt(
        session: AsyncSession,
        user_id: uuid.UUID,
        attempt_id: uuid.UUID,
    ) -> AssessmentAttempt:
        stmt = (
            select(AssessmentAttempt)
            .where(
                and_(AssessmentAttempt.id == attempt_id, AssessmentAttempt.user_id == user_id)
            )
            .options(
                selectinload(AssessmentAttempt.answers).joinedload(AssessmentAttemptAnswer.question),
                selectinload(AssessmentAttempt.answers).joinedload(AssessmentAttemptAnswer.selected_option),
            )
        )
        result = await session.execute(stmt)
        attempt = result.scalar_one_or_none()
        if not attempt:
            raise EntityNotFoundError(f"Attempt {attempt_id} not found or access denied")
        return attempt

    @staticmethod
    async def list_assessment_attempts(
        session: AsyncSession,
        user_id: uuid.UUID,
        assessment_id: uuid.UUID,
    ) -> List[AssessmentAttempt]:
        stmt = (
            select(AssessmentAttempt)
            .where(
                and_(
                    AssessmentAttempt.assessment_id == assessment_id,
                    AssessmentAttempt.user_id == user_id,
                )
            )
            .order_by(AssessmentAttempt.started_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


# --- Short Answers ---

class ShortAnswerPersistenceService:
    @staticmethod
    async def save_short_answer_set(
        session: AsyncSession,
        user_id: uuid.UUID,
        subject_id: uuid.UUID,
        title: str,
        questions_data: List[Dict[str, Any]],
        description: Optional[str] = None,
        difficulty: Optional[str] = None,
        generation_parameters: Optional[Dict[str, Any]] = None,
        sources: Optional[List[Dict[str, Any]]] = None,
    ) -> ShortAnswerSet:
        await SubjectPersistenceService.get_subject(session, user_id, subject_id)

        if not questions_data:
            raise ValidationAppError("Short answer set must contain at least one question")

        # Verify source documents
        if sources:
            for src in sources:
                doc_id = src.get("document_id")
                if doc_id:
                    doc = await session.get(Document, doc_id)
                    if not doc or doc.user_id != user_id or doc.subject_id != subject_id:
                        raise PermissionDeniedError(
                            f"Source document {doc_id} does not belong to authorized user subject"
                        )

        # 1. Registry entry
        resource = LearningResource(
            user_id=user_id,
            subject_id=subject_id,
            resource_type="short_answer_set",
            title=title,
            generation_status="completed",
            generation_parameters=generation_parameters,
            source_snapshot={"sources_count": len(sources) if sources else 0},
            view_count=1,
            last_viewed_at=utc_now(),
        )
        session.add(resource)
        await session.flush()

        # 2. ShortAnswerSet
        sa_set = ShortAnswerSet(
            user_id=user_id,
            subject_id=subject_id,
            resource_id=resource.id,
            title=title,
            description=description,
            difficulty=difficulty,
            question_count=len(questions_data),
            generation_parameters=generation_parameters,
        )
        session.add(sa_set)
        await session.flush()

        # 3. Questions
        for idx, q_data in enumerate(questions_data):
            q_text = q_data.get("question_text", "").strip()
            model_ans = q_data.get("model_answer", "").strip()
            if not q_text or not model_ans:
                raise ValidationAppError(f"Question {idx + 1} must include both text and model answer")

            question = ShortAnswerQuestion(
                set_id=sa_set.id,
                question_text=q_text,
                model_answer=model_ans,
                hint=q_data.get("hint"),
                question_order=idx,
                max_score=q_data.get("max_score", 1.0),
            )
            session.add(question)

        # 4. Sources
        if sources:
            for src in sources:
                assoc = ResourceSourceAssociation(
                    resource_id=resource.id,
                    document_id=src["document_id"],
                    document_version_id=src.get("document_version_id"),
                    evidence_id=src.get("evidence_id"),
                    source_snapshot=src.get("source_snapshot"),
                )
                session.add(assoc)

        # 5. Activity
        activity = StudyActivity(
            user_id=user_id,
            subject_id=subject_id,
            resource_id=resource.id,
            activity_type="resource_generated",
            occurred_at=utc_now(),
            metadata_={"type": "short_answer_set", "questions": len(questions_data)},
        )
        session.add(activity)
        await session.flush()

        return sa_set

    @staticmethod
    async def list_short_answer_sets(
        session: AsyncSession,
        user_id: uuid.UUID,
        subject_id: uuid.UUID,
    ) -> List[ShortAnswerSet]:
        await SubjectPersistenceService.get_subject(session, user_id, subject_id)
        stmt = (
            select(ShortAnswerSet)
            .where(and_(ShortAnswerSet.user_id == user_id, ShortAnswerSet.subject_id == subject_id))
            .order_by(ShortAnswerSet.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_short_answer_set(
        session: AsyncSession,
        user_id: uuid.UUID,
        set_id: uuid.UUID,
    ) -> ShortAnswerSet:
        stmt = (
            select(ShortAnswerSet)
            .where(and_(ShortAnswerSet.id == set_id, ShortAnswerSet.user_id == user_id))
            .options(
                selectinload(ShortAnswerSet.questions),
                selectinload(ShortAnswerSet.resource).selectinload(LearningResource.source_associations),
            )
        )
        result = await session.execute(stmt)
        sa_set = result.scalar_one_or_none()
        if not sa_set:
            raise EntityNotFoundError(f"Short answer set {set_id} not found or access denied")

        if sa_set.resource:
            sa_set.resource.view_count += 1
            sa_set.resource.last_viewed_at = utc_now()
            await session.flush()

        return sa_set

    @staticmethod
    async def start_practice_attempt(
        session: AsyncSession,
        user_id: uuid.UUID,
        short_answer_set_id: uuid.UUID,
    ) -> ShortAnswerAttempt:
        sa_set = await ShortAnswerPersistenceService.get_short_answer_set(session, user_id, short_answer_set_id)

        attempt = ShortAnswerAttempt(
            user_id=user_id,
            subject_id=sa_set.subject_id,
            short_answer_set_id=short_answer_set_id,
            started_at=utc_now(),
            status="in_progress",
        )
        session.add(attempt)
        await session.flush()

        activity = StudyActivity(
            user_id=user_id,
            subject_id=sa_set.subject_id,
            resource_id=sa_set.resource_id,
            activity_type="short_answer_started",
            occurred_at=utc_now(),
            metadata_={"attempt_id": str(attempt.id)},
        )
        session.add(activity)
        await session.flush()

        return attempt

    @staticmethod
    async def save_student_responses(
        session: AsyncSession,
        user_id: uuid.UUID,
        attempt_id: uuid.UUID,
        responses_data: List[Dict[str, Any]],
        evaluated_data: Optional[Dict[uuid.UUID, Dict[str, Any]]] = None,
    ) -> ShortAnswerAttempt:
        attempt = await session.get(ShortAnswerAttempt, attempt_id)
        if not attempt or attempt.user_id != user_id:
            raise PermissionDeniedError(f"Attempt {attempt_id} not found or access denied")

        for item in responses_data:
            q_id = item["question_id"]
            student_ans = item["student_answer"]

            stmt = select(ShortAnswerResponse).where(
                and_(
                    ShortAnswerResponse.attempt_id == attempt_id,
                    ShortAnswerResponse.question_id == q_id,
                )
            )
            response = (await session.execute(stmt)).scalar_one_or_none()

            eval_info = evaluated_data.get(q_id) if evaluated_data else None

            if response:
                response.student_answer = student_ans
                if eval_info:
                    response.feedback = eval_info.get("feedback")
                    response.score = eval_info.get("score")
                    response.status = "evaluated"
                    response.evaluated_at = utc_now()
                response.updated_at = utc_now()
            else:
                response = ShortAnswerResponse(
                    attempt_id=attempt_id,
                    question_id=q_id,
                    student_answer=student_ans,
                    feedback=eval_info.get("feedback") if eval_info else None,
                    score=eval_info.get("score") if eval_info else None,
                    status="evaluated" if eval_info else "pending_evaluation",
                    evaluated_at=utc_now() if eval_info else None,
                )
                session.add(response)

        attempt.status = "completed"
        attempt.submitted_at = utc_now()

        # Calculate scores if evaluated
        if evaluated_data:
            total = sum(e.get("score", 0.0) for e in evaluated_data.values() if e.get("score") is not None)
            attempt.total_score = total

        # Log activity
        activity = StudyActivity(
            user_id=user_id,
            subject_id=attempt.subject_id,
            resource_id=None,
            activity_type="short_answer_submitted",
            occurred_at=utc_now(),
            metadata_={"attempt_id": str(attempt.id)},
        )
        session.add(activity)
        await session.flush()

        return attempt

    @staticmethod
    async def get_short_answer_attempt(
        session: AsyncSession,
        user_id: uuid.UUID,
        attempt_id: uuid.UUID,
    ) -> ShortAnswerAttempt:
        stmt = (
            select(ShortAnswerAttempt)
            .where(and_(ShortAnswerAttempt.id == attempt_id, ShortAnswerAttempt.user_id == user_id))
            .options(
                selectinload(ShortAnswerAttempt.responses).joinedload(ShortAnswerResponse.question),
            )
        )
        result = await session.execute(stmt)
        attempt = result.scalar_one_or_none()
        if not attempt:
            raise EntityNotFoundError(f"Attempt {attempt_id} not found or access denied")
        return attempt

    @staticmethod
    async def list_practice_history(
        session: AsyncSession,
        user_id: uuid.UUID,
        short_answer_set_id: uuid.UUID,
    ) -> List[ShortAnswerAttempt]:
        stmt = (
            select(ShortAnswerAttempt)
            .where(
                and_(
                    ShortAnswerAttempt.short_answer_set_id == short_answer_set_id,
                    ShortAnswerAttempt.user_id == user_id,
                )
            )
            .order_by(ShortAnswerAttempt.started_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


# --- Study Activity & Resource Views ---

class StudyActivityPersistenceService:
    @staticmethod
    async def record_view(
        session: AsyncSession,
        user_id: uuid.UUID,
        resource_id: uuid.UUID,
    ) -> Tuple[int, datetime]:
        resource = await session.get(LearningResource, resource_id)
        if not resource or resource.user_id != user_id:
            raise PermissionDeniedError(f"Resource {resource_id} not found or access denied")

        resource.view_count += 1
        now = utc_now()
        resource.last_viewed_at = now

        activity = StudyActivity(
            user_id=user_id,
            subject_id=resource.subject_id,
            resource_id=resource.id,
            activity_type="resource_viewed",
            occurred_at=now,
            metadata_={"type": resource.resource_type, "title": resource.title},
        )
        session.add(activity)
        await session.flush()
        return resource.view_count, resource.last_viewed_at

    @staticmethod
    async def get_recent_activities(
        session: AsyncSession,
        user_id: uuid.UUID,
        subject_id: uuid.UUID,
        limit: int = 50,
    ) -> List[StudyActivity]:
        await SubjectPersistenceService.get_subject(session, user_id, subject_id)
        stmt = (
            select(StudyActivity)
            .where(
                and_(StudyActivity.user_id == user_id, StudyActivity.subject_id == subject_id)
            )
            .order_by(StudyActivity.occurred_at.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())
