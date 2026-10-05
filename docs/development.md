# Local Development Guide

## Prerequisites

Ensure the following tools are installed on your host system:

* **Python**: 3.11+ (`python3 --version`)
* **Node.js**: 18+ or 22+ (`node --version`) and `npm`
* **Docker & Docker Compose**: Docker 24+ (`docker compose version`)

---

## 1. Repository Structure

```
.
├── frontend/                  # React + Vite + TypeScript SPA
│   ├── public/                # Static assets (favicon)
│   └── src/
│       ├── components/layout/ # Application shell (header, status, footer)
│       ├── config/            # Typed environment configuration
│       ├── pages/             # Route-level pages (Dashboard, NotFound)
│       ├── services/          # Backend API client (typed fetch wrappers)
│       └── test/              # Vitest setup & rendering tests
├── backend/                   # FastAPI application
│   ├── app/
│   │   ├── api/v1/            # Versioned endpoint routers (/api/v1)
│   │   ├── core/              # Settings, logging, exception handling
│   │   ├── db/                # Async SQLAlchemy engine, session, Base
│   │   └── main.py            # Application factory & entry point
│   ├── alembic/               # Migration environment & versions
│   ├── tests/                 # pytest suite (health, DB connectivity)
│   ├── Dockerfile
│   └── pyproject.toml         # Dependencies, pytest config, packaging
├── infrastructure/
│   └── docker/init-db.sql     # First-boot DB initialization (extensions)
├── docs/                      # Architecture & development documentation
├── tests/                     # (reserved) cross-service integration/E2E tests
├── docker-compose.yml         # postgres + backend + frontend
└── .env.example               # Environment variable template (placeholders)
```

---

## 2. Environment Variables

Copy the template to `.env` at the repository root (`.env` is gitignored —
never commit real secrets):

```bash
cp .env.example .env
```

| Variable | Default | Used by | Purpose |
| :--- | :--- | :--- | :--- |
| `APP_ENV` | `development` | backend | Runtime environment label |
| `APP_NAME` | `Multimodal Document Intelligence API` | backend | API title (Swagger UI) |
| `APP_HOST` / `APP_PORT` | `0.0.0.0` / `8000` | backend | Bind address for uvicorn (in Compose) |
| `LOG_LEVEL` | `INFO` | backend | Root log level |
| `CORS_ORIGINS` | `http://localhost:5173,...` | backend | Comma-separated allowed browser origins |
| `POSTGRES_USER` | `mdi_user` | compose, backend | PostgreSQL role |
| `POSTGRES_PASSWORD` | `mdi_password_local_dev` | compose, backend | PostgreSQL password (placeholder) |
| `POSTGRES_DB` | `mdi_db` | compose, backend | Database name |
| `POSTGRES_HOST` | `localhost` | backend | Host used when assembling `DATABASE_URL` |
| `POSTGRES_PORT` | `5433` | compose, backend | Host port mapped to PostgreSQL (Compose maps `5433→5432`) |
| `DATABASE_URL` | `postgresql+asyncpg://…localhost:5433/mdi_db` | backend | Full async SQLAlchemy URL; Compose overrides it to `…@postgres:5432/…` |
| `VITE_API_BASE_URL` | *(empty)* | frontend | Absolute API origin for the browser. Empty = same-origin relative URLs (recommended) |
| `VITE_API_PROXY_TARGET` | `http://localhost:8000` | frontend (dev server) | Where the Vite dev server forwards `/api/*` requests (server-side only) |

---

## 3. Running with Docker Compose (Recommended)

To launch the full reproducible stack (PostgreSQL 16 + pgvector, FastAPI
backend, and Vite frontend):

```bash
docker compose up --build
```

### Services & Accessible Ports

| Service | URL / Address | Responsibility |
| :--- | :--- | :--- |
| Frontend | http://localhost:5173 | Vite dev server serving the React SPA |
| Backend API | http://localhost:8000 | FastAPI, versioned routes under `/api/v1` |
| Swagger UI | http://localhost:8000/docs | Interactive API documentation |
| Health endpoint | http://localhost:8000/api/v1/health | API + PostgreSQL/pgvector health |
| PostgreSQL 16 | `localhost:5433` (container `postgres:5432`) | Primary datastore (relational + vectors + FTS) |

```bash
# Shut down
docker compose down

# Shut down and wipe the persistent database volume (fresh start)
docker compose down -v
```

---

## 4. Running Services Locally on Host

### A. Database (PostgreSQL 16 + pgvector via Docker)

Even when developing on the host, run PostgreSQL in Docker:

```bash
docker compose up postgres -d
```

### B. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -e ".[dev]"

# Apply migrations (enables pgvector & uuid-ossp extensions)
alembic upgrade head

# Start the development server with auto-reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### C. Frontend (React + Vite + TypeScript)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

---

## 5. How the Frontend Communicates with the Backend

* Browser code calls **same-origin relative URLs** (e.g. `fetch('/api/v1/health')`).
* The **Vite dev server proxies** `/api/*` to the FastAPI backend
  (`VITE_API_PROXY_TARGET`, default `http://localhost:8000`; inside Docker
  Compose it is `http://backend:8000`). The browser never hardcodes a backend
  host, so the app works behind any preview/reverse proxy unchanged.
* To serve the frontend from a *different* origin than the API (e.g. static
  hosting), set `VITE_API_BASE_URL=https://api.example.com` at build time and
  allow the frontend origin in the backend's `CORS_ORIGINS`.

---

## 6. Testing

### Backend Tests

From the `backend/` directory (with the virtual environment active):

```bash
pytest -v
```

* Health endpoint contract tests (`tests/test_health.py`) — the
  DB-dependent test skips cleanly when PostgreSQL is not running.
* Database connectivity & pgvector validation
  (`tests/test_db_connectivity.py`) — asserts the connectivity helper's
  contract, and pgvector availability when the DB is reachable.

### Frontend Tests, Lint, Format & Type Checking

From the `frontend/` directory:

```bash
npm test            # Vitest render tests
npm run typecheck   # TypeScript (tsc --noEmit)
npm run lint        # ESLint
npm run format:check# Prettier formatting check
npm run build       # Type-check + production build
```

---

## 7. Database Migrations (Alembic)

Migrations live in `backend/alembic/versions/`. The initial migration
(`0001_initial_pgvector`) enables the `vector` and `uuid-ossp` extensions; no
application tables exist yet (schema arrives with the Evidence Model phase).

```bash
cd backend
source .venv/bin/activate

# Apply all pending migrations
alembic upgrade head

# Generate a new migration when models change (future phases)
alembic revision --autogenerate -m "describe_schema_change"

# Roll back one migration
alembic downgrade -1
```

---

## 8. How PostgreSQL Is Used

PostgreSQL 16 with the pgvector extension is the **single** datastore:

* **Relational** tables for structured state (arriving in later phases).
* **Dense vectors** via the `vector` type for semantic retrieval (enabled now;
  populated when the embedding phase lands).
* **Full-text search** via `tsvector`/GIN for lexical retrieval (later phases).

The scaffolding phase only validates connectivity and extension availability:

* `infrastructure/docker/init-db.sql` runs on first container boot and
  executes `CREATE EXTENSION IF NOT EXISTS vector` (plus `uuid-ossp`).
* The Alembic migration carries the same guarantees for host-based setups.
* `GET /api/v1/health` reports `pgvector_installed` and the extension version
  on every call.
