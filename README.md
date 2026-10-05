# Multimodal Document Intelligence

A clean, modular, and grounded multimodal document intelligence platform designed to ingest complex documents (PDF, DOCX, PPTX, TXT), extract structured evidence, and provide high-fidelity answers and learning synthesis with verifiable citations.

## Architectural Principles

1. **Evidence as the Source of Truth**: The LLM is strictly a reasoning and presentation layer; factual claims trace directly to verifiable document coordinates.
2. **Lean & Resilient Infrastructure**: Built around PostgreSQL 16 with `pgvector` for relational, vector, and lexical search—eliminating unnecessary distributed service bloat (no Neo4j, Qdrant, Redis, or Celery in MVP).
3. **Transparent Provenance**: Preserves page numbers, bounding boxes, and relationships for all extracted text, tables, diagrams, and slides.
4. **Iterative Verification**: Developed via strict checkpointed progression (`UNDERSTAND -> DESIGN -> REVIEW -> GIT CHECKPOINT -> IMPLEMENT -> TEST -> REVIEW -> COMMIT -> NEXT COMPONENT`).

## Project Layout

```
├── backend/          # FastAPI application, SQLAlchemy async models, Alembic migrations
├── frontend/         # React 18 + Vite + TypeScript single-page application
├── infrastructure/   # Docker configurations and database initialization scripts
├── docs/             # Architecture, design decisions, and development guides
├── tests/            # Integration and end-to-end test suites
└── docker-compose.yml# Lightweight multi-container local development stack
```

## Quick Start (Local Development)

```bash
cp .env.example .env
docker compose up --build
```

* Frontend: http://localhost:5173
* Backend API: http://localhost:8000 (docs at `/docs`, health at `/api/v1/health`)
* PostgreSQL 16 + pgvector: `localhost:5433`

Refer to [docs/development.md](docs/development.md) for detailed setup, environment variables, testing, and migrations.
