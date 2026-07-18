"""
ABOUTME: Stage 7 Models - Content Brief Generation
ABOUTME: Input/Output schemas for the content brief stage.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

from services.keywords.stage4.stage4_models import ScoredKeyword


class Stage7Input(BaseModel):
    """Input for Stage 7: Content Brief Generation"""

    keywords: List[ScoredKeyword] = Field(..., description="Keywords with SERP data")
    company_name: str = Field(..., description="Company name for context")
    industry: str = Field(default="", description="Company industry")
    language: str = Field(default="en", description="Content language")
    brief_sample_size: int = Field(default=15, description="Number of keywords to generate briefs for")


class ContentBrief(BaseModel):
    """Content brief for a keyword"""

    content_angle: str = Field(default="", description="Suggested content angle")
    target_questions: List[str] = Field(default_factory=list, description="Key questions to answer")
    content_gap: str = Field(default="", description="Gap in existing content to fill")
    audience_pain_point: str = Field(default="", description="Pain point to address")
    recommended_word_count: int = Field(default=1500, description="Recommended word count")


class Stage7Output(BaseModel):
    """Output from Stage 7: Content Brief Generation"""

    keywords: List[ScoredKeyword] = Field(default_factory=list, description="Keywords with content briefs")
    briefs_generated: int = Field(default=0, description="Number of briefs generated")
    ai_calls: int = Field(default=0, description="Number of AI calls made")
