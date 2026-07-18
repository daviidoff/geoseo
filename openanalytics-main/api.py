#!/usr/bin/env python3
"""
OpenAnalytics - Clean Production API

Two main services:
1. Health Check - 29 AEO checks, tiered scoring
2. Mentions Check - AI hyperniche query generation + visibility analysis

Uses stage-based architecture aligned with openblog.

Environment Variables Required:
- GEMINI_API_KEY: Your Gemini API key
"""
import os
import sys
import time
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment
load_dotenv('.env.local')

# Add project root to path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

# Initialize FastAPI
app = FastAPI(
    title="OpenAnalytics",
    description="AEO Health Check + AI Visibility Analysis API",
    version="3.0.0",
)

@app.on_event("startup")
async def validate_environment():
    """Validate required environment variables on startup."""
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        print("ERROR: GEMINI_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Request/Response Models
# =============================================================================

class HealthCheckRequest(BaseModel):
    """Request for health check endpoint."""
    url: str
    timeout: float = 30.0
    enable_js_rendering: bool = True


class HealthCheckResponse(BaseModel):
    """Response from health check endpoint."""
    url: str
    score: float
    max_score: float = 100.0
    grade: str
    band: str
    band_color: str
    checks_passed: int
    checks_failed: int
    issues: list
    tier_details: dict
    execution_time: float
    fetch_time_ms: int
    js_rendered: bool = False


class MentionsCheckRequest(BaseModel):
    """Request for mentions check endpoint."""
    company_name: str
    industry: Optional[str] = None
    products: Optional[List[str]] = None
    target_audience: Optional[str] = None
    num_queries: int = Field(default=10, ge=1, le=50)


class MentionsCheckResponse(BaseModel):
    """Response from mentions check endpoint."""
    company_name: str
    queries_generated: list
    query_results: list
    visibility: float
    mentions: int
    presence_rate: float
    quality_score: float
    execution_time: float
    ai_calls: int


class FullAnalysisRequest(BaseModel):
    """Request for full analysis endpoint."""
    url: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    products: Optional[List[str]] = None
    target_audience: Optional[str] = None
    num_queries: int = Field(default=10, ge=1, le=50)


class FullAnalysisResponse(BaseModel):
    """Response from full analysis endpoint."""
    health: Optional[HealthCheckResponse] = None
    mentions: Optional[MentionsCheckResponse] = None
    total_execution_time: float
    error: Optional[str] = None


# =============================================================================
# Health Check Endpoint
# =============================================================================

@app.post("/health", response_model=HealthCheckResponse)
async def health_check(request: HealthCheckRequest):
    """Run comprehensive AEO health check.

    29 checks across 4 categories:
    - Technical SEO (16 checks)
    - Structured Data (6 checks)
    - AI Crawler Access (4 checks)
    - Authority Signals (3 checks)

    Returns tiered objective scoring (0-100).
    """
    try:
        from service.analytics_service import get_analytics_service

        service = get_analytics_service()
        result = await service.run_health_check(
            url=request.url,
            timeout=request.timeout,
            enable_js_rendering=request.enable_js_rendering
        )

        return HealthCheckResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


# =============================================================================
# Mentions Check Endpoint
# =============================================================================

@app.post("/mentions", response_model=MentionsCheckResponse)
async def mentions_check(request: MentionsCheckRequest):
    """Run AI visibility check with hyperniche query generation.

    Generates sophisticated queries that test organic visibility:
    - 70% unbranded (tests real organic discovery)
    - 20% competitive (comparison queries)
    - 10% branded (brand awareness)

    Tests queries with Gemini to measure visibility.
    """
    try:
        from service.analytics_service import get_analytics_service

        service = get_analytics_service()
        result = await service.run_mentions_check(
            company_name=request.company_name,
            industry=request.industry,
            products=request.products,
            target_audience=request.target_audience,
            num_queries=request.num_queries
        )

        return MentionsCheckResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mentions check failed: {str(e)}")


# =============================================================================
# Full Analysis Endpoint
# =============================================================================

@app.post("/analyze", response_model=FullAnalysisResponse)
async def full_analysis(request: FullAnalysisRequest):
    """Run full AEO analysis (health + mentions).

    Runs health check and mentions check in parallel if both URL and
    company name are provided.
    """
    if not request.url and not request.company_name:
        raise HTTPException(
            status_code=400,
            detail="At least one of 'url' or 'company_name' is required"
        )

    try:
        from service.analytics_service import get_analytics_service

        service = get_analytics_service()
        result = await service.run_full_analysis(
            url=request.url,
            company_name=request.company_name,
            industry=request.industry,
            products=request.products,
            target_audience=request.target_audience,
            num_queries=request.num_queries
        )

        # Convert nested dicts to response models
        health_result = None
        mentions_result = None

        if result.get("health"):
            health_result = HealthCheckResponse(**result["health"])

        if result.get("mentions"):
            mentions_result = MentionsCheckResponse(**result["mentions"])

        return FullAnalysisResponse(
            health=health_result,
            mentions=mentions_result,
            total_execution_time=result.get("total_execution_time", 0),
            error=result.get("error")
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# =============================================================================
# Info Endpoints
# =============================================================================

@app.get("/")
async def root():
    """Service info."""
    return {
        "service": "OpenAnalytics",
        "version": "3.0.0",
        "architecture": "stage-based (aligned with openblog)",
        "status": "ready",
        "endpoints": {
            "/health": "POST - AEO health check (29 checks)",
            "/mentions": "POST - AI visibility check (hyperniche queries)",
            "/analyze": "POST - Full analysis (health + mentions)",
            "/": "GET - This info",
            "/status": "GET - Health status",
            "/docs": "GET - OpenAPI documentation"
        },
        "stages": {
            "stage health": "29 AEO checks with tiered scoring",
            "stage mentions": "AI visibility with hyperniche queries"
        },
        "requirements": {
            "GEMINI_API_KEY": "✓ Set" if os.getenv("GEMINI_API_KEY") else "✗ Missing"
        }
    }


@app.get("/status")
async def status():
    """Health status endpoint."""
    return {
        "status": "healthy",
        "version": "3.0.0",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY"))
    }


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
