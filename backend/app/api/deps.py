"""API Dependencies: Database sessions and authenticated user resolution."""

import uuid
from typing import Optional
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.entities import User
from app.core.exceptions import PermissionDeniedError


async def get_current_user(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    session: AsyncSession = Depends(get_db),
) -> User:
    """
    Resolves the authenticated User from request headers.
    Enforces that all database operations belong to this authenticated user.
    """
    user_identifier = x_user_id
    if not user_identifier and authorization:
        # Support "Bearer <uuid>"
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            user_identifier = parts[1]

    if not user_identifier:
        # Default dev user fallback if none provided
        user_identifier = "default_user"

    # 1. Try parsing as UUID
    user = None
    try:
        user_uuid = uuid.UUID(user_identifier)
        user = await session.get(User, user_uuid)
    except ValueError:
        # Not a UUID; lookup by email or mongo_id
        stmt = select(User).where(
            (User.email == user_identifier) | (User.mongo_id == user_identifier)
        )
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

    if not user:
        # If user identifier was provided, create/find user or reject
        if user_identifier == "default_user":
            # Auto-provision default development user
            stmt = select(User).where(User.email == "dev@askmynotes.studio")
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()
            if not user:
                user = User(
                    email="dev@askmynotes.studio",
                    name="Studio Developer",
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"User {user_identifier} not authenticated or not found",
            )

    return user
