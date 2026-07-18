"""
Pydantic models for AEO health check service.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class HealthCheckRequest(BaseModel):
    """Request model for AEO health check."""
    url: str = Field(..., description="Website URL to analyze")


class Issue(BaseModel):
    """Individual check result."""
    check: str
    category: str
    passed: bool
    severity: str  # error, warning, notice
    message: str
    recommendation: str
    score_impact: int = 0


class TierDetail(BaseModel):
    """Tier evaluation detail."""
    passed: bool
    cap: int
    reason: str


class TierInfo(BaseModel):
    """Tiered scoring information."""
    tier0: TierDetail
    tier1: TierDetail
    tier2: TierDetail
    base_score: float
    limiting_tier: str
    limiting_reason: str


class Summary(BaseModel):
    """Website analysis summary."""
    title: str = ""
    title_length: int = 0
    meta_description: str = ""
    meta_length: int = 0
    word_count: int = 0
    h1_count: int = 0
    images_total: int = 0
    images_with_alt: int = 0
    https: bool = False
    schema_types: List[str] = []
    schema_count: int = 0
    has_organization: bool = False
    has_faq: bool = False
    robots_txt_found: bool = False
    sitemap_found: bool = False
    ai_crawlers_allowed: List[str] = []
    ai_crawlers_blocked: List[str] = []
    social_links: List[str] = []
    response_time_ms: int = 0


class TierDetails(BaseModel):
    """Tier details for frontend compatibility."""
    technical: Dict[str, int] = {"score": 0, "total": 7}
    structured_data: Dict[str, int] = {"score": 0, "total": 3}
    crawler: Dict[str, int] = {"score": 0, "total": 4}
    authority: Dict[str, int] = {"score": 0, "total": 3}


class HealthCheckResponse(BaseModel):
    """Response model for AEO health check."""
    success: bool = True
    url: str
    final_url: Optional[str] = None
    score: float = Field(..., ge=0, le=100)
    grade: str  # A, B, C, D, F
    visibility_band: str  # Excellent, Strong, Moderate, Weak, Critical
    visibility_color: str = ""  # Alias for band_color for frontend compatibility
    band_color: str = ""
    tier_info: TierInfo
    tier_details: TierDetails = Field(default_factory=TierDetails)
    category_clarity_score: int = Field(default=0, ge=0, le=100)
    entity_strength_score: int = Field(default=0, ge=0, le=100)
    authority_signal_score: int = Field(default=0, ge=0, le=100)
    total_checks: int
    passed: int
    errors: int
    warnings: int
    notices: int
    issues: List[Issue]
    summary: Summary
    technical_summary: Optional[str] = None
    structured_data_summary: Optional[str] = None
    crawler_summary: Optional[str] = None
    authority_summary: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    processing_time_seconds: float
