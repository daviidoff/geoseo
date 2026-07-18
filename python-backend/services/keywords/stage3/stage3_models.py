"""
Stage 3 Models: AI Keyword Generation

Input/Output schemas for the keyword generation stage.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from stage1.stage1_models import CompanyContext
from stage2.stage2_models import ResearchKeyword


class GeneratedKeyword(BaseModel):
    """A generated keyword"""

    keyword: str = Field(..., description="The keyword text")
    intent: str = Field(default="informational", description="Search intent")
    source: str = Field(default="ai_generated", description="Source of keyword")
    is_question: bool = Field(default=False, description="Is question keyword")


class Stage3Input(BaseModel):
    """Input for Stage 3: Keyword Generation"""

    company_context: CompanyContext = Field(..., description="Company context from Stage 1")
    research_keywords: List[ResearchKeyword] = Field(default_factory=list, description="Keywords from Stage 2")
    language: str = Field(default="en", description="Target language")
    region: str = Field(default="us", description="Target region")
    target_count: int = Field(default=50, description="Target keyword count")
    enable_autocomplete: bool = Field(default=False, description="Enable autocomplete")


class Stage3Output(BaseModel):
    """Output from Stage 3: Keyword Generation"""

    keywords: List[GeneratedKeyword] = Field(default_factory=list, description="Generated keywords")
    ai_calls: int = Field(default=0, description="Number of AI calls made")
