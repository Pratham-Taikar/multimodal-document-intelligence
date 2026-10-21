"""SQLAlchemy 2.0 ORM Models for Multimodal Document Intelligence."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict

from sqlalchemy import (
    String,
    Text,
    BigInteger,
    Integer,
    Numeric,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utc_now() -> datetime:
    """Return the current time in UTC with timezone awareness."""
    return datetime.now(timezone.utc)


class User(Base):
    """User account model representing ownership identity."""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="User")
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mongo_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    subjects: Mapped[List["Subject"]] = relationship(
        "Subject", back_populates="user", cascade="all, delete-orphan"
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document", back_populates="user", cascade="all, delete-orphan"
    )
    learning_resources: Mapped[List["LearningResource"]] = relationship(
        "LearningResource", back_populates="user", cascade="all, delete-orphan"
    )
    activities: Mapped[List["StudyActivity"]] = relationship(
        "StudyActivity", back_populates="user", cascade="all, delete-orphan"
    )


class Subject(Base):
    """Subject workspace owned by a single user."""
    __tablename__ = "subjects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="subjects")
    documents: Mapped[List["Document"]] = relationship(
        "Document", back_populates="subject", cascade="all, delete-orphan"
    )
    learning_resources: Mapped[List["LearningResource"]] = relationship(
        "LearningResource", back_populates="subject", cascade="all, delete-orphan"
    )
    activities: Mapped[List["StudyActivity"]] = relationship(
        "StudyActivity", back_populates="subject", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_subjects_user_updated", "user_id", "updated_at"),
    )


class Document(Base):
    """Document uploaded inside a user's subject."""
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    display_name: Mapped[str] = mapped_column(String(512), nullable=False)
    file_type: Mapped[str] = mapped_column(String(32), nullable=False)  # pdf, docx, pptx, txt
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    processing_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="uploaded"
    )  # uploaded, queued, processing, completed, failed
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="documents")
    subject: Mapped["Subject"] = relationship("Subject", back_populates="documents")
    versions: Mapped[List["DocumentVersion"]] = relationship(
        "DocumentVersion", back_populates="document", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "processing_status IN ('uploaded', 'queued', 'processing', 'completed', 'failed')",
            name="ck_document_processing_status",
        ),
        Index("ix_documents_user_subject_status", "user_id", "subject_id", "processing_status"),
    )


class DocumentVersion(Base):
    """Versioned snapshot of an ingested document."""
    __tablename__ = "document_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="versions")
    evidence_items: Mapped[List["DocumentEvidence"]] = relationship(
        "DocumentEvidence", back_populates="version", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("document_id", "version_number", name="uq_document_version_number"),
    )


class DocumentEvidence(Base):
    """Granular evidence unit (page, slide, text span, bounding box) extracted from a document version."""
    __tablename__ = "document_evidence"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    slide_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    element_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    element_type: Mapped[str] = mapped_column(String(64), nullable=False, default="text_block")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    bounding_box: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    parser_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    version: Mapped["DocumentVersion"] = relationship("DocumentVersion", back_populates="evidence_items")

    __table_args__ = (
        Index("ix_evidence_version_page", "document_version_id", "page_number"),
    )


class LearningResource(Base):
    """Common registry for all generated learning materials."""
    __tablename__ = "learning_resources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    generation_status: Mapped[str] = mapped_column(String(32), nullable=False, default="completed")
    generation_parameters: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    source_snapshot: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_viewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="learning_resources")
    subject: Mapped["Subject"] = relationship("Subject", back_populates="learning_resources")
    source_associations: Mapped[List["ResourceSourceAssociation"]] = relationship(
        "ResourceSourceAssociation", back_populates="resource", cascade="all, delete-orphan"
    )
    activities: Mapped[List["StudyActivity"]] = relationship(
        "StudyActivity", back_populates="resource", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "resource_type IN ('mcq_set', 'assessment', 'short_answer_set', 'flashcard_set', 'summary')",
            name="ck_resource_type",
        ),
        Index("ix_resources_user_subject_type", "user_id", "subject_id", "resource_type"),
    )


class ResourceSourceAssociation(Base):
    """Many-to-many source association between learning resources and documents/evidence."""
    __tablename__ = "resource_source_associations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("learning_resources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_versions.id", ondelete="SET NULL"), nullable=True
    )
    evidence_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_evidence.id", ondelete="SET NULL"), nullable=True
    )
    source_snapshot: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    resource: Mapped["LearningResource"] = relationship("LearningResource", back_populates="source_associations")
    document: Mapped["Document"] = relationship("Document")
    document_version: Mapped[Optional["DocumentVersion"]] = relationship("DocumentVersion")
    evidence: Mapped[Optional["DocumentEvidence"]] = relationship("DocumentEvidence")


class MCQSet(Base):
    """Generated MCQ Set containing ordered questions."""
    __tablename__ = "mcq_sets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("learning_resources.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    difficulty: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    question_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    generation_parameters: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    resource: Mapped["LearningResource"] = relationship("LearningResource")
    questions: Mapped[List["MCQQuestion"]] = relationship(
        "MCQQuestion", back_populates="mcq_set", cascade="all, delete-orphan", order_by="MCQQuestion.question_order"
    )
    assessments: Mapped[List["Assessment"]] = relationship("Assessment", back_populates="mcq_set")


class MCQQuestion(Base):
    """Individual question belonging to an MCQ Set."""
    __tablename__ = "mcq_questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    mcq_set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mcq_sets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    difficulty: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    question_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    correct_option_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    mcq_set: Mapped["MCQSet"] = relationship("MCQSet", back_populates="questions")
    options: Mapped[List["MCQOption"]] = relationship(
        "MCQOption", back_populates="question", cascade="all, delete-orphan", order_by="MCQOption.option_order"
    )

    __table_args__ = (
        Index("ix_mcq_questions_set_order", "mcq_set_id", "question_order"),
    )


class MCQOption(Base):
    """Individual option belonging to an MCQ Question."""
    __tablename__ = "mcq_options"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mcq_questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    option_text: Mapped[str] = mapped_column(Text, nullable=False)
    option_label: Mapped[str] = mapped_column(String(8), nullable=False)  # A, B, C, D
    option_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    question: Mapped["MCQQuestion"] = relationship("MCQQuestion", back_populates="options")

    __table_args__ = (
        Index("ix_mcq_options_question_order", "question_id", "option_order"),
    )


class Assessment(Base):
    """Assessment definition (test/quiz) derived from an MCQ set."""
    __tablename__ = "assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("learning_resources.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    mcq_set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mcq_sets.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    resource: Mapped["LearningResource"] = relationship("LearningResource")
    mcq_set: Mapped["MCQSet"] = relationship("MCQSet", back_populates="assessments")
    attempts: Mapped[List["AssessmentAttempt"]] = relationship(
        "AssessmentAttempt", back_populates="assessment", cascade="all, delete-orphan"
    )


class AssessmentAttempt(Base):
    """An individual student test attempt with server-scored results."""
    __tablename__ = "assessment_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="in_progress")  # in_progress, completed
    score: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0.0)
    max_score: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0.0)
    percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0.0)
    correct_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    incorrect_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unanswered_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    assessment: Mapped["Assessment"] = relationship("Assessment", back_populates="attempts")
    answers: Mapped[List["AssessmentAttemptAnswer"]] = relationship(
        "AssessmentAttemptAnswer", back_populates="attempt", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("status IN ('in_progress', 'completed')", name="ck_attempt_status"),
        Index("ix_attempts_user_assessment", "user_id", "assessment_id", "started_at"),
    )


class AssessmentAttemptAnswer(Base):
    """An individual recorded answer within an assessment attempt."""
    __tablename__ = "assessment_attempt_answers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessment_attempts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mcq_questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    selected_option_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mcq_options.id", ondelete="SET NULL"), nullable=True
    )
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    points_awarded: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0.0)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    attempt: Mapped["AssessmentAttempt"] = relationship("AssessmentAttempt", back_populates="answers")
    question: Mapped["MCQQuestion"] = relationship("MCQQuestion")
    selected_option: Mapped[Optional["MCQOption"]] = relationship("MCQOption")

    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_attempt_question"),
    )


class ShortAnswerSet(Base):
    """Generated conceptual Short Answer question set."""
    __tablename__ = "short_answer_sets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("learning_resources.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    difficulty: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    question_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    generation_parameters: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    resource: Mapped["LearningResource"] = relationship("LearningResource")
    questions: Mapped[List["ShortAnswerQuestion"]] = relationship(
        "ShortAnswerQuestion", back_populates="set", cascade="all, delete-orphan", order_by="ShortAnswerQuestion.question_order"
    )
    attempts: Mapped[List["ShortAnswerAttempt"]] = relationship(
        "ShortAnswerAttempt", back_populates="set", cascade="all, delete-orphan"
    )


class ShortAnswerQuestion(Base):
    """Individual question in a short-answer set."""
    __tablename__ = "short_answer_questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("short_answer_sets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    model_answer: Mapped[str] = mapped_column(Text, nullable=False)
    hint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    question_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_score: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    set: Mapped["ShortAnswerSet"] = relationship("ShortAnswerSet", back_populates="questions")

    __table_args__ = (
        Index("ix_short_answer_questions_set_order", "set_id", "question_order"),
    )


class ShortAnswerAttempt(Base):
    """Student practice attempt on a short answer set."""
    __tablename__ = "short_answer_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    short_answer_set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("short_answer_sets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="in_progress")
    total_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    max_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    set: Mapped["ShortAnswerSet"] = relationship("ShortAnswerSet", back_populates="attempts")
    responses: Mapped[List["ShortAnswerResponse"]] = relationship(
        "ShortAnswerResponse", back_populates="attempt", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("status IN ('in_progress', 'completed')", name="ck_sa_attempt_status"),
        Index("ix_sa_attempts_user_set", "user_id", "short_answer_set_id", "started_at"),
    )


class ShortAnswerResponse(Base):
    """Student answer and AI evaluation response for a question."""
    __tablename__ = "short_answer_responses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("short_answer_attempts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("short_answer_questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_answer: Mapped[str] = mapped_column(Text, nullable=False)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending_evaluation")
    evaluated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    attempt: Mapped["ShortAnswerAttempt"] = relationship("ShortAnswerAttempt", back_populates="responses")
    question: Mapped["ShortAnswerQuestion"] = relationship("ShortAnswerQuestion")

    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_sa_attempt_question"),
    )


class StudyActivity(Base):
    """Lightweight event tracking for student study activity and resource views."""
    __tablename__ = "study_activities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("learning_resources.id", ondelete="SET NULL"), nullable=True, index=True
    )
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    activity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    metadata_: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSONB, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="activities")
    subject: Mapped["Subject"] = relationship("Subject", back_populates="activities")
    resource: Mapped[Optional["LearningResource"]] = relationship("LearningResource", back_populates="activities")
    document: Mapped[Optional["Document"]] = relationship("Document")

    __table_args__ = (
        CheckConstraint(
            "activity_type IN ('resource_generated', 'resource_viewed', 'assessment_started', "
            "'assessment_submitted', 'short_answer_started', 'short_answer_submitted', 'document_opened')",
            name="ck_activity_type",
        ),
        Index("ix_activities_user_subject_time", "user_id", "subject_id", "occurred_at"),
    )
