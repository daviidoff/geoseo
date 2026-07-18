"""
Pydantic models for keywords service.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field, HttpUrl, field_validator


class CompanyContextInput(BaseModel):
    """Pre-provided company context from frontend."""

    company_name: Optional[str] = None
    company_url: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    products: Optional[List[str]] = None
    services: Optional[List[str]] = None
    target_audience: Optional[str] = None
    tone: Optional[str] = None
    competitors: Optional[List[str]] = None
    pain_points: Optional[List[str]] = None
    value_propositions: Optional[List[str]] = None
    use_cases: Optional[List[str]] = None
    content_themes: Optional[List[str]] = None
    voice_persona: Optional[Dict] = None
    # Research files with extracted content
    research_files: Optional[List[Dict]] = Field(
        default=None,
        description="Research documents with name, content, labels, summary",
    )


class KeywordRequest(BaseModel):
    """Request model for keyword generation."""

    company_name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Company name",
        examples=["Stripe"],
    )
    company_url: Optional[HttpUrl] = Field(
        default=None,
        description="Company website URL for deep analysis",
        examples=["https://stripe.com"],
    )
    target_count: int = Field(
        default=50,
        ge=10,
        le=500,
        description="Target number of keywords to generate",
    )
    language: str = Field(
        default="en",
        min_length=2,
        max_length=5,
        description="Target language code",
    )
    region: str = Field(
        default="us",
        min_length=2,
        max_length=5,
        description="Target region/market code",
    )
    enable_research: bool = Field(
        default=False,
        description="Enable deep research (Reddit, Quora, forums)",
    )
    min_score: int = Field(
        default=40,
        ge=0,
        le=100,
        description="Minimum company-fit score",
    )
    cluster_count: int = Field(
        default=6,
        ge=2,
        le=20,
        description="Number of keyword clusters to create",
    )
    enable_serp_analysis: bool = Field(
        default=True,
        description="Enable SERP analysis for AEO opportunity scoring",
    )
    enable_volume_lookup: bool = Field(
        default=True,
        description="Get real search volumes from DataForSEO",
    )
    serp_sample_size: int = Field(
        default=0,  # 0 means use target_count (all keywords)
        ge=0,
        le=500,
        description="Number of top keywords to analyze for SERP features. 0 = all keywords",
    )
    # Pre-provided company context (enhances keyword generation)
    company_context: Optional[CompanyContextInput] = Field(
        default=None,
        description="Pre-extracted company context from frontend with industry, products, pain points, etc.",
    )
    # Custom instructions for keyword generation
    system_instructions: Optional[str] = Field(
        default=None,
        description="System-level instructions for AI (e.g., 'Focus on B2B SaaS keywords')",
    )
    custom_instructions: Optional[str] = Field(
        default=None,
        description="Additional custom instructions for keyword generation",
    )

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Company name cannot be empty")
        return v.strip()


class KeywordResult(BaseModel):
    """Individual keyword in results."""

    keyword: str
    intent: str
    score: int
    cluster_name: Optional[str] = None
    is_question: bool = False
    source: str = "ai_generated"
    # SERP metrics
    volume: int = 0
    difficulty: int = 0
    aeo_opportunity: int = 0
    has_featured_snippet: bool = False
    has_paa: bool = False
    serp_analyzed: bool = False


class ClusterResult(BaseModel):
    """Keyword cluster in results."""

    name: str
    keywords: List[str]
    count: int


class StatisticsResult(BaseModel):
    """Statistics about generated keywords."""

    total: int
    avg_score: float
    intent_breakdown: Dict[str, int] = {}
    source_breakdown: Dict[str, int] = {}


class GenerationResponse(BaseModel):
    """Response model for keyword generation."""

    keywords: List[KeywordResult]
    clusters: List[ClusterResult]
    statistics: StatisticsResult
    processing_time_seconds: float


class RefreshRequest(BaseModel):
    """Request model for keyword refresh."""

    company_name: str = Field(..., description="Company name")
    company_url: Optional[HttpUrl] = Field(default=None, description="Company URL")
    existing_keywords: List[str] = Field(
        ...,
        min_length=1,
        description="Existing keywords to use as seeds for refresh",
    )
    target_count: int = Field(default=50, ge=10, le=500)
    language: str = Field(default="en")
    region: str = Field(default="us")
