"""
Stage Health - AEO Health Check Stage

Runs 29 checks across 4 categories:
- Technical SEO (16 checks)
- Structured Data (6 checks)
- AI Crawler Access (4 checks)
- Authority Signals (3 checks)

Returns tiered objective scoring (0-100).
"""

from .stage_health import run_stage_health
from .health_models import HealthStageInput, HealthStageOutput

__all__ = [
    "run_stage_health",
    "HealthStageInput",
    "HealthStageOutput",
]
