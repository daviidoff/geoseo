"""
Analytics Service - High-level business logic for OpenAnalytics.

Provides service methods for health checks and mentions analysis.
"""

import logging
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

logger = logging.getLogger(__name__)


class AnalyticsService:
    """High-level service for AEO analytics."""

    def __init__(self):
        """Initialize analytics service."""
        logger.info("AnalyticsService initialized")

    async def run_health_check(
        self,
        url: str,
        timeout: float = 30.0,
        enable_js_rendering: bool = True
    ) -> Dict[str, Any]:
        """Run comprehensive AEO health check.

        Args:
            url: URL to analyze
            timeout: Request timeout in seconds
            enable_js_rendering: Whether to allow JS rendering fallback

        Returns:
            Health check results dict
        """
        # Import stage module
        sys.path.insert(0, str(Path(__file__).parent.parent / "stage health"))
        from stage_health import run_stage_health
        from health_models import HealthStageInput

        input_data = HealthStageInput(
            url=url,
            timeout=timeout,
            enable_js_rendering=enable_js_rendering
        )

        output = await run_stage_health(input_data)
        return output.model_dump()

    async def run_mentions_check(
        self,
        company_name: str,
        industry: Optional[str] = None,
        products: Optional[List[str]] = None,
        target_audience: Optional[str] = None,
        num_queries: int = 10
    ) -> Dict[str, Any]:
        """Run AI visibility check with hyperniche queries.

        Args:
            company_name: Company name to check
            industry: Optional industry
            products: Optional product list
            target_audience: Optional target audience
            num_queries: Number of queries to generate

        Returns:
            Mentions check results dict
        """
        # Import stage module
        sys.path.insert(0, str(Path(__file__).parent.parent / "stage mentions"))
        from stage_mentions import run_stage_mentions
        from mentions_models import MentionsStageInput

        input_data = MentionsStageInput(
            company_name=company_name,
            industry=industry,
            products=products,
            target_audience=target_audience,
            num_queries=num_queries
        )

        output = await run_stage_mentions(input_data)
        return output.model_dump()

    async def run_full_analysis(
        self,
        url: Optional[str] = None,
        company_name: Optional[str] = None,
        industry: Optional[str] = None,
        products: Optional[List[str]] = None,
        target_audience: Optional[str] = None,
        num_queries: int = 10
    ) -> Dict[str, Any]:
        """Run full analysis (health + mentions).

        Args:
            url: URL for health check
            company_name: Company name for mentions check
            industry: Optional industry
            products: Optional product list
            target_audience: Optional target audience
            num_queries: Number of queries

        Returns:
            Combined results dict
        """
        from pipeline.run_pipeline import run_pipeline
        from shared.models import PipelineInput

        input_data = PipelineInput(
            url=url,
            company_name=company_name,
            industry=industry,
            products=products,
            target_audience=target_audience,
            run_health=bool(url),
            run_mentions=bool(company_name),
            num_queries=num_queries
        )

        output = await run_pipeline(input_data)
        return output.model_dump()


# Singleton instance
_analytics_service = None


def get_analytics_service() -> AnalyticsService:
    """Get singleton analytics service instance."""
    global _analytics_service
    if _analytics_service is None:
        _analytics_service = AnalyticsService()
    return _analytics_service
