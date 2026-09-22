FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for compiling C extensions (if any) and health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy pyproject.toml first to leverage Docker layer caching
COPY pyproject.toml .

# Install dependencies including development/test dependencies
RUN pip install --no-cache-dir -e ".[dev]"

# Copy backend application code and migration files
COPY . .

# Expose FastAPI application port
EXPOSE 8000

# Run uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
