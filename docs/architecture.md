# System Architecture: Multimodal Document Intelligence

## 1. Executive Overview

The Multimodal Document Intelligence platform is an evidence-first document comprehension and study synthesis system. It processes complex multimodal documents (PDF, DOCX, PPTX, TXT), decomposes them into structured, provenance-bearing evidence units (text blocks, tables, diagrams, slides), and delivers grounded answers with verifiable citations.

### Core Architectural Axiom: Evidence as the Source of Truth
* The **document evidence** is the immutable source of factual truth.
* The **LLM** is strictly a reasoning and natural-language synthesis layer.
* Every synthesized answer must be grounded in and traceable to specific document coordinates (page index, bounding box `[x0, y0, x1, y1]`, or visual asset crop).
* The LLM never hallucinates citations; assertions lacking sufficient document grounding are rejected or flagged.

---

## 2. Subsystems and Boundaries

```
+-------------------------------------------------------------------------------+
|                             Presentation Layer                                |
|                  (React 18 + Vite + TypeScript + Tailwind)                    |
+-------------------------------------------------------------------------------+
                                        |
                             HTTP / REST + SSE
                                        v
+-------------------------------------------------------------------------------+
|                             Application Layer                                 |
|                     (FastAPI + Python 3.11/3.13 Async)                        |
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

### Subsystem Responsibilities

1. **Frontend (`frontend/`)**:
   - Manages user interactions, document visualization, and chat history.
   - Consumes backend REST endpoints and streams token-by-token responses via Server-Sent Events (SSE).
   - Renders interactive citations that highlight the exact visual coordinates on document pages.

2. **Backend (`backend/`)**:
   - Encapsulates domain logic, file ingestion pipelines, retrieval orchestration, and RAG synthesis.
   - Provides versioned REST endpoints (`/api/v1`) with strictly validated Pydantic DTOs.
   - Enforces security boundaries, CORS policies, and structured JSON error responses.

3. **Database (`infrastructure/` & PostgreSQL)**:
   - Houses all operational state in a single PostgreSQL instance.
   - Eliminates the need for multiple disparate storage engines (no separate Qdrant, no Neo4j, no Redis).

---

## 3. Storage Architecture: Why Single-Store PostgreSQL 16 + pgvector?

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

---

## 4. Frontend-Backend Communication

* **Protocol**: HTTP/1.1 and HTTP/2 REST APIs with JSON payloads.
* **Streaming**: Server-Sent Events (`text/event-stream`) for streaming LLM generation and retrieval thought logs.
* **Configuration**: The frontend discovers the backend via the `VITE_API_BASE_URL` environment variable, defaulting to `http://localhost:8000`.
* **CORS**: Enforced at the FastAPI application layer based on the configurable `CORS_ORIGINS` setting.

---

## 5. Phased Evolution Strategy

To ensure zero architectural degradation:
1. **Phase 1 (Current)**: Scaffolding, configuration management, health validation, Docker containerization.
2. **Phase 2**: Document ingestion pipeline and unified Evidence Model schema.
3. **Phase 3**: Hybrid retrieval (Dense + Sparse + RRF) and optional FlashRank CPU reranker.
4. **Phase 4**: Grounded RAG with strict citation verification and adversarial guardrails.
5. **Phase 5**: Interactive split-screen visual frontend with bounding-box canvas overlays.
6. **Phase 6**: Study Studio (summaries, flashcards, MCQs) and learning progress analytics.
