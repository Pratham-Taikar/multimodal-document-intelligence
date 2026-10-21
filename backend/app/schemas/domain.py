"""Pydantic schemas for Multimodal Document Intelligence persistence layer."""

import uuid
from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, Field


class SchemaBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Users ---

class UserBase(SchemaBase):
    email: str
    name: str = "User"


class UserCreate(UserBase):
    password: Optional[str] = None
    mongo_id: Optional[str] = None


class UserRead(UserBase):
    id: uuid.UUID
    mongo_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# --- Subjects ---

class SubjectBase(SchemaBase):
    name: str
    description: Optional[str] = None


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(SchemaBase):
    name: Optional[str] = None
    description: Optional[str] = None
    archived_at: Optional[datetime] = None


class SubjectRead(SubjectBase):
    id: uuid.UUID
    user_id: uuid.UUID
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class SubjectDetailRead(SubjectRead):
    document_count: int = 0
    resource_count: int = 0


# --- Documents ---

class DocumentBase(SchemaBase):
    original_filename: str
    display_name: str
    file_type: str
    mime_type: str
    file_size_bytes: int = 0
    content_hash: Optional[str] = None
    storage_key: str


class DocumentCreate(DocumentBase):
    processing_status: str = "uploaded"


class DocumentVersionRead(SchemaBase):
    id: uuid.UUID
    document_id: uuid.UUID
    version_number: int
    storage_key: str
    file_size_bytes: int
    content_hash: Optional[str] = None
    created_at: datetime


class DocumentRead(DocumentBase):
    id: uuid.UUID
    user_id: uuid.UUID
    subject_id: uuid.UUID
    processing_status: str
    processing_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    versions: List[DocumentVersionRead] = []


class DocumentStatusRead(SchemaBase):
    id: uuid.UUID
    processing_status: str
    processing_error: Optional[str] = None
    updated_at: datetime


# --- Source Document / Evidence Association ---

class SourceAssociationCreate(SchemaBase):
    document_id: uuid.UUID
    document_version_id: Optional[uuid.UUID] = None
    evidence_id: Optional[uuid.UUID] = None
    source_snapshot: Optional[Dict[str, Any]] = None


class SourceAssociationRead(SchemaBase):
    id: uuid.UUID
    resource_id: uuid.UUID
    document_id: uuid.UUID
    document_version_id: Optional[uuid.UUID] = None
    evidence_id: Optional[uuid.UUID] = None
    source_snapshot: Optional[Dict[str, Any]] = None
    created_at: datetime


# --- Learning Resources ---

class LearningResourceRead(SchemaBase):
    id: uuid.UUID
    user_id: uuid.UUID
    subject_id: uuid.UUID
    resource_type: str
    title: str
    generation_status: str
    generation_parameters: Optional[Dict[str, Any]] = None
    source_snapshot: Optional[Dict[str, Any]] = None
    view_count: int
    last_viewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    source_associations: List[SourceAssociationRead] = []


# --- MCQ Sets, Questions, Options ---

class MCQOptionCreate(SchemaBase):
    option_text: str
    option_label: str  # A, B, C, D
    option_order: int


class MCQOptionRead(SchemaBase):
    id: uuid.UUID
    option_text: str
    option_label: str
    option_order: int


class MCQQuestionCreate(SchemaBase):
    question_text: str
    explanation: Optional[str] = None
    difficulty: Optional[str] = None
    question_order: int
    correct_option_label: Optional[str] = None  # Used when creating to match label
    options: List[MCQOptionCreate]


class MCQQuestionRead(SchemaBase):
    id: uuid.UUID
    question_text: str
    explanation: Optional[str] = None
    difficulty: Optional[str] = None
    question_order: int
    correct_option_id: Optional[uuid.UUID] = None  # None in test-taking mode
    options: List[MCQOptionRead] = []


class MCQSetCreate(SchemaBase):
    title: str
    description: Optional[str] = None
    difficulty: Optional[str] = None
    questions: List[MCQQuestionCreate]
    generation_parameters: Optional[Dict[str, Any]] = None
    sources: Optional[List[SourceAssociationCreate]] = None


class MCQSetRead(SchemaBase):
    id: uuid.UUID
    user_id: uuid.UUID
    subject_id: uuid.UUID
    resource_id: uuid.UUID
    title: str
    description: Optional[str] = None
    difficulty: Optional[str] = None
    question_count: int
    generation_parameters: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    questions: List[MCQQuestionRead] = []
    source_associations: List[SourceAssociationRead] = []


# --- Assessments & Attempts ---

class AssessmentCreate(SchemaBase):
    title: str
    description: Optional[str] = None
    mcq_set_id: uuid.UUID


class AssessmentRead(SchemaBase):
    id: uuid.UUID
    user_id: uuid.UUID
    subject_id: uuid.UUID
    resource_id: uuid.UUID
    title: str
    description: Optional[str] = None
    mcq_set_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class AssessmentAnswerInput(SchemaBase):
    question_id: uuid.UUID
    selected_option_id: Optional[uuid.UUID] = None


class AssessmentAttemptAnswerRead(SchemaBase):
    id: uuid.UUID
    attempt_id: uuid.UUID
    question_id: uuid.UUID
    selected_option_id: Optional[uuid.UUID] = None
    is_correct: Optional[bool] = None
    points_awarded: float
    answered_at: datetime


class AssessmentAttemptRead(SchemaBase):
    id: uuid.UUID
    user_id: uuid.UUID
    subject_id: uuid.UUID
    assessment_id: uuid.UUID
    started_at: datetime
    submitted_at: Optional[datetime] = None
    status: str
    score: float
    max_score: float
    percentage: float
    correct_count: int
    incorrect_count: int
    unanswered_count: int
    duration_seconds: Optional[int] = None
    created_at: datetime
    answers: List[AssessmentAttemptAnswerRead] = []


class AssessmentSubmitInput(SchemaBase):
    answers: List[AssessmentAnswerInput] = []
    duration_seconds: Optional[int] = None


# --- Short Answer Sets & Attempts ---

class ShortAnswerQuestionCreate(SchemaBase):
    question_text: str
    model_answer: str
    hint: Optional[str] = None
    question_order: int
    max_score: float = 1.0


class ShortAnswerQuestionRead(SchemaBase):
    id: uuid.UUID
    question_text: str
    model_answer: str
    hint: Optional[str] = None
    question_order: int
    max_score: float


class ShortAnswerSetCreate(SchemaBase):
    title: str
    description: Optional[str] = None
    difficulty: Optional[str] = None
    questions: List[ShortAnswerQuestionCreate]
    generation_parameters: Optional[Dict[str, Any]] = None
    sources: Optional[List[SourceAssociationCreate]] = None


class ShortAnswerSetRead(SchemaBase):
    id: uuid.UUID
    user_id: uuid.UUID
    subject_id: uuid.UUID
    resource_id: uuid.UUID
    title: str
    description: Optional[str] = None
    difficulty: Optional[str] = None
    question_count: int
    generation_parameters: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    questions: List[ShortAnswerQuestionRead] = []
    source_associations: List[SourceAssociationRead] = []


class ShortAnswerResponseInput(SchemaBase):
    question_id: uuid.UUID
    student_answer: str


class ShortAnswerResponseRead(SchemaBase):
    id: uuid.UUID
    attempt_id: uuid.UUID
    question_id: uuid.UUID
    student_answer: str
    feedback: Optional[str] = None
    score: Optional[float] = None
    status: str
    evaluated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ShortAnswerAttemptRead(SchemaBase):
    id: uuid.UUID
    user_id: uuid.UUID
    subject_id: uuid.UUID
    short_answer_set_id: uuid.UUID
    started_at: datetime
    submitted_at: Optional[datetime] = None
    status: str
    total_score: Optional[float] = None
    max_score: Optional[float] = None
    feedback: Optional[str] = None
    created_at: datetime
    responses: List[ShortAnswerResponseRead] = []


class ShortAnswerSubmitInput(SchemaBase):
    responses: List[ShortAnswerResponseInput] = []
    feedback: Optional[str] = None
    total_score: Optional[float] = None


# --- Study Activity ---

class StudyActivityCreate(SchemaBase):
    subject_id: uuid.UUID
    resource_id: Optional[uuid.UUID] = None
    document_id: Optional[uuid.UUID] = None
    activity_type: str
    metadata: Optional[Dict[str, Any]] = Field(default=None, alias="metadata_")


class StudyActivityRead(SchemaBase):
    id: uuid.UUID
    user_id: uuid.UUID
    subject_id: uuid.UUID
    resource_id: Optional[uuid.UUID] = None
    document_id: Optional[uuid.UUID] = None
    activity_type: str
    occurred_at: datetime
    metadata_: Optional[Dict[str, Any]] = Field(default=None, alias="metadata")
