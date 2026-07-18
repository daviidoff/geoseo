"""
Stage 6 Models: SERP Analysis & Volume Lookup

Input/Output schemas for the SERP enrichment stage.
"""

import sys
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel, Field

# Add paths for imports
_project_root = Path(__file__).parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

# Import shared models
from services.keywords.stage4.stage4_models import ScoredKeyword


class Stage6Input(BaseModel):
    """Input for Stage 6: SERP Analysis"""

    keywords: List[ScoredKeyword] = Field(..., description="Scored keywords from Stage 4/5")
    enable_serp_analysis: bool = Field(default=False, description="Analyze SERP features")
    enable_volume_lookup: bool = Field(default=False, description="Lookup search volumes")
    serp_sample_size: int = Field(default=15, description="Number of keywords to analyze")
    language: str = Field(default="en", description="Language code")
    region: str = Field(default="us", description="Region code")


class Stage6Output(BaseModel):
    """Output from Stage 6: SERP Analysis"""

    keywords: List[ScoredKeyword] = Field(default_factory=list, description="Enriched keywords")
    serp_analyzed_count: int = Field(default=0, description="Keywords with SERP analysis")
    volume_enriched_count: int = Field(default=0, description="Keywords with volume data")
    api_calls: int = Field(default=0, description="Number of API calls made")
    api_cost: float = Field(default=0.0, description="Estimated API cost in USD")
