"""
Stage 2 Models: Deep Research

Input/Output schemas for the research stage.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from stage1.stage1_models import CompanyContext


class ResearchKeyword(BaseModel):
    """A keyword discovered from research"""

    keyword: str = Field(..., description="The keyword/phrase")
    intent: str = Field(default="question", description="Search intent")
    source: str = Field(default="research", description="Platform: reddit, quora, forum")
    url: Optional[str] = Field(default=None, description="URL to the discussion")
    quote: Optional[str] = Field(default=None, description="Quote from the discussion")
    source_title: Optional[str] = Field(default=None, description="Thread/question title")
    source_author: Optional[str] = Field(default=None, description="Username/author")
    source_date: Optional[str] = Field(default=None, description="When posted")
    subreddit: Optional[str] = Field(default=None, description="Subreddit name")
    upvotes: Optional[int] = Field(default=None, description="Upvotes count")
    comments_count: Optional[int] = Field(default=None, description="Comments count")
    pain_point_extracted: Optional[str] = Field(default=None, description="Pain point")
    sentiment: Optional[str] = Field(default=None, description="positive/negative/neutral")


class Stage2Input(BaseModel):
    """Input for Stage 2: Deep Research"""

    company_context: CompanyContext = Field(..., description="Company context from Stage 1")
    language: str = Field(default="en", description="Target language")
    region: str = Field(default="us", description="Target region")
    target_count: int = Field(default=30, description="Target keyword count")
    enable_research: bool = Field(default=True, description="Enable research")


class Stage2Output(BaseModel):
    """Output from Stage 2: Deep Research"""

    keywords: List[ResearchKeyword] = Field(default_factory=list, description="Discovered keywords")
    platforms_searched: List[str] = Field(default_factory=list, description="Platforms searched")
    ai_calls: int = Field(default=0, description="Number of AI calls made")
