"""
Pydantic models for mentions/visibility service.

Features:
- Gemini with Google Search grounding
- 15+ query dimensions for comprehensive visibility checking
- Competitor mention extraction
- Token tracking
"""

from enum import Enum
from typing import Dict, List, Optional, Any, Literal
from pydantic import BaseModel, Field


class AIPlatform(str, Enum):
    """Supported AI platforms for mentions check."""
    GEMINI = "gemini"


class MentionType(str, Enum):
    """Types of company mentions in AI responses."""
    PRIMARY = "primary_recommendation"
    TOP = "top_option"
    LISTED = "listed_option"
    CONTEXTUAL = "mentioned_in_context"
    COMPETITIVE = "competitive_mention"  # Mentioned alongside competitors
    PASSING = "passing_mention"
    NONE = "no_mention"


class VisibilityBand(str, Enum):
    """Visibility score bands."""
    DOMINANT = "Dominant"
    STRONG = "Strong"
    MODERATE = "Moderate"
    WEAK = "Weak"
    MINIMAL = "Minimal"


class CompanyAnalysis(BaseModel):
    """Company analysis data for generating targeted queries."""
    company_info: Dict[str, Any] = Field(default_factory=dict, alias="companyInfo")
    competitors: List[Dict[str, Any]] = Field(default_factory=list)

    # Extended fields for better query generation
    countries: List[str] = Field(default_factory=list, description="Target countries")
    compliance_flags: List[str] = Field(default_factory=list, description="Compliance requirements (SOC2, HIPAA, GDPR)")
    product_categories: List[str] = Field(default_factory=list, description="Product categories")

    class Config:
        populate_by_name = True


class CompetitorMention(BaseModel):
    """Competitor mentioned in AI response."""
    name: str
    count: int = 1


class MentionsRequest(BaseModel):
    """Request model for mentions/visibility check."""

    company_name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Company name to check visibility for",
        examples=["Stripe"],
    )
    company_analysis: Optional[CompanyAnalysis] = Field(
        default=None,
        description="Optional company analysis data for targeted queries",
    )
    mode: str = Field(
        default="fast",
        pattern="^(fast|full)$",
        description="Query mode: 'fast' (10 queries) or 'full' (20 queries)",
    )
    language: str = Field(
        default="en",
        min_length=2,
        max_length=5,
        description="Target language code",
    )
    country: str = Field(
        default="US",
        min_length=2,
        max_length=5,
        description="Target country/market code",
    )
    num_queries: Optional[int] = Field(
        default=None,
        ge=5,
        le=100,
        description="Number of queries (overrides mode)",
    )


class QueryResult(BaseModel):
    """Individual query result."""

    query: str
    dimension: str
    response: str
    mentions: int
    quality_score: float
    mention_type: Optional[str] = None
    tokens_used: int = 0
    latency_ms: int = 0

    # New fields for enhanced tracking
    platform: str = Field(default="gemini", description="AI platform used")
    position: Optional[int] = Field(default=None, description="Position in list if mentioned (1-indexed)")
    competitor_mentions: List[CompetitorMention] = Field(default_factory=list, description="Competitors mentioned in response")
    cost: float = Field(default=0.0, description="Estimated cost for this query")
    source_urls: List[str] = Field(default_factory=list, description="Source URLs from grounded search results")
    raw_mentions: int = Field(default=0, description="Raw mention count before capping")
    capped_mentions: int = Field(default=0, description="Capped mention count (max 3)")


class PlatformStats(BaseModel):
    """Stats per AI platform."""

    queries: int = 0
    mentions: int = 0
    quality_avg: float = 0.0
    tokens: int = 0
    cost: float = Field(default=0.0, description="Total cost for this platform")


class DimensionStats(BaseModel):
    """Stats per query dimension."""

    queries: int = 0
    mentions: int = 0
    quality_avg: float = 0.0
    visibility: float = 0.0


class MentionsResponse(BaseModel):
    """Response model for mentions/visibility check."""

    company_name: str
    visibility: float = Field(
        ...,
        ge=0,
        le=100,
        description="Overall visibility score (0-100%)",
    )
    band: str = Field(
        ...,
        description="Visibility band: Dominant/Strong/Moderate/Weak/Minimal",
    )
    mentions: int = Field(
        ...,
        ge=0,
        description="Total mentions across all queries",
    )
    presence_rate: float = Field(
        ...,
        ge=0,
        le=100,
        description="Percentage of queries that mentioned the company",
    )
    quality_score: float = Field(
        ...,
        ge=0,
        le=10,
        description="Average quality score (0-10)",
    )
    max_quality: float = Field(
        default=10.0,
        description="Maximum possible quality score",
    )
    platform_stats: Dict[str, PlatformStats] = Field(
        default_factory=dict,
        description="Stats per AI platform",
    )
    dimension_stats: Dict[str, DimensionStats] = Field(
        default_factory=dict,
        description="Stats per query dimension",
    )
    query_results: List[QueryResult] = Field(
        default_factory=list,
        description="Individual query results",
    )
    queries_processed: int = Field(
        ...,
        description="Number of queries processed",
    )
    execution_time_seconds: float = Field(
        ...,
        description="Total execution time",
    )
    mode: str = Field(
        ...,
        description="Query mode used (fast/full)",
    )

    # New fields for enhanced tracking
    total_cost: float = Field(default=0.0, description="Total estimated cost across all platforms")
    total_tokens: int = Field(default=0, description="Total tokens used across all platforms")
    platforms_used: List[str] = Field(default_factory=list, description="List of platforms that were used")
    checked_at: Optional[str] = Field(default=None, description="ISO timestamp of when check was performed")
    competitor_summary: List[CompetitorMention] = Field(default_factory=list, description="Summary of competitor mentions across all queries")
