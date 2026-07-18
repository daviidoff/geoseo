"""
Pydantic models for context service.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field, HttpUrl


class ContextRequest(BaseModel):
    """Request model for context extraction."""

    url: HttpUrl = Field(
        ...,
        description="Company website URL to analyze",
        examples=["https://example.com"],
    )
    fallback_on_error: bool = Field(
        default=True,
        description="Return basic detection if AI fails",
    )
    # User-provided context for enhanced analysis
    system_instructions: Optional[str] = Field(
        default=None,
        description="Custom instructions for the analysis (e.g., 'Focus on B2B features')",
    )
    client_knowledge_base: Optional[str] = Field(
        default=None,
        description="Known facts about the company",
    )
    content_instructions: Optional[str] = Field(
        default=None,
        description="Content writing guidelines",
    )
    research_files: Optional[List[Dict]] = Field(
        default=None,
        description="Research documents with name and content",
    )
    assets: Optional[List[Dict]] = Field(
        default=None,
        description="Asset files with name and description",
    )


class ContextResponse(BaseModel):
    """Response model for context extraction."""

    company_name: str
    company_url: str
    industry: str
    description: str
    products: List[str] = []
    services: List[str] = []
    target_audience: str = ""
    target_audiences: List[str] = []
    competitors: List[str] = []
    competitor_categories: List[str] = []
    tone: str = ""
    pain_points: List[str] = []
    value_propositions: List[str] = []
    use_cases: List[str] = []
    content_themes: List[str] = []
    voice_persona: Dict = {}
    visual_identity: Dict = {}
    authors: List[Dict] = []
    gtm_playbook: str = ""
    product_type: str = ""
    ai_called: bool = False
