"""
SE Ranking API client for competitor gap analysis.

Discovers keywords competitors rank for but you don't.
Helps identify content gaps and opportunities.
"""

import logging
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# SE Ranking region IDs
REGION_IDS: Dict[str, int] = {
    "us": 1,
    "uk": 2,
    "ca": 3,
    "au": 4,
    "de": 5,
    "fr": 6,
    "es": 7,
    "it": 8,
    "br": 9,
    "mx": 10,
    "ar": 11,
    "in": 12,
    "jp": 13,
    "nl": 14,
    "se": 15,
    "pl": 16,
    "ch": 17,
    "at": 18,
    "be": 19,
    "pt": 20,
}


@dataclass
class CompetitorGapResult:
    """Gap analysis result for a single competitor."""
    competitor_url: str
    gap_keywords: List[str] = field(default_factory=list)
    total_gap_keywords: int = 0
    competitor_total_keywords: int = 0
    overlap_keywords: List[str] = field(default_factory=list)
    overlap_count: int = 0


@dataclass
class KeywordGapAnalysis:
    """Complete keyword gap analysis result."""
    your_url: str
    competitors: List[CompetitorGapResult] = field(default_factory=list)
    total_gap_opportunities: int = 0
    recommended_keywords: List[str] = field(default_factory=list)


class SERankingClient:
    """
    SE Ranking API client for competitor keyword gap analysis.

    Finds keywords your competitors rank for that you don't.
    Helps identify content gaps and opportunities.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api4.seranking.com/",
    ):
        self.api_key = api_key or os.environ.get("SE_RANKING_API_KEY", "")
        self.base_url = base_url.rstrip("/") + "/"

        if not self.api_key:
            logger.warning("SE Ranking API key not configured - gap analysis will be skipped")
        else:
            logger.info("SE Ranking client initialized")

    def is_configured(self) -> bool:
        """Check if SE Ranking is configured."""
        return bool(self.api_key)

    def _get_region_id(self, region: str) -> int:
        """Map region code to SE Ranking region ID."""
        return REGION_IDS.get(region.lower(), 1)  # Default to US

    async def analyze_keyword_gap(
        self,
        your_url: str,
        competitor_urls: List[str],
        region: str = "us",
        limit: int = 50,
    ) -> KeywordGapAnalysis:
        """
        Analyze keyword gaps between your site and competitors.

        Args:
            your_url: Your domain URL
            competitor_urls: List of competitor URLs
            region: Target region code
            limit: Max keywords per competitor

        Returns:
            KeywordGapAnalysis with gap opportunities
        """
        if not self.is_configured():
            logger.warning("SE Ranking not configured - returning empty gap analysis")
            return KeywordGapAnalysis(
                your_url=your_url,
                competitors=[],
                total_gap_opportunities=0,
                recommended_keywords=[],
            )

        if not competitor_urls:
            return KeywordGapAnalysis(
                your_url=your_url,
                competitors=[],
                total_gap_opportunities=0,
                recommended_keywords=[],
            )

        logger.info(f"Analyzing keyword gap: {your_url} vs {len(competitor_urls)} competitors...")

        # Analyze each competitor
        competitor_results: List[CompetitorGapResult] = []

        for competitor_url in competitor_urls:
            try:
                gap_result = await self._get_gap_for_competitor(
                    your_url, competitor_url, region, limit
                )
                competitor_results.append(gap_result)
            except Exception as e:
                logger.error(f"Failed to analyze {competitor_url}: {e}")

        # Aggregate all gap keywords
        all_gap_keywords = set()
        for result in competitor_results:
            all_gap_keywords.update(result.gap_keywords)

        # Rank keywords by frequency across competitors
        keyword_frequency: Dict[str, int] = {}
        for result in competitor_results:
            for kw in result.gap_keywords:
                keyword_frequency[kw] = keyword_frequency.get(kw, 0) + 1

        # Sort by frequency (more competitors = better opportunity)
        recommended = sorted(
            keyword_frequency.keys(),
            key=lambda k: keyword_frequency[k],
            reverse=True,
        )[:limit]

        logger.info(
            f"Gap analysis complete: {len(all_gap_keywords)} total opportunities, "
            f"{len(recommended)} recommended"
        )

        return KeywordGapAnalysis(
            your_url=your_url,
            competitors=competitor_results,
            total_gap_opportunities=len(all_gap_keywords),
            recommended_keywords=recommended,
        )

    async def _get_gap_for_competitor(
        self,
        your_url: str,
        competitor_url: str,
        region: str,
        limit: int,
    ) -> CompetitorGapResult:
        """Get keyword gap for a single competitor."""
        try:
            endpoint = f"{self.base_url}keywords/gap"

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    endpoint,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Token {self.api_key}",
                    },
                    json={
                        "your_domain": your_url,
                        "competitor_domain": competitor_url,
                        "region_id": self._get_region_id(region),
                        "limit": limit,
                    },
                )

                if not response.is_success:
                    raise Exception(f"SE Ranking API error: {response.status_code}")

                data = response.json()

                gap_keywords = [
                    item.get("keyword", item) if isinstance(item, dict) else item
                    for item in data.get("gap_keywords", [])
                ]
                overlap_keywords = [
                    item.get("keyword", item) if isinstance(item, dict) else item
                    for item in data.get("overlap_keywords", [])
                ]

                return CompetitorGapResult(
                    competitor_url=competitor_url,
                    gap_keywords=gap_keywords,
                    total_gap_keywords=len(gap_keywords),
                    competitor_total_keywords=data.get("competitor_total_keywords", 0),
                    overlap_keywords=overlap_keywords,
                    overlap_count=len(overlap_keywords),
                )

        except Exception as e:
            logger.error(f"SE Ranking gap analysis failed for {competitor_url}: {e}")
            return CompetitorGapResult(
                competitor_url=competitor_url,
                gap_keywords=[],
                total_gap_keywords=0,
                competitor_total_keywords=0,
                overlap_keywords=[],
                overlap_count=0,
            )

    async def get_competitor_keywords(
        self,
        competitor_url: str,
        region: str = "us",
        limit: int = 100,
    ) -> List[str]:
        """
        Get keywords a competitor ranks for.

        Args:
            competitor_url: Competitor domain URL
            region: Target region code
            limit: Max keywords to return

        Returns:
            List of keywords
        """
        if not self.is_configured():
            return []

        try:
            endpoint = f"{self.base_url}keywords/organic"

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    endpoint,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Token {self.api_key}",
                    },
                    json={
                        "domain": competitor_url,
                        "region_id": self._get_region_id(region),
                        "limit": limit,
                    },
                )

                if not response.is_success:
                    raise Exception(f"SE Ranking API error: {response.status_code}")

                data = response.json()
                return [
                    item.get("keyword", item) if isinstance(item, dict) else item
                    for item in data.get("keywords", [])
                ]

        except Exception as e:
            logger.error(f"Failed to get competitor keywords: {e}")
            return []
