"""
Shared data models for OpenAnalytics pipeline.

All request/response schemas for health and mentions checks.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# =============================================================================
# Check Result Models
# =============================================================================

class CheckResult(BaseModel):
    """Individual check result."""
    check: str
    category: str
    passed: bool
    severity: str  # 'pass', 'error', 'warning', 'notice'
    message: str
    recommendation: str = ""
    score_impact: int = 5


class TierDetails(BaseModel):
    """Tier evaluation details."""
    tier0: Dict[str, Any]
    tier1: Dict[str, Any]
    tier2: Dict[str, Any]
    base_score: float
    limiting_tier: str
    limiting_reason: str


# =============================================================================
# Health Check Models
# =============================================================================

class HealthCheckInput(BaseModel):
    """Input for health check stage."""
    url: str
    timeout: float = 30.0
    enable_js_rendering: bool = True


class FetchResult(BaseModel):
    """Result of fetching a website."""
    html: Optional[str] = None
    final_url: str
    robots_txt: Optional[str] = None
    sitemap_found: bool = False
    html_response_time_ms: int = 0
    total_fetch_time_ms: int = 0
    status_code: int = 0
    js_rendered: bool = False
    error: Optional[str] = None


class HealthCheckOutput(BaseModel):
    """Output from health check stage."""
    url: str
    score: float
    max_score: float = 100.0
    grade: str
    band: str
    checks_passed: int
    checks_failed: int
    issues: List[Dict[str, Any]]
    tier_details: Optional[TierDetails] = None
    execution_time: float


# =============================================================================
# Mentions Check Models
# =============================================================================

class MentionsCheckInput(BaseModel):
    """Input for mentions check stage."""
    company_name: str
    industry: Optional[str] = None
    products: Optional[List[str]] = None
    target_audience: Optional[str] = None
    num_queries: int = 10


class QueryResult(BaseModel):
    """Result of testing a single query."""
    query: str
    dimension: str = ""
    has_response: bool = False
    company_mentioned: bool = False
    response_length: int = 0
    response_preview: str = ""
    error: Optional[str] = None


class MentionsCheckOutput(BaseModel):
    """Output from mentions check stage."""
    company_name: str
    queries_generated: List[Dict[str, str]]
    query_results: List[QueryResult] = []
    visibility: float
    mentions: int
    presence_rate: float
    quality_score: float
    execution_time: float


# =============================================================================
# Pipeline Models
# =============================================================================

class PipelineInput(BaseModel):
    """Input for running full pipeline."""
    url: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    products: Optional[List[str]] = None
    target_audience: Optional[str] = None
    run_health: bool = True
    run_mentions: bool = True
    num_queries: int = 10


class PipelineOutput(BaseModel):
    """Output from full pipeline."""
    health: Optional[HealthCheckOutput] = None
    mentions: Optional[MentionsCheckOutput] = None
    total_execution_time: float
    error: Optional[str] = None
