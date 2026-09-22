# Local Development Guide

## Prerequisites

Ensure the following tools are installed on your host system:
* **Python**: 3.11 or 3.13 (`python --version`)
* **Node.js**: 18+ or 22+ (`node --version`) and `npm`
* **Docker & Docker Compose**: Docker 24+ (`docker compose version`)

---

## 1. Environment Setup

Copy the example environment template to `.env` at the root of the repository:

```bash
cp .env.example .env
```

For frontend and backend local development, configuration defaults are preset to connect to `localhost`.

---

## 2. Running with Docker Compose (Recommended)

To launch the full reproducible stack (PostgreSQL + pgvector, FastAPI backend, and Vite frontend):

```bash
docker compose up --build
```

### Services & Accessible Ports:
* **Frontend**: [http://localhost:5173](http://localhost:5173)
* **Backend API**: [http://localhost:8000](http://localhost:8000)
* **API Documentation (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **Health Endpoint**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
* **PostgreSQL 16**: `localhost:5432`

To shut down the environment:
```bash
docker compose down
```
To shut down and wipe persistent volumes (fresh database):
```bash
docker compose down -v
```

---

## 3. Running Services Locally on Host

### A. Database (PostgreSQL + pgvector via Docker)
Even when developing on the host, run PostgreSQL in Docker:
```bash
docker compose up postgres -d
```

### B. Backend (FastAPI)
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows PowerShell:
   .venv\Scripts\Activate.ps1
   # Linux/macOS:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -e ".[dev]"
   ```
4. Run Alembic migrations:
   ```bash
   alembic upgrade head
   ```
5. Start the development server with auto-reload:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### C. Frontend (React + Vite + TypeScript)
1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 4. Testing

### Backend Tests
From the `backend/` directory:
```bash
pytest -v
```
Runs:
* Health endpoint tests (`tests/test_health.py`)
* Database connectivity & pgvector validation (`tests/test_db_connectivity.py`)

### Frontend Tests & Type Checking
From the `frontend/` directory:
```bash
# Run unit & render tests
npm test

# Run TypeScript type check
npm run typecheck

# Run linter
npm run lint
```

---

## 5. Database Migrations (Alembic)

When models are added in future milestones:
```bash
# Generate a new migration revision
alembic revision --autogenerate -m "describe_schema_change"

# Apply pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```
