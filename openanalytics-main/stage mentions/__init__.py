"""
Stage Mentions - AI Visibility Check Stage

Generates AI-powered hyperniche queries and tests them with Gemini:
- 70% UNBRANDED (tests real organic discovery)
- 20% COMPETITIVE (comparison queries)
- 10% BRANDED (brand awareness)

Returns visibility metrics and query results.
"""

from .stage_mentions import run_stage_mentions
from .mentions_models import MentionsStageInput, MentionsStageOutput

__all__ = [
    "run_stage_mentions",
    "MentionsStageInput",
    "MentionsStageOutput",
]
