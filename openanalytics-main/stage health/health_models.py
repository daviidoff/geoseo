"""
Data models for Health Check stage.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class HealthStageInput(BaseModel):
    """Input for health check stage."""
    url: str
    timeout: float = 30.0
    enable_js_rendering: bool = True


class HealthStageOutput(BaseModel):
    """Output from health check stage."""
    url: str
    score: float
    max_score: float = 100.0
    grade: str
    band: str
    band_color: str
    checks_passed: int
    checks_failed: int
    issues: List[Dict[str, Any]]
    tier_details: Dict[str, Any]
    execution_time: float
    fetch_time_ms: int
    js_rendered: bool = False
