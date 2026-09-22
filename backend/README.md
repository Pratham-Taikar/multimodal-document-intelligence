# Multimodal Document Intelligence — Backend

FastAPI application exposing the versioned HTTP API (`/api/v1`).

## Structure

```
backend/
├── app/
│   ├── api/v1/          # Versioned endpoint routers
│   ├── core/            # Configuration, logging, exception handling
│   ├── db/              # SQLAlchemy async engine, session, base model
│   └── main.py          # Application factory & entry point
├── alembic/             # Migration environments & versions
├── tests/               # Backend test suite
├── alembic.ini
├── Dockerfile
└── pyproject.toml
```

## Quick start

```bash
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

See [docs/development.md](../docs/development.md) for full instructions.
