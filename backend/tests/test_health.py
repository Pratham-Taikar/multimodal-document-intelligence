import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint_schema(async_client: AsyncClient):
    """Verifies that the /api/v1/health endpoint returns the expected JSON structure."""
    response = await async_client.get("/api/v1/health")

    # The status code will be 200 (healthy) or 503 (degraded if DB offline in isolated unit test)
    assert response.status_code in [200, 503]

    data = response.json()
    assert "status" in data
    assert data["status"] in ["healthy", "degraded"]
    assert "timestamp" in data
    assert "services" in data
    assert "api" in data["services"]
    assert data["services"]["api"]["status"] == "healthy"
    assert "database" in data["services"]
    assert "status" in data["services"]["database"]


@pytest.mark.asyncio
async def test_health_with_active_database(async_client: AsyncClient):
    """Verifies that with active PostgreSQL container, health returns 200 and pgvector is enabled."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    db_service = data["services"]["database"]
    assert db_service["status"] == "connected"
    assert db_service["pgvector_installed"] is True
    assert db_service["database"] == "mdi_db"


@pytest.mark.asyncio
async def test_root_redirect(async_client: AsyncClient):
    """Verifies that accessing root '/' redirects to '/docs'."""
    response = await async_client.get("/", follow_redirects=False)
    assert response.status_code in [302, 307]
    assert response.headers["location"] == "/docs"


@pytest.mark.asyncio
async def test_health_alias_redirect(async_client: AsyncClient):
    """Verifies that accessing '/health' redirects to '/api/v1/health'."""
    response = await async_client.get("/health", follow_redirects=False)
    assert response.status_code in [302, 307]
    assert response.headers["location"] == "/api/v1/health"
