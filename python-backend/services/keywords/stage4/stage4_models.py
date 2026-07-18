"""
Stage 4 Models: Scoring & Deduplication

Input/Output schemas for the scoring stage.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from stage1.stage1_models import CompanyContext


class ScoredKeyword(BaseModel):
    """A scored keyword"""

    keyword: str = Field(..., description="The keyword text")
    intent: str = Field(default="informational", description="Search intent")
    score: int = Field(default=0, description="Company-fit score (0-100)")
    source: str = Field(default="ai_generated", description="Source of keyword")
    is_question: bool = Field(default=False, description="Is question keyword")
    cluster_name: Optional[str] = Field(default=None, description="Cluster name")
    
    # Stage 6 enrichment fields (SERP analysis & volume lookup)
    volume: int = Field(default=0, description="Monthly search volume")
    difficulty: int = Field(default=0, description="Keyword difficulty (0-100)")
    aeo_opportunity: int = Field(default=0, description="AEO opportunity score (0-100)")
    has_featured_snippet: bool = Field(default=False, description="Has featured snippet in SERP")
    has_paa: bool = Field(default=False, description="Has People Also Ask in SERP")
    serp_analyzed: bool = Field(default=False, description="Whether SERP was analyzed")
    serp_data: Optional[dict] = Field(default=None, description="Full SERP data for display")
    
    # Stage 7 enrichment fields (Content brief generation)
    content_brief: Optional[dict] = Field(default=None, description="Content brief with angle, questions, etc.")
    
    # Research data fields (from Stage 2)
    research_summary: Optional[str] = Field(default=None, description="Summary of research findings")
    research_source_urls: Optional[List[str]] = Field(default=None, description="URLs from research")
    research_data: Optional[dict] = Field(default=None, description="Full research data")
    
    # Additional SERP-related fields
    top_ranking_urls: Optional[List[str]] = Field(default=None, description="Top ranking URLs from SERP")
    featured_snippet_url: Optional[str] = Field(default=None, description="Featured snippet source URL")
    paa_questions_with_urls: Optional[List[dict]] = Field(default=None, description="PAA questions with URLs")
    citations: Optional[List[dict]] = Field(default=None, description="Citation data")


class Stage4Input(BaseModel):
    """Input for Stage 4: Scoring & Deduplication"""

    company_context: CompanyContext = Field(..., description="Company context")
    keywords: List[dict] = Field(..., description="All keywords from previous stages")
    min_score: int = Field(default=40, description="Minimum score to include")
    min_word_count: int = Field(default=2, description="Minimum word count")


class Stage4Output(BaseModel):
    """Output from Stage 4: Scoring & Deduplication"""

    keywords: List[ScoredKeyword] = Field(default_factory=list, description="Scored keywords")
    duplicates_removed: int = Field(default=0, description="Duplicates removed")
    low_score_removed: int = Field(default=0, description="Low score keywords removed")
    ai_calls: int = Field(default=0, description="Number of AI calls made")
