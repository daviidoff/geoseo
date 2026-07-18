"""
Serper.dev client for SERP analysis.

Provides:
- Google SERP results
- Featured snippets
- People Also Ask
- Related searches

Pricing: $50 for 50,000 queries ($0.001 per query)
Docs: https://serper.dev/
"""

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Individual organic search result."""
    position: int
    title: str
    link: str
    snippet: str
    displayed_link: str = ""


@dataclass
class FeaturedSnippet:
    """Featured snippet data."""
    title: Optional[str] = None
    snippet: Optional[str] = None
    link: Optional[str] = None


@dataclass
class PeopleAlsoAsk:
    """People Also Ask item."""
    question: Optional[str] = None
    snippet: Optional[str] = None
    link: Optional[str] = None


@dataclass
class RelatedSearch:
    """Related search query."""
    query: Optional[str] = None


@dataclass
class SerpResponse:
    """SERP response from Serper."""
    success: bool
    query: str
    results: List[SearchResult] = field(default_factory=list)
    provider: str = "serper"
    cost: float = 0.0
    error: Optional[str] = None

    # Rich SERP features
    featured_snippet: Optional[FeaturedSnippet] = None
    people_also_ask: List[PeopleAlsoAsk] = field(default_factory=list)
    related_searches: List[RelatedSearch] = field(default_factory=list)

    # Metadata
    total_results: int = 0
    timestamp: Optional[str] = None


@dataclass
class KeywordData:
    """Keyword metrics (estimated from SERP)."""
    volume: int = 0
    cpc: float = 0.0
    competition: float = 0.0
    competition_level: str = ""
    difficulty: int = 50


class SerperClient:
    """
    Serper.dev client for Google SERP data.

    Provides rich search results including:
    - Organic results
    - Featured snippets
    - People Also Ask
    - Related searches

    Cost: $0.001 per query ($50 for 50,000)
    """

    BASE_URL = "https://google.serper.dev/search"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("SERPER_API_KEY", "")

        if self.is_configured():
            logger.info("Serper client initialized")
        else:
            logger.warning(
                "Serper not configured. Set SERPER_API_KEY environment variable."
            )

    def is_configured(self) -> bool:
        """Check if client has valid API key."""
        return bool(self.api_key)

    async def search(
        self,
        query: str,
        num_results: int = 10,
        country: str = "us",
        language: str = "en",
    ) -> SerpResponse:
        """
        Execute search query through Serper.

        Args:
            query: Search query
            num_results: Number of results (max 100)
            country: Country code (gl parameter)
            language: Language code (hl parameter)

        Returns:
            SerpResponse with results and SERP features
        """
        if not self.is_configured():
            return SerpResponse(
                success=False,
                query=query,
                error="Serper API key not configured.",
            )

        if not query:
            return SerpResponse(
                success=False,
                query=query,
                error="Query parameter is required",
            )

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.BASE_URL,
                    headers={
                        "X-API-KEY": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "q": query,
                        "gl": country.lower(),
                        "hl": language.lower(),
                        "num": min(num_results, 100),
                    },
                )

                if response.status_code == 401:
                    return SerpResponse(
                        success=False,
                        query=query,
                        error="Serper authentication failed. Check your API key.",
                    )

                if response.status_code == 429:
                    return SerpResponse(
                        success=False,
                        query=query,
                        error="Serper rate limit exceeded.",
                    )

                response.raise_for_status()
                data = response.json()

                return self._parse_response(data, query)

        except httpx.TimeoutException:
            return SerpResponse(
                success=False,
                query=query,
                error="Serper request timeout after 30s",
            )
        except Exception as e:
            logger.error(f"Serper error: {e}")
            return SerpResponse(
                success=False,
                query=query,
                error=f"Serper error: {str(e)}",
            )

    def _parse_response(self, data: dict, query: str) -> SerpResponse:
        """Parse Serper response into standardized format."""
        results: List[SearchResult] = []
        featured_snippet: Optional[FeaturedSnippet] = None
        people_also_ask: List[PeopleAlsoAsk] = []
        related_searches: List[RelatedSearch] = []

        # Parse organic results
        for idx, item in enumerate(data.get("organic", []), 1):
            results.append(SearchResult(
                position=item.get("position", idx),
                title=item.get("title", ""),
                link=item.get("link", ""),
                snippet=item.get("snippet", ""),
                displayed_link=item.get("displayedLink", ""),
            ))

        # Parse answer box / featured snippet
        if answer_box := data.get("answerBox"):
            featured_snippet = FeaturedSnippet(
                title=answer_box.get("title"),
                snippet=answer_box.get("snippet") or answer_box.get("answer"),
                link=answer_box.get("link"),
            )

        # Parse knowledge graph as alternative featured snippet
        if not featured_snippet and (kg := data.get("knowledgeGraph")):
            featured_snippet = FeaturedSnippet(
                title=kg.get("title"),
                snippet=kg.get("description"),
                link=kg.get("website"),
            )

        # Parse People Also Ask
        for paa in data.get("peopleAlsoAsk", []):
            people_also_ask.append(PeopleAlsoAsk(
                question=paa.get("question"),
                snippet=paa.get("snippet"),
                link=paa.get("link"),
            ))

        # Parse related searches
        for rs in data.get("relatedSearches", []):
            related_searches.append(RelatedSearch(
                query=rs.get("query"),
            ))

        return SerpResponse(
            success=True,
            query=query,
            results=results,
            provider="serper",
            cost=0.001,  # $0.001 per query
            featured_snippet=featured_snippet,
            people_also_ask=people_also_ask,
            related_searches=related_searches,
            total_results=len(results),
            timestamp=datetime.now().isoformat(),
        )

    async def get_keyword_data(
        self,
        keywords: List[str],
        language: str = "en",
        country: str = "us",
    ) -> Dict[str, KeywordData]:
        """
        Estimate keyword metrics from SERP analysis.

        Note: Serper doesn't provide volume/CPC directly.
        This returns estimated difficulty based on SERP features.

        For actual volume data, use a dedicated keyword API.
        """
        if not self.is_configured():
            return {}

        if not keywords:
            return {}

        result_map: Dict[str, KeywordData] = {}

        # Sample a subset of keywords to avoid excessive API calls
        sample_keywords = keywords[:20]

        for kw in sample_keywords:
            try:
                serp = await self.search(kw, num_results=10, country=country, language=language)
                if serp.success:
                    # Estimate difficulty based on SERP features
                    difficulty = self._estimate_difficulty(serp)
                    result_map[kw.lower()] = KeywordData(
                        volume=0,  # Serper doesn't provide volume
                        cpc=0.0,
                        competition=0.0,
                        competition_level="UNKNOWN",
                        difficulty=difficulty,
                    )
            except Exception as e:
                logger.warning(f"Failed to analyze keyword '{kw}': {e}")

        return result_map

    def _estimate_difficulty(self, serp: SerpResponse) -> int:
        """
        Estimate keyword difficulty from SERP features.

        Higher difficulty if:
        - Has featured snippet (competitive)
        - Has many PAA questions (informational intent established)
        - Top results are from authoritative domains
        """
        difficulty = 50  # Base difficulty

        # Featured snippet = more competitive
        if serp.featured_snippet:
            difficulty += 15

        # Many PAA = established query
        if len(serp.people_also_ask) >= 3:
            difficulty += 10

        # Check for authority domains in top 3
        authority_domains = [
            "wikipedia.org", "amazon.com", "youtube.com",
            "reddit.com", "quora.com", "linkedin.com",
            "forbes.com", "nytimes.com", "bbc.com",
        ]

        top_results = serp.results[:3]
        authority_count = sum(
            1 for r in top_results
            if any(domain in r.link.lower() for domain in authority_domains)
        )
        difficulty += authority_count * 5

        return min(difficulty, 100)


async def search_serp(
    query: str,
    country: str = "us",
    language: str = "en",
    api_key: Optional[str] = None,
) -> SerpResponse:
    """Convenience function for single SERP search."""
    client = SerperClient(api_key=api_key)
    return await client.search(query, country=country, language=language)
