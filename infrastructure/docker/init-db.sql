-- Initialize the pgvector extension on the primary database.
-- (PostgreSQL 13+ provides gen_random_uuid() in core, so no uuid-ossp needed.)
CREATE EXTENSION IF NOT EXISTS vector;
