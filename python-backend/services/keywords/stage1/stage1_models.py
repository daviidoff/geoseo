"""
Stage 1 Models: Company Analysis

Input/Output schemas for the company analysis stage.
"""

from typing import List, Optional, Union
from pydantic import BaseModel, Field, field_validator


class Stage1Input(BaseModel):
    """Input for Stage 1: Company Analysis"""

    company_url: str = Field(..., description="Company website URL")
    company_name: Optional[str] = Field(default=None, description="Optional company name override")
    language: str = Field(default="en", description="Target language code")
    region: str = Field(default="us", description="Target region/market code")


class CompanyContext(BaseModel):
    """Rich company context extracted from website analysis"""

    company_name: str = Field(..., description="Company name")
    company_url: str = Field(..., description="Company website URL")
    description: Optional[str] = Field(default=None, description="Company description")
    industry: Optional[str] = Field(default=None, description="Industry category")

    # Products & Services
    products: List[str] = Field(default_factory=list, description="Products they sell")
    services: List[str] = Field(default_factory=list, description="Services they offer")

    # Customer Insights
    target_audience: List[str] = Field(default_factory=list, description="Target customers")
    pain_points: List[str] = Field(default_factory=list, description="Customer pain points")
    customer_problems: List[str] = Field(default_factory=list, description="Problems they solve")
    use_cases: List[str] = Field(default_factory=list, description="Real use cases")

    @field_validator('target_audience', mode='before')
    @classmethod
    def convert_target_audience_to_list(cls, v):
        """Convert string target_audience to list (handles OpenContext string format)."""
        if v is None:
            return []
        if isinstance(v, str):
            # Split on common delimiters if it's a long string description
            if v and len(v) > 0:
                return [v.strip()] if v.strip() else []
            return []
        if isinstance(v, list):
            return v
        return []

    # Value & Differentiation
    value_propositions: List[str] = Field(default_factory=list, description="Key value props")
    differentiators: List[str] = Field(default_factory=list, description="What makes them unique")
    key_features: List[str] = Field(default_factory=list, description="Key features")
    solution_keywords: List[str] = Field(default_factory=list, description="Solution terms")

    # Market
    competitors: List[str] = Field(default_factory=list, description="Competitor URLs/names")
    primary_region: Optional[str] = Field(default=None, description="Primary geographic market")

    # Brand
    brand_voice: Optional[str] = Field(default=None, description="Brand communication style")
    tone: Optional[str] = Field(default=None, description="Brand tone (professional, casual, etc.)")
    product_category: Optional[str] = Field(default=None, description="Product category")
    content_themes: List[str] = Field(default_factory=list, description="Content themes/topics")


class Stage1Output(BaseModel):
    """Output from Stage 1: Company Analysis"""

    company_context: CompanyContext = Field(..., description="Rich company context")
    language: str = Field(default="en", description="Target language")
    region: str = Field(default="us", description="Target region")
    ai_calls: int = Field(default=1, description="Number of AI calls made")
    opencontext_called: bool = Field(default=True, description="Whether OpenContext was called")
