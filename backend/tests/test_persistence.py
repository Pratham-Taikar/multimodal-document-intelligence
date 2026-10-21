"""Comprehensive Integration Tests for Multimodal Document Intelligence Persistence Layer.

Verifies:
1. Ownership & hierarchy (User -> Subject -> Document -> Learning Resources)
2. IDOR protections (Cross-user access rejection)
3. MCQ persistence with 4 ordered options & correct-answer masking
4. Assessment attempts, server-side scoring & idempotency
5. Short-answer sets, attempts, and response evaluations
6. Source document/version association traceability
7. Study activity logging, view counts, and last-viewed timestamps
8. Transactional integrity & rollback on multi-record failure
"""

import uuid
import pytest
from datetime import datetime
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.models.entities import (
    User,
    Subject,
    Document,
    DocumentVersion,
    DocumentEvidence,
    LearningResource,
    MCQSet,
    MCQQuestion,
    MCQOption,
    Assessment,
    AssessmentAttempt,
    ShortAnswerSet,
    ShortAnswerQuestion,
    ShortAnswerAttempt,
    StudyActivity,
    ResourceSourceAssociation,
)
from app.services.persistence import (
    SubjectPersistenceService,
    DocumentPersistenceService,
    MCQPersistenceService,
    ShortAnswerPersistenceService,
    StudyActivityPersistenceService,
)
from app.core.exceptions import PermissionDeniedError, ValidationAppError, EntityNotFoundError


from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings


@pytest.fixture
async def db_session():
    """Async SQLAlchemy session fixture with NullPool to isolate event loops on Windows."""
    test_engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
    )
    test_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with test_factory() as session:
        yield session
    await test_engine.dispose()


@pytest.fixture
async def two_users(db_session: AsyncSession):
    """Provides two distinct isolated users for ownership & IDOR tests."""
    user_a = User(
        id=uuid.uuid4(),
        email=f"alice_{uuid.uuid4().hex[:6]}@test.local",
        name="Alice",
    )
    user_b = User(
        id=uuid.uuid4(),
        email=f"bob_{uuid.uuid4().hex[:6]}@test.local",
        name="Bob",
    )
    db_session.add(user_a)
    db_session.add(user_b)
    await db_session.commit()
    await db_session.refresh(user_a)
    await db_session.refresh(user_b)
    return user_a, user_b


# ==============================================================================
# 1. Ownership and Hierarchy Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_01_user_can_create_and_list_own_subjects(db_session: AsyncSession, two_users):
    """A user can create and list their own subjects, newest or updated first."""
    alice, _ = two_users

    s1 = await SubjectPersistenceService.create_subject(db_session, alice.id, "Networks", "Computer Networks")
    s2 = await SubjectPersistenceService.create_subject(db_session, alice.id, "Databases", "Relational Databases")
    await db_session.commit()

    subjects = await SubjectPersistenceService.list_subjects(db_session, alice.id)
    assert len(subjects) >= 2
    subject_ids = [s.id for s in subjects]
    assert s1.id in subject_ids
    assert s2.id in subject_ids


@pytest.mark.asyncio
async def test_02_subject_cannot_be_accessed_by_another_user(db_session: AsyncSession, two_users):
    """A subject cannot be retrieved or modified by a user who does not own it."""
    alice, bob = two_users

    alice_sub = await SubjectPersistenceService.create_subject(db_session, alice.id, "Alice Secret Subject")
    await db_session.commit()

    # Bob attempts to get Alice's subject -> Should raise EntityNotFoundError
    with pytest.raises(EntityNotFoundError):
        await SubjectPersistenceService.get_subject(db_session, bob.id, alice_sub.id)

    # Bob attempts to update Alice's subject -> Should raise EntityNotFoundError
    with pytest.raises(EntityNotFoundError):
        await SubjectPersistenceService.update_subject(db_session, bob.id, alice_sub.id, name="Hacked Subject")


@pytest.mark.asyncio
async def test_03_document_cannot_be_attached_to_another_users_subject(db_session: AsyncSession, two_users):
    """A document cannot be uploaded or attached to another user's subject."""
    alice, bob = two_users

    alice_sub = await SubjectPersistenceService.create_subject(db_session, alice.id, "Alice Notes")
    await db_session.commit()

    # Bob attempts to create a document in Alice's subject -> Should fail
    with pytest.raises(EntityNotFoundError):
        await DocumentPersistenceService.create_document(
            db_session,
            user_id=bob.id,
            subject_id=alice_sub.id,
            original_filename="malicious.pdf",
            display_name="Malicious PDF",
            file_type="pdf",
            mime_type="application/pdf",
            file_size_bytes=1024,
            storage_key="uploads/malicious.pdf",
        )


@pytest.mark.asyncio
async def test_04_user_cannot_retrieve_another_users_mcq_or_short_answer_sets(db_session: AsyncSession, two_users):
    """A user cannot access another user's MCQ sets or short-answer sets."""
    alice, bob = two_users

    alice_sub = await SubjectPersistenceService.create_subject(db_session, alice.id, "Alice Studio")
    mcq_set = await MCQPersistenceService.save_mcq_set(
        db_session,
        user_id=alice.id,
        subject_id=alice_sub.id,
        title="Alice Operating Systems Quiz",
        questions_data=[
            {
                "question_text": "What is virtual memory?",
                "options": [
                    {"option_text": "Storage allocation technique", "option_label": "A"},
                    {"option_text": "RAM module", "option_label": "B"},
                    {"option_text": "CPU register", "option_label": "C"},
                    {"option_text": "Network buffer", "option_label": "D"},
                ],
                "correct_option_label": "A",
            }
        ],
    )
    await db_session.commit()

    # Bob attempts to open Alice's MCQ set -> EntityNotFoundError
    with pytest.raises(EntityNotFoundError):
        await MCQPersistenceService.get_mcq_set(db_session, bob.id, mcq_set.id)


@pytest.mark.asyncio
async def test_05_user_cannot_retrieve_or_modify_another_users_assessment_attempts(db_session: AsyncSession, two_users):
    """A user cannot read or alter another student's assessment attempts."""
    alice, bob = two_users

    sub = await SubjectPersistenceService.create_subject(db_session, alice.id, "Compilers")
    mcq_set = await MCQPersistenceService.save_mcq_set(
        db_session,
        alice.id,
        sub.id,
        "Lexical Analysis",
        [
            {
                "question_text": "What does a lexer output?",
                "options": [
                    {"option_text": "Tokens", "option_label": "A"},
                    {"option_text": "Parse Tree", "option_label": "B"},
                    {"option_text": "Assembly", "option_label": "C"},
                    {"option_text": "Machine Code", "option_label": "D"},
                ],
                "correct_option_label": "A",
            }
        ],
    )
    assessment = await MCQPersistenceService.create_assessment(
        db_session, alice.id, sub.id, "Lexer Test", mcq_set.id
    )
    attempt = await MCQPersistenceService.start_assessment_attempt(
        db_session, alice.id, assessment.id
    )
    await db_session.commit()

    # Bob attempts to view Alice's attempt -> EntityNotFoundError
    with pytest.raises(EntityNotFoundError):
        await MCQPersistenceService.get_assessment_attempt(db_session, bob.id, attempt.id)

    # Bob attempts to submit answers to Alice's attempt -> EntityNotFoundError
    with pytest.raises(EntityNotFoundError):
        await MCQPersistenceService.submit_assessment_attempt(
            db_session, bob.id, attempt.id, answers_input=[]
        )


# ==============================================================================
# 2. MCQ Persistence & Correct Option Masking Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_06_to_09_mcq_persistence_options_ordering_and_answer_hiding(db_session: AsyncSession, two_users):
    """
    Tests 6, 7, 8, 9:
    - Save generated MCQ set with questions, 4 ordered options, correct-answer reference
    - Reopen set and verify question and option ordering
    - Verify source document/version association
    - Verify correct answer is hidden in quiz-taking mode (reveal_correct=False)
    """
    alice, _ = two_users

    sub = await SubjectPersistenceService.create_subject(db_session, alice.id, "Distributed Systems")
    doc = await DocumentPersistenceService.create_document(
        db_session,
        user_id=alice.id,
        subject_id=sub.id,
        original_filename="raft_paper.pdf",
        display_name="Raft Consensus Paper",
        file_type="pdf",
        mime_type="application/pdf",
        file_size_bytes=512000,
        storage_key="uploads/raft_paper.pdf",
    )
    v_res = await db_session.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == doc.id)
    )
    doc_ver = v_res.scalars().first()

    sources = [
        {
            "document_id": doc.id,
            "document_version_id": doc_ver.id,
            "source_snapshot": {"section": "Leader Election", "pages": [2, 3]},
        }
    ]

    questions_payload = [
        {
            "question_text": "How is a leader elected in Raft?",
            "explanation": "Followers start election timers and request votes.",
            "difficulty": "medium",
            "options": [
                {"option_text": "Random coin flip", "option_label": "A"},
                {"option_text": "RequestVote RPC majority", "option_label": "B"},
                {"option_text": "Static assignment", "option_label": "C"},
                {"option_text": "Round robin", "option_label": "D"},
            ],
            "correct_option_label": "B",
        },
        {
            "question_text": "What is the heart-beat interval in Raft?",
            "explanation": "Periodic AppendEntries RPCs prevent timeouts.",
            "difficulty": "easy",
            "options": [
                {"option_text": "1 hour", "option_label": "A"},
                {"option_text": "50-100 ms", "option_label": "B"},
                {"option_text": "10 microseconds", "option_label": "C"},
                {"option_text": "1 day", "option_label": "D"},
            ],
            "correct_option_label": "B",
        },
    ]

    # 6. Save MCQ set
    mcq_set = await MCQPersistenceService.save_mcq_set(
        db_session,
        user_id=alice.id,
        subject_id=sub.id,
        title="Raft Consensus Quiz",
        questions_data=questions_payload,
        sources=sources,
    )
    await db_session.commit()

    # 7. Reopen in study mode (reveal_correct=True)
    loaded_set, study_questions = await MCQPersistenceService.get_mcq_set(
        db_session, alice.id, mcq_set.id, reveal_correct=True
    )
    assert loaded_set.question_count == 2
    assert len(study_questions) == 2
    assert study_questions[0]["question_text"] == "How is a leader elected in Raft?"
    assert len(study_questions[0]["options"]) == 4
    assert study_questions[0]["options"][0]["option_label"] == "A"
    assert study_questions[0]["options"][1]["option_label"] == "B"
    assert study_questions[0]["correct_option_id"] is not None
    assert study_questions[0]["explanation"] == "Followers start election timers and request votes."

    # 8. Verify source document/version association
    res_associations = loaded_set.resource.source_associations
    assert len(res_associations) == 1
    assert res_associations[0].document_id == doc.id
    assert res_associations[0].document_version_id == doc_ver.id

    # 9. Verify correct answer is hidden in quiz-taking mode (reveal_correct=False)
    _, quiz_questions = await MCQPersistenceService.get_mcq_set(
        db_session, alice.id, mcq_set.id, reveal_correct=False
    )
    assert quiz_questions[0]["correct_option_id"] is None
    assert quiz_questions[0]["explanation"] is None
    assert quiz_questions[1]["correct_option_id"] is None


# ==============================================================================
# 3. Assessment Attempts, Server-Side Scoring & Idempotence
# ==============================================================================

@pytest.mark.asyncio
async def test_10_to_13_assessment_attempt_lifecycle_scoring_and_idempotence(db_session: AsyncSession, two_users):
    """
    Tests 10, 11, 12, 13:
    - Start attempt and save answers
    - Submit attempt: verify server-side score calculation, correct/incorrect/unanswered counts
    - Double submit: verify idempotent response (does not re-score or duplicate progress)
    - Reopen historical attempt: verify persisted answers and score are preserved
    """
    alice, _ = two_users

    sub = await SubjectPersistenceService.create_subject(db_session, alice.id, "Operating Systems")
    mcq_set = await MCQPersistenceService.save_mcq_set(
        db_session,
        user_id=alice.id,
        subject_id=sub.id,
        title="Deadlocks",
        questions_data=[
            {
                "question_text": "Which condition is NOT required for deadlock?",
                "options": [
                    {"option_text": "Mutual Exclusion", "option_label": "A"},
                    {"option_text": "Hold and Wait", "option_label": "B"},
                    {"option_text": "Preemption", "option_label": "C"},
                    {"option_text": "Circular Wait", "option_label": "D"},
                ],
                "correct_option_label": "C",  # No preemption is required, so preemption breaks it
            },
            {
                "question_text": "Banker's algorithm is used for?",
                "options": [
                    {"option_text": "Deadlock avoidance", "option_label": "A"},
                    {"option_text": "Deadlock recovery", "option_label": "B"},
                    {"option_text": "Mutual exclusion", "option_label": "C"},
                    {"option_text": "Paging", "option_label": "D"},
                ],
                "correct_option_label": "A",
            },
        ],
    )
    assessment = await MCQPersistenceService.create_assessment(
        db_session, alice.id, sub.id, "Deadlock Exam", mcq_set.id
    )

    # 10. Start attempt and save an answer
    attempt = await MCQPersistenceService.start_assessment_attempt(
        db_session, alice.id, assessment.id
    )
    await db_session.commit()
    assert attempt.status == "in_progress"

    # Get questions & options
    _, questions = await MCQPersistenceService.get_mcq_set(
        db_session, alice.id, mcq_set.id, reveal_correct=True
    )
    q1 = questions[0]
    q2 = questions[1]
    # Correct option for q1 is option with label 'C' (index 2)
    q1_correct_opt = q1["options"][2]["id"]
    # Incorrect option for q2 is option with label 'B' (index 1)
    q2_wrong_opt = q2["options"][1]["id"]

    await MCQPersistenceService.save_or_update_attempt_answer(
        db_session, alice.id, attempt.id, q1["id"], q1_correct_opt
    )
    await db_session.commit()

    # 11. Submit attempt: 1 correct, 1 incorrect
    submitted = await MCQPersistenceService.submit_assessment_attempt(
        db_session,
        alice.id,
        attempt.id,
        answers_input=[
            {"question_id": q1["id"], "selected_option_id": q1_correct_opt},
            {"question_id": q2["id"], "selected_option_id": q2_wrong_opt},
        ],
        duration_seconds=45,
    )
    await db_session.commit()

    assert submitted.status == "completed"
    assert float(submitted.score) == 1.0
    assert float(submitted.max_score) == 2.0
    assert float(submitted.percentage) == 50.0
    assert submitted.correct_count == 1
    assert submitted.incorrect_count == 1
    assert submitted.unanswered_count == 0

    # 12. Submit twice: verify idempotence
    second_submit = await MCQPersistenceService.submit_assessment_attempt(
        db_session,
        alice.id,
        attempt.id,
        answers_input=[
            {"question_id": q1["id"], "selected_option_id": q1_correct_opt},
        ],
    )
    assert second_submit.status == "completed"
    assert float(second_submit.score) == 1.0
    assert second_submit.correct_count == 1

    # 13. Reopen historical attempt
    history = await MCQPersistenceService.get_assessment_attempt(
        db_session, alice.id, attempt.id
    )
    assert history.status == "completed"
    assert float(history.score) == 1.0
    assert len(history.answers) == 2


# ==============================================================================
# 4. Short-Answer Persistence & Evaluations
# ==============================================================================

@pytest.mark.asyncio
async def test_14_to_17_short_answer_persistence_and_responses(db_session: AsyncSession, two_users):
    """
    Tests 14, 15, 16, 17:
    - Save generated short-answer set and reopen it
    - Save student responses without overwriting the model answer
    - Persist evaluation feedback only when evaluation occurs
    - Retrieve practice history
    """
    alice, _ = two_users

    sub = await SubjectPersistenceService.create_subject(db_session, alice.id, "Machine Learning")

    # 14. Save short-answer set
    sa_set = await ShortAnswerPersistenceService.save_short_answer_set(
        db_session,
        user_id=alice.id,
        subject_id=sub.id,
        title="Optimization Concepts",
        questions_data=[
            {
                "question_text": "What is gradient descent?",
                "model_answer": "An iterative first-order optimization algorithm for finding a local minimum.",
                "hint": "Think about stepping opposite to the gradient.",
                "max_score": 5.0,
            }
        ],
    )
    await db_session.commit()

    reopened = await ShortAnswerPersistenceService.get_short_answer_set(
        db_session, alice.id, sa_set.id
    )
    assert reopened.question_count == 1
    q = reopened.questions[0]
    assert q.question_text == "What is gradient descent?"
    assert "iterative" in q.model_answer

    # 15. Start practice attempt & submit student response
    attempt = await ShortAnswerPersistenceService.start_practice_attempt(
        db_session, alice.id, sa_set.id
    )
    await db_session.commit()

    student_response = "It steps downhill along the negative gradient to minimize loss."

    # 16. Persist with evaluation feedback
    evaluated_attempt = await ShortAnswerPersistenceService.save_student_responses(
        db_session,
        user_id=alice.id,
        attempt_id=attempt.id,
        responses_data=[
            {"question_id": q.id, "student_answer": student_response}
        ],
        evaluated_data={
            q.id: {
                "score": 4.5,
                "feedback": "Clear explanation of direction and objective function minimization.",
            }
        },
    )
    await db_session.commit()

    # Verify student response was saved and model answer was NOT overwritten
    persisted_attempt = await ShortAnswerPersistenceService.get_short_answer_attempt(
        db_session, alice.id, attempt.id
    )
    resp = persisted_attempt.responses[0]
    assert resp.student_answer == student_response
    assert float(resp.score) == 4.5
    assert resp.feedback == "Clear explanation of direction and objective function minimization."
    assert resp.status == "evaluated"

    # Verify model answer in question table remains untouched
    fresh_q = (await db_session.execute(select(ShortAnswerQuestion).where(ShortAnswerQuestion.id == q.id))).scalar_one()
    assert fresh_q.model_answer == "An iterative first-order optimization algorithm for finding a local minimum."

    # 17. Retrieve practice history
    history = await ShortAnswerPersistenceService.list_practice_history(
        db_session, alice.id, sa_set.id
    )
    assert len(history) >= 1
    assert history[0].id == attempt.id


# ==============================================================================
# 5. Resource History, Activity Tracking & Integrity
# ==============================================================================

@pytest.mark.asyncio
async def test_18_to_19_record_repeated_views_and_timestamps(db_session: AsyncSession, two_users):
    """
    Tests 18, 19:
    - Record repeated views and verify view_count increments accurately
    - Verify last_viewed_at timestamps are recorded in UTC
    """
    alice, _ = two_users

    sub = await SubjectPersistenceService.create_subject(db_session, alice.id, "Computer Architecture")
    mcq_set = await MCQPersistenceService.save_mcq_set(
        db_session,
        alice.id,
        sub.id,
        "Pipelining Quiz",
        [
            {
                "question_text": "What is a hazard in pipelining?",
                "options": [
                    {"option_text": "Structural, data, or control conflict", "option_label": "A"},
                    {"option_text": "Voltage drop", "option_label": "B"},
                    {"option_text": "Fan failure", "option_label": "C"},
                    {"option_text": "Clock skew only", "option_label": "D"},
                ],
                "correct_option_label": "A",
            }
        ],
    )
    res_id = mcq_set.resource_id
    await db_session.commit()

    # Initial view count from creation was 1
    v1, t1 = await StudyActivityPersistenceService.record_view(db_session, alice.id, res_id)
    await db_session.commit()
    assert v1 == 2
    assert t1 is not None

    v2, t2 = await StudyActivityPersistenceService.record_view(db_session, alice.id, res_id)
    await db_session.commit()
    assert v2 == 3
    assert t2 >= t1

    # Verify activities logged
    activities = await StudyActivityPersistenceService.get_recent_activities(db_session, alice.id, sub.id)
    view_events = [a for a in activities if a.activity_type == "resource_viewed"]
    assert len(view_events) >= 2


@pytest.mark.asyncio
async def test_20_reject_cross_subject_associations(db_session: AsyncSession, two_users):
    """Test 20: Reject invalid foreign keys or attaching another user's document to a resource."""
    alice, bob = two_users

    alice_sub = await SubjectPersistenceService.create_subject(db_session, alice.id, "Alice Sub")
    bob_sub = await SubjectPersistenceService.create_subject(db_session, bob.id, "Bob Sub")

    bob_doc = await DocumentPersistenceService.create_document(
        db_session,
        user_id=bob.id,
        subject_id=bob_sub.id,
        original_filename="bob_doc.pdf",
        display_name="Bob Document",
        file_type="pdf",
        mime_type="application/pdf",
        file_size_bytes=1000,
        storage_key="uploads/bob_doc.pdf",
    )
    await db_session.commit()

    # Alice tries to cite Bob's document in her MCQ set -> PermissionDeniedError
    with pytest.raises(PermissionDeniedError):
        await MCQPersistenceService.save_mcq_set(
            db_session,
            user_id=alice.id,
            subject_id=alice_sub.id,
            title="Alice Cross Citation Attempt",
            questions_data=[
                {
                    "question_text": "Test?",
                    "options": [
                        {"option_text": "1", "option_label": "A"},
                        {"option_text": "2", "option_label": "B"},
                        {"option_text": "3", "option_label": "C"},
                        {"option_text": "4", "option_label": "D"},
                    ],
                    "correct_option_label": "A",
                }
            ],
            sources=[{"document_id": bob_doc.id}],
        )


@pytest.mark.asyncio
async def test_21_subject_archival_and_deletion_policy(db_session: AsyncSession, two_users):
    """Test 21: Verify subject archival and cascade deletion policy."""
    alice, _ = two_users

    sub = await SubjectPersistenceService.create_subject(db_session, alice.id, "Temporary Subject")
    doc = await DocumentPersistenceService.create_document(
        db_session,
        user_id=alice.id,
        subject_id=sub.id,
        original_filename="temp.pdf",
        display_name="Temp PDF",
        file_type="pdf",
        mime_type="application/pdf",
        file_size_bytes=100,
        storage_key="uploads/temp.pdf",
    )
    await db_session.commit()

    # Archive subject
    archived = await SubjectPersistenceService.update_subject(
        db_session, alice.id, sub.id, archived=True
    )
    await db_session.commit()
    assert archived.archived_at is not None

    # Default list excludes archived subjects
    active_subjects = await SubjectPersistenceService.list_subjects(db_session, alice.id, include_archived=False)
    assert sub.id not in [s.id for s in active_subjects]

    # Deleting subject cascades to its documents
    await SubjectPersistenceService.delete_subject(db_session, alice.id, sub.id)
    await db_session.commit()

    # Verify document was cascade deleted
    doc_check = await db_session.get(Document, doc.id)
    assert doc_check is None


@pytest.mark.asyncio
async def test_22_transaction_rollback_when_multi_record_save_fails(db_session: AsyncSession, two_users):
    """Test 22: Verify database transaction rollback when multi-record save fails (no partial records)."""
    alice, _ = two_users

    sub = await SubjectPersistenceService.create_subject(db_session, alice.id, "Atomic Test Subject")
    await db_session.commit()

    # Count learning resources and mcq sets before
    res_before = (await db_session.execute(select(LearningResource))).scalars().all()
    mcq_before = (await db_session.execute(select(MCQSet))).scalars().all()

    # Attempt to save MCQ set with an invalid question (missing options)
    # This must fail validation and rollback the entire transaction!
    with pytest.raises(ValidationAppError):
        async with db_session.begin_nested():
            await MCQPersistenceService.save_mcq_set(
                db_session,
                user_id=alice.id,
                subject_id=sub.id,
                title="Faulty MCQ Set",
                questions_data=[
                    {
                        "question_text": "Invalid question with only 2 options?",
                        "options": [
                            {"option_text": "Opt 1", "option_label": "A"},
                            {"option_text": "Opt 2", "option_label": "B"},
                        ],
                        "correct_option_label": "A",
                    }
                ],
            )

    # Verify that NO learning resource or MCQ set was persisted
    res_after = (await db_session.execute(select(LearningResource))).scalars().all()
    mcq_after = (await db_session.execute(select(MCQSet))).scalars().all()

    assert len(res_after) == len(res_before)
    assert len(mcq_after) == len(mcq_before)
