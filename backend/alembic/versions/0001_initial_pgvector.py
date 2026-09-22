"""Initial migration enabling pgvector and uuid extensions

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
    # Enable pgvector extension for dense vector similarity search
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    # Enable uuid-ossp extension for UUID generation
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS vector;")
    op.execute('DROP EXTENSION IF EXISTS "uuid-ossp";')
