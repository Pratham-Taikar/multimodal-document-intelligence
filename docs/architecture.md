# System Architecture: Multimodal Document Intelligence

## 1. Executive Overview

The Multimodal Document Intelligence platform is an evidence-first document comprehension and study synthesis system. It processes complex multimodal documents (PDF, DOCX, PPTX, TXT), decomposes them into structured, provenance-bearing evidence units (text blocks, tables, diagrams, slides), and delivers grounded answers with verifiable citations.

### Core Architectural Axiom: Evidence as the Source of Truth
* The **document evidence** is the immutable source of factual truth.
* The **LLM** is strictly a reasoning and natural-language synthesis layer.
* Every synthesized answer must be grounded in and traceable to specific document coordinates (page index, bounding box `[x0, y0, x1, y1]`, or visual asset crop).
* The LLM never hallucinates citations; assertions lacking sufficient document grounding are rejected or flagged.

---

## 2. Repository Structure

```
.
├── frontend/           # React + Vite + TypeScript SPA (app shell, routing, API client)
├── backend/            # FastAPI app (app/api/v1, app/core, app/db), Alembic, pytest suite
├── infrastructure/     # Docker auxiliary files (database initialization scripts)
├── docs/               # architecture.md, development.md
├── tests/              # (reserved) cross-service integration & E2E tests
└── docker-compose.yml  # Local stack: postgres, backend, frontend
```

See [development.md](development.md) for the annotated tree and per-directory details.

---

## 3. Subsystems and Boundaries

```
+-------------------------------------------------------------------------------+
|                             Presentation Layer                                |
|                      (React 18 + Vite + TypeScript)                           |
+-------------------------------------------------------------------------------+
                                        |
                             HTTP / REST (JSON)
                                        v
+-------------------------------------------------------------------------------+
|                             Application Layer                                 |
|                     (FastAPI + Python 3.11 Async)                             |
|                                                                               |
|  - API Routing & Versioning (/api/v1)                                         |
|  - Typed Configuration Management (pydantic-settings)                         |
|  - Standardized Exception Handling & Logging                                  |
|  - Database Engine & Health Validation (SQLAlchemy 2.0 Async + asyncpg)       |
+-------------------------------------------------------------------------------+
                                        |
                          SQL / Vector / Full-Text Queries
                                        v
+-------------------------------------------------------------------------------+
|                              Persistence Layer                                |
|                        (PostgreSQL 16 + pgvector)                             |
|                                                                               |
|  - Relational Metadata & Audit Records                                        |
|  - Dense Vector Search (pgvector with HNSW index)                             |
|  - Sparse Full-Text Lexical Search (tsvector with GIN index)                  |
|  - Hierarchical Evidence Relationships (Adjacency model with recursive CTEs)  |
+-------------------------------------------------------------------------------+
```

> **Note**: The diagram describes the **target architecture**. The current
> phase (Phase 1 — scaffolding) implements only the application shell, routing,
> typed configuration, logging/error handling, the `/api/v1/health` endpoint,
> and database connectivity validation. Ingestion, retrieval, RAG, SSE
> streaming, and citations arrive in later, independently reviewed phases.

### Subsystem Responsibilities

1. **Frontend (`frontend/`)** — React SPA with a minimal application shell and
   client-side routing.
   - Consumes backend REST endpoints through same-origin `/api/*` URLs (proxied
     by the Vite dev server; see §5).
   - *Planned (later phases)*: document visualization, chat history, SSE stream
     rendering, interactive citation overlays.

2. **Backend (`backend/`)** — FastAPI application with versioned routing.
   - Provides `/api/v1` endpoints with typed Pydantic responses, structured
     JSON error handling, and CORS policy enforcement.
   - Owns configuration (`pydantic-settings`), logging, and the async database
     layer (SQLAlchemy 2.0 + asyncpg + Alembic).
   - *Planned (later phases)*: ingestion pipelines, retrieval orchestration,
     grounded RAG synthesis.

3. **Database (PostgreSQL 16 + pgvector, provisioned via `infrastructure/`)**:
   - Houses all operational state in a single PostgreSQL instance.
   - Eliminates the need for multiple disparate storage engines (no separate
     Qdrant, no Neo4j, no Redis).

---

## 4. Storage Architecture: Why Single-Store PostgreSQL 16 + pgvector?

Previous multimodal architectures commonly introduce severe infrastructure complexity:
* Qdrant/Pinecone for vector search.
* Neo4j for relationship graphs.
* Redis for caching and message queues.
* Elasticsearch/OpenSearch for keyword search.

In this platform, **PostgreSQL 16 with `pgvector` fulfills all four requirements natively**:

| Capability | PostgreSQL Mechanism | Benefit |
| :--- | :--- | :--- |
| **Relational Data** | Standard ACID relational tables | Strong transactional integrity for documents, users, and citations |
| **Dense Vector Retrieval** | `vector` type + HNSW cosine index | Millisecond nearest-neighbor search without an external vector DB |
| **Sparse Lexical Retrieval** | `tsvector` + GIN index with `ts_rank_cd` | Production-grade BM25-equivalent keyword search |
| **Evidence Graph** | Adjacency tables with recursive CTEs | Graph traversal (parent sections, figures, tables) without Neo4j |

This choice dramatically reduces RAM consumption (<150MB vs >4GB), eliminates cross-service data sync failures, simplifies backup/restore, and makes local developer onboarding instant.

### How PostgreSQL Is Used in This Project

* **Single instance, single database** (`mdi_db`): one connection pool from
  FastAPI (SQLAlchemy async + `asyncpg`), one backup story, no cross-service
  synchronization.
* **Extensions**: `vector` (pgvector) and `uuid-ossp` are enabled on first
  boot by `infrastructure/docker/init-db.sql` and guaranteed by the initial
  Alembic migration (`backend/alembic/versions/0001_initial_pgvector.py`).
* **Access pattern**: All reads/writes go through the backend only — the
  frontend never talks to PostgreSQL directly.
* **Health**: `GET /api/v1/health` verifies connectivity, measures latency,
  and reports pgvector availability/version on every call.
* **Current phase**: No application tables yet. The Evidence Model schema is
  deliberately deferred to its own design/review milestone before any
  document/RAG implementation.

---

## 5. Frontend-Backend Communication

* **Protocol**: HTTP REST APIs with JSON payloads, versioned under `/api/v1`.
* **Same-origin by default**: Browser code calls relative URLs
  (e.g. `fetch('/api/v1/health')`). The Vite dev server proxies `/api/*` to
  FastAPI (`VITE_API_PROXY_TARGET`, default `http://localhost:8000`; `http://backend:8000`
  inside Docker Compose), so the browser never hardcodes a backend host and the
  app works unchanged behind preview proxies.
* **Cross-origin deployments**: Set `VITE_API_BASE_URL` to the absolute API
  origin at build time and allow the frontend origin in `CORS_ORIGINS`.
* **Streaming** *(planned)*: Server-Sent Events (`text/event-stream`) for
  streaming LLM generation and retrieval thought logs in later phases.
* **CORS**: Enforced at the FastAPI application layer via the configurable
  `CORS_ORIGINS` setting.

---

## 6. Phased Evolution Strategy

To ensure zero architectural degradation:
1. **Phase 1 (Current)**: Scaffolding, configuration management, health validation, Docker containerization.
2. **Phase 2**: Document ingestion pipeline and unified Evidence Model schema.
3. **Phase 3**: Hybrid retrieval (Dense + Sparse + RRF) and optional FlashRank CPU reranker.
4. **Phase 4**: Grounded RAG with strict citation verification and adversarial guardrails.
5. **Phase 5**: Interactive split-screen visual frontend with bounding-box canvas overlays.
6. **Phase 6**: Study Studio (summaries, flashcards, MCQs) and learning progress analytics.
