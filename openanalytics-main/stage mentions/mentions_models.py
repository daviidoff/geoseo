"""
Data models for Mentions Check stage.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class MentionsStageInput(BaseModel):
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


class MentionsStageOutput(BaseModel):
    """Output from mentions check stage."""
    company_name: str
    queries_generated: List[Dict[str, str]]
    query_results: List[QueryResult]
    visibility: float
    mentions: int
    presence_rate: float
    quality_score: float
    execution_time: float
    ai_calls: int
