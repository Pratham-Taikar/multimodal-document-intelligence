import pytest
from app.db.session import check_db_connectivity
from app.core.config import settings


@pytest.mark.asyncio
async def test_db_connectivity_contract():
    """
    Validates that check_db_connectivity adheres to the contract:
    - Never raises an unhandled exception
    - Always returns a dict with 'status', 'latency_ms', and 'database'
    """
    result = await check_db_connectivity()
    assert isinstance(result, dict)
    assert "status" in result
    assert result["status"] in ["connected", "disconnected"]
    assert "latency_ms" in result
    assert isinstance(result["latency_ms"], (int, float))
    assert result["database"] == settings.POSTGRES_DB

    if result["status"] == "connected":
        assert "pgvector_installed" in result
        assert isinstance(result["pgvector_installed"], bool)
        assert result["pgvector_installed"] is True
    else:
        assert "error" in result
