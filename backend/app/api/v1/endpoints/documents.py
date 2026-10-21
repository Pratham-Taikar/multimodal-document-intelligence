"""API endpoints for Document management and versioning."""

import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.entities import User
from app.schemas.domain import (
    DocumentCreate,
    DocumentRead,
    DocumentStatusRead,
)
from app.services.persistence import DocumentPersistenceService

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/{subject_id}", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def register_document(
    subject_id: uuid.UUID,
    payload: DocumentCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Register and create a new document record under a subject."""
    document = await DocumentPersistenceService.create_document(
        session=session,
        user_id=user.id,
        subject_id=subject_id,
        original_filename=payload.original_filename,
        display_name=payload.display_name,
        file_type=payload.file_type,
        mime_type=payload.mime_type,
        file_size_bytes=payload.file_size_bytes,
        storage_key=payload.storage_key,
        content_hash=payload.content_hash,
    )
    await session.commit()
    return await DocumentPersistenceService.get_document(
        session=session,
        user_id=user.id,
        document_id=document.id,
    )


@router.get("/{subject_id}", response_model=List[DocumentRead])
async def list_documents(
    subject_id: uuid.UUID,
    include_deleted: bool = False,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """List all documents in an authorized subject."""
    return await DocumentPersistenceService.list_documents(
        session=session,
        user_id=user.id,
        subject_id=subject_id,
        include_deleted=include_deleted,
    )


@router.get("/{subject_id}/{document_id}", response_model=DocumentRead)
async def get_document(
    subject_id: uuid.UUID,
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieve document metadata and version history."""
    return await DocumentPersistenceService.get_document(
        session=session,
        user_id=user.id,
        document_id=document_id,
    )


@router.get("/{subject_id}/{document_id}/status", response_model=DocumentStatusRead)
async def get_document_status(
    subject_id: uuid.UUID,
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Get document ingestion and processing status."""
    doc = await DocumentPersistenceService.get_document(
        session=session,
        user_id=user.id,
        document_id=document_id,
    )
    return DocumentStatusRead(
        id=doc.id,
        processing_status=doc.processing_status,
        processing_error=doc.processing_error,
        updated_at=doc.updated_at,
    )


@router.post("/{subject_id}/{document_id}/retry", response_model=DocumentStatusRead)
async def retry_document_processing(
    subject_id: uuid.UUID,
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Safely reset and retry failed document processing."""
    doc = await DocumentPersistenceService.update_processing_status(
        session=session,
        user_id=user.id,
        document_id=document_id,
        status="queued",
        error=None,
    )
    await session.commit()
    return DocumentStatusRead(
        id=doc.id,
        processing_status=doc.processing_status,
        processing_error=doc.processing_error,
        updated_at=doc.updated_at,
    )


@router.delete("/{subject_id}/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    subject_id: uuid.UUID,
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Safely soft-delete a document."""
    await DocumentPersistenceService.delete_document(
        session=session,
        user_id=user.id,
        document_id=document_id,
        soft_delete=True,
    )
    await session.commit()
