"""Initial migration enabling the pgvector extension

Revision ID: 0001_pgvector
Revises: 
Create Date: 2026-09-22 13:50:00.000000

"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_pgvector"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable the pgvector extension for future dense vector similarity search if available.
    # No application tables are created in the scaffolding phase.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
                CREATE EXTENSION IF NOT EXISTS vector;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
                DROP EXTENSION IF EXISTS vector;
            END IF;
        END $$;
        """
    )
