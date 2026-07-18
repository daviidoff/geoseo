"""
Basic tests for OpenAnalytics API endpoints.
Run with: pytest test_app.py -v
"""
import pytest
from httpx import ASGITransport, AsyncClient
from app import app


@pytest.mark.asyncio
async def test_root_endpoint():
    """Test root endpoint returns service info."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "OpenAnalytics"
        assert data["version"] == "2.0.0"
        assert data["status"] == "ready"


@pytest.mark.asyncio
async def test_status_endpoint():
    """Test status endpoint returns health status."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "gemini_configured" in data


@pytest.mark.asyncio
async def test_health_check_valid_url():
    """Test health check with valid URL."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/health", json={"url": "https://example.com"})
        assert response.status_code == 200
        data = response.json()
        assert "score" in data
        assert "grade" in data
        assert "checks_passed" in data
        assert "checks_failed" in data
        assert data["checks_passed"] + data["checks_failed"] == 29
        assert 0 <= data["score"] <= 100


@pytest.mark.asyncio
async def test_health_check_invalid_url():
    """Test health check with invalid URL returns error."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/health",
            json={"url": "https://invalid-url-that-does-not-exist-xyz123.com"}
        )
        assert response.status_code == 400
        assert "Failed to fetch" in response.json()["detail"]


@pytest.mark.asyncio
async def test_mentions_check_valid_input():
    """Test mentions check with valid input."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/mentions",
            json={
                "company_name": "TestCorp",
                "industry": "Technology",
                "products": ["Platform"],
                "target_audience": "B2B",
                "num_queries": 2  # Keep it fast
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["company_name"] == "TestCorp"
        assert len(data["queries_generated"]) == 2
        assert "visibility" in data
        assert "mentions" in data
        assert "quality_score" in data
        assert 0 <= data["visibility"] <= 100
