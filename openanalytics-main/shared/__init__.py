"""
Shared components for OpenAnalytics pipeline.

- GeminiClient: Unified Gemini client with structured output
- Models: Request/Response schemas for all stages
- Constants: Shared configuration
- Scoring: Tiered AEO scoring system
- Fetcher: Async HTML/robots.txt fetcher
"""

from .gemini_client import GeminiClient, get_gemini_client
from .models import (
    HealthCheckInput,
    HealthCheckOutput,
    MentionsCheckInput,
    MentionsCheckOutput,
    CheckResult,
    TierDetails,
    FetchResult,
    PipelineInput,
    PipelineOutput,
)
from .constants import GEMINI_MODEL, DEFAULT_TIMEOUT, AI_CRAWLERS, HEADERS, CLOUDFLARE_PATTERNS
from .scoring import (
    calculate_tiered_score,
    calculate_grade,
    calculate_visibility_band,
)
from .fetcher import fetch_website

__all__ = [
    # Client
    "GeminiClient",
    "get_gemini_client",
    # Models
    "HealthCheckInput",
    "HealthCheckOutput",
    "MentionsCheckInput",
    "MentionsCheckOutput",
    "CheckResult",
    "TierDetails",
    "FetchResult",
    "PipelineInput",
    "PipelineOutput",
    # Constants
    "GEMINI_MODEL",
    "DEFAULT_TIMEOUT",
    "AI_CRAWLERS",
    "HEADERS",
    "CLOUDFLARE_PATTERNS",
    # Scoring
    "calculate_tiered_score",
    "calculate_grade",
    "calculate_visibility_band",
    # Fetcher
    "fetch_website",
]
