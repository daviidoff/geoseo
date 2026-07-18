"""
Mentions/Visibility Check Service

AI visibility checking using Gemini with Google Search grounding:
- 15+ query dimensions for comprehensive coverage
- Competitor mention extraction
- Advanced position detection with bonuses
- Token tracking
"""

import asyncio
import logging
import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from core.gemini_client import GeminiClient
from core.config import ServiceType

from .models import (
    MentionsRequest,
    MentionsResponse,
    QueryResult,
    PlatformStats,
    DimensionStats,
    CompanyAnalysis,
    CompetitorMention,
)

logger = logging.getLogger(__name__)

# Use internal implementation directly (more reliable than dynamic imports)
# The internal implementation matches the openanalytics stage_mentions logic


# =============================================================================
# Query Dimensions (15+ types matching TypeScript)
# =============================================================================

QUERY_DIMENSIONS = {
    # Core dimensions
    "branded": [
        "What is {company}?",
        "Tell me about {company}",
        "{company} reviews",
    ],
    "comparison": [
        "Best alternatives to {company}",
        "{company} vs competitors",
        "Top {industry} solutions",
    ],
    "solution": [
        "Best {industry} software",
        "How to solve {problem}",
        "Top tools for {use_case}",
    ],
    "use_case": [
        "Best tool for {use_case}",
        "How to {action}",
        "{industry} software recommendations",
    ],
    # Extended dimensions (TypeScript parity)
    "ai_platform_geography": [
        "Best {industry} software in {country}",
        "Top {industry} tools for {country} market",
    ],
    "service_geography": [
        "Best {service} providers in {country}",
        "{service} companies in {country}",
    ],
    "industry_geography": [
        "Top {industry} companies in {country}",
        "Leading {industry} solutions for {country}",
    ],
    "industry_geography_intent": [
        "Best {industry} software for {country} businesses",
        "How to choose {industry} tools in {country}",
    ],
    "compliance_focused": [
        "Best {compliance} compliant {industry} software",
        "{industry} tools with {compliance} certification",
        "Top {compliance} certified solutions",
    ],
    "service_specific": [
        "Best software for {service}",
        "Top {service} tools 2024",
        "How to improve {service}",
    ],
    "industry_vertical": [
        "Best {industry} software for {vertical}",
        "{vertical} {industry} solutions",
    ],
    "competitive": [
        "Is {company} better than {competitor}?",
        "{company} vs {competitor} comparison",
        "Should I use {company} or {competitor}?",
    ],
    "broad_category": [
        "Best {category} software",
        "Top {category} tools",
        "Leading {category} platforms",
    ],
}

# Quality scoring based on mention type
QUALITY_SCORES = {
    "primary_recommendation": 9.0,
    "top_option": 7.0,
    "listed_option": 5.0,
    "mentioned_in_context": 3.0,
    "competitive_mention": 2.0,
    "passing_mention": 1.0,
    "no_mention": 0.0,
}

# Position bonuses (TypeScript parity: +2.0 for #1, +1.0 for ≤3, +0.5 for ≤5)
POSITION_BONUS = {
    1: 2.0,
    2: 1.0,
    3: 1.0,
    4: 0.5,
    5: 0.5,
}

# Multiple mentions bonus (TypeScript parity)
MULTIPLE_MENTIONS_BONUS = 0.5  # Per additional mention, capped


# =============================================================================
# Company Analysis Validation (TypeScript parity)
# =============================================================================

def validate_company_analysis(company_analysis: Optional[CompanyAnalysis]) -> Dict[str, Any]:
    """
    Validate company analysis has real data before running mentions check.

    TypeScript parity: Ensures meaningful visibility scores by requiring
    products or services data.

    Returns:
        Dict with 'valid', 'error', and 'details' fields
    """
    if not company_analysis:
        return {
            "valid": False,
            "error": "Company analysis required",
            "details": {
                "message": "AEO mentions check requires company analysis data.",
                "requirement": "Provide company_analysis with products or services.",
            }
        }

    company_info = company_analysis.company_info or {}

    products = company_info.get("products", [])
    services = company_info.get("services", [])
    industry = company_info.get("industry", "")
    description = company_info.get("description", "")

    has_products_or_services = len(products) > 0 or len(services) > 0

    if not has_products_or_services:
        return {
            "valid": False,
            "error": "Real company analysis data required",
            "details": {
                "message": (
                    "AEO mentions check requires REAL company analysis with products or services data. "
                    "Basic CSV data (industry only) is NOT sufficient for meaningful visibility scores. "
                    "Run company analysis first, then include the full result."
                ),
                "validation": {
                    "products": len(products),
                    "services": len(services),
                    "industry": industry or "missing",
                    "description_length": len(description),
                },
                "requirement": "At least one product or service from company analysis is required.",
            }
        }

    return {"valid": True}


# =============================================================================
# Query Generation
# =============================================================================

def generate_queries(
    company_name: str,
    company_analysis: Optional[CompanyAnalysis],
    num_queries: int,
    mode: str,
) -> List[Dict[str, str]]:
    """Generate diverse queries based on company info and mode."""
    queries = []

    # Extract company info
    company_info = {}
    if company_analysis and company_analysis.company_info:
        company_info = company_analysis.company_info

    industry = company_info.get("industry", "technology")
    products = company_info.get("products", [])
    services = company_info.get("services", products)
    use_cases = company_info.get("useCases", company_info.get("use_cases", []))
    problems = company_info.get("painPoints", company_info.get("pain_points", []))
    competitors = company_info.get("competitors", [])

    # Extended fields
    countries = []
    if company_analysis:
        countries = company_analysis.countries or ["US", "UK", "Germany"]
    compliance_flags = []
    if company_analysis:
        compliance_flags = company_analysis.compliance_flags or []
    product_categories = []
    if company_analysis:
        product_categories = company_analysis.product_categories or [industry]

    # Generate branded queries
    for template in QUERY_DIMENSIONS["branded"]:
        queries.append({
            "query": template.format(company=company_name),
            "dimension": "branded",
        })

    # Generate comparison queries
    for template in QUERY_DIMENSIONS["comparison"]:
        queries.append({
            "query": template.format(company=company_name, industry=industry),
            "dimension": "comparison",
        })

    # Generate solution queries from problems
    if problems:
        for problem in problems[:3]:
            queries.append({
                "query": f"Best solution for {problem}",
                "dimension": "solution",
            })

    # Generate use case queries
    if use_cases:
        for use_case in use_cases[:3]:
            queries.append({
                "query": f"Best tool for {use_case}",
                "dimension": "use_case",
            })

    # Generate industry queries
    queries.append({
        "query": f"Best {industry} software 2024",
        "dimension": "solution",
    })
    queries.append({
        "query": f"Top {industry} companies",
        "dimension": "solution",
    })

    # Product-specific queries
    if products:
        for product in products[:2]:
            product_name = product if isinstance(product, str) else product.get("name", "")
            if product_name:
                queries.append({
                    "query": f"Best {product_name} alternatives",
                    "dimension": "comparison",
                })

    # Geography-based queries
    if countries:
        for c in countries[:2]:
            queries.append({
                "query": f"Best {industry} software in {c}",
                "dimension": "ai_platform_geography",
            })

    # Compliance-focused queries
    if compliance_flags:
        for compliance in compliance_flags[:2]:
            queries.append({
                "query": f"Best {compliance} compliant {industry} software",
                "dimension": "compliance_focused",
            })

    # Service-specific queries
    if services:
        for service in services[:2]:
            service_name = service if isinstance(service, str) else service.get("name", "")
            if service_name:
                queries.append({
                    "query": f"Best software for {service_name}",
                    "dimension": "service_specific",
                })

    # Competitive queries
    if competitors:
        for comp in competitors[:2]:
            comp_name = comp if isinstance(comp, str) else comp.get("name", "")
            if comp_name:
                queries.append({
                    "query": f"{company_name} vs {comp_name} comparison",
                    "dimension": "competitive",
                })

    # Category queries
    for category in product_categories[:2]:
        queries.append({
            "query": f"Best {category} software",
            "dimension": "broad_category",
        })

    # Limit to requested number
    queries = queries[:num_queries]

    # If we need more queries, add generic ones
    while len(queries) < num_queries:
        queries.append({
            "query": f"What companies offer {industry} solutions?",
            "dimension": "solution",
        })

    return queries[:num_queries]


# =============================================================================
# Position Detection (Enhanced - TypeScript parity)
# =============================================================================

def detect_list_position(response: str, company_name: str) -> Optional[int]:
    """
    Detect position in numbered/bulleted list.

    Returns position (1-indexed) or None if not in a list.
    TypeScript parity: Uses regex to find numbered/bulleted items.
    """
    response_lower = response.lower()
    company_lower = company_name.lower()

    # Patterns for list positions
    patterns = [
        # Numbered lists: "1. Company", "1) Company", "#1 Company"
        rf"(?:^|\n)\s*(\d+)[.\)]\s*(?:\*\*)?{re.escape(company_lower)}",
        rf"#(\d+)\s+{re.escape(company_lower)}",
        # Bullet with position: "• #1 Company"
        rf"[•\-\*]\s*#?(\d+)[:\s]+{re.escape(company_lower)}",
    ]

    for pattern in patterns:
        match = re.search(pattern, response_lower, re.MULTILINE)
        if match:
            try:
                position = int(match.group(1))
                if 1 <= position <= 20:  # Reasonable range
                    return position
            except (ValueError, IndexError):
                continue

    return None


# =============================================================================
# Competitor Extraction (TypeScript parity)
# =============================================================================

def extract_competitor_mentions(
    response: str,
    known_competitors: List[str],
    company_name: str,
) -> List[CompetitorMention]:
    """
    Extract competitor mentions from response.

    Returns list of competitors mentioned with counts.
    """
    response_lower = response.lower()
    company_lower = company_name.lower()

    competitor_counts: Dict[str, int] = defaultdict(int)

    for competitor in known_competitors:
        if isinstance(competitor, dict):
            comp_name = competitor.get("name", "")
        else:
            comp_name = str(competitor)

        if not comp_name or comp_name.lower() == company_lower:
            continue

        # Count mentions (case-insensitive)
        count = response_lower.count(comp_name.lower())
        if count > 0:
            competitor_counts[comp_name] = count

    return [
        CompetitorMention(name=name, count=count)
        for name, count in sorted(competitor_counts.items(), key=lambda x: -x[1])
    ]


# =============================================================================
# Mention Detection (Enhanced)
# =============================================================================

def detect_mention_type(
    response: str,
    company_name: str,
    known_competitors: List[str] = None,
) -> Tuple[str, int, float, Optional[int], List[CompetitorMention]]:
    """
    Detect mention type and calculate quality score.

    Returns: (mention_type, mentions_count, quality_score, position, competitor_mentions)
    """
    response_lower = response.lower()
    company_lower = company_name.lower()

    # Count mentions
    mentions = response_lower.count(company_lower)

    # Detect position
    position = detect_list_position(response, company_name)

    # Extract competitor mentions
    competitor_mentions = []
    if known_competitors:
        competitor_mentions = extract_competitor_mentions(
            response, known_competitors, company_name
        )

    if mentions == 0:
        return "no_mention", 0, 0.0, None, competitor_mentions

    # Check for primary recommendation patterns
    primary_patterns = [
        rf"(?:recommend|suggest|best choice is|top pick is|#1 is|number one is).*{re.escape(company_lower)}",
        rf"{re.escape(company_lower)}.*(?:is the best|is recommended|is my top|leads the)",
        rf"(?:first|primarily|mainly|especially).*{re.escape(company_lower)}",
    ]

    for pattern in primary_patterns:
        if re.search(pattern, response_lower):
            base_score = QUALITY_SCORES["primary_recommendation"]
            bonus = _calculate_bonuses(position, mentions)
            return "primary_recommendation", mentions, min(base_score + bonus, 10.0), position, competitor_mentions

    # Check for top option patterns
    top_patterns = [
        rf"(?:top|leading|best|excellent|outstanding).*{re.escape(company_lower)}",
        rf"{re.escape(company_lower)}.*(?:is excellent|is great|stands out|excels)",
    ]

    for pattern in top_patterns:
        if re.search(pattern, response_lower):
            base_score = QUALITY_SCORES["top_option"]
            bonus = _calculate_bonuses(position, mentions)
            return "top_option", mentions, min(base_score + bonus, 10.0), position, competitor_mentions

    # Check for list position
    if position:
        base_score = QUALITY_SCORES["listed_option"]
        bonus = _calculate_bonuses(position, mentions)
        return "listed_option", mentions, min(base_score + bonus, 10.0), position, competitor_mentions

    # Check if mentioned alongside competitors (competitive context)
    if competitor_mentions:
        base_score = QUALITY_SCORES["competitive_mention"]
        bonus = _calculate_bonuses(position, mentions)
        return "competitive_mention", mentions, min(base_score + bonus, 10.0), position, competitor_mentions

    # Default: mentioned in context
    base_score = QUALITY_SCORES["mentioned_in_context"]
    bonus = _calculate_bonuses(position, mentions)
    return "mentioned_in_context", mentions, min(base_score + bonus, 10.0), position, competitor_mentions


def _calculate_bonuses(position: Optional[int], mentions: int) -> float:
    """Calculate position and multiple mentions bonuses."""
    bonus = 0.0

    # Position bonus
    if position:
        bonus += POSITION_BONUS.get(position, 0)

    # Multiple mentions bonus (TypeScript parity)
    if mentions > 1:
        capped_mentions = min(mentions, 5)
        bonus += min(1.0, (capped_mentions - 1) * MULTIPLE_MENTIONS_BONUS)

    return bonus


def calculate_visibility_band(visibility: float) -> str:
    """Calculate visibility band from score."""
    if visibility >= 80:
        return "Dominant"
    elif visibility >= 60:
        return "Strong"
    elif visibility >= 40:
        return "Moderate"
    elif visibility >= 20:
        return "Weak"
    else:
        return "Minimal"


# =============================================================================
# Query Processing (Gemini only)
# =============================================================================

async def process_query(
    client: GeminiClient,
    query: str,
    dimension: str,
    company_name: str,
    known_competitors: List[str],
) -> QueryResult:
    """Process a query using Gemini with Google Search grounding."""
    start_time = time.time()

    try:
        response = await client.generate(
            prompt=query,
            use_url_context=False,
            use_google_search=True,
            json_output=False,
            temperature=0.3,
        )

        response_text = response if isinstance(response, str) else str(response)
        mention_type, mentions, quality_score, position, competitor_mentions = detect_mention_type(
            response_text, company_name, known_competitors
        )

        latency_ms = int((time.time() - start_time) * 1000)
        tokens_used = len(response_text) // 4

        return QueryResult(
            query=query,
            dimension=dimension,
            response=response_text[:500],
            mentions=mentions,
            quality_score=quality_score,
            mention_type=mention_type,
            tokens_used=tokens_used,
            latency_ms=latency_ms,
            platform="gemini",
            position=position,
            competitor_mentions=competitor_mentions,
            cost=0.0001,  # Gemini is very cheap
        )
    except Exception as e:
        logger.error(f"Gemini query failed: {query} - {e}")
        return QueryResult(
            query=query,
            dimension=dimension,
            response=f"Error: {str(e)}",
            mentions=0,
            quality_score=0,
            mention_type="error",
            tokens_used=0,
            latency_ms=int((time.time() - start_time) * 1000),
            platform="gemini",
            cost=0,
        )


# =============================================================================
# Main Service
# =============================================================================

async def check_mentions(request: MentionsRequest) -> MentionsResponse:
    """
    Run mentions/visibility check using internal implementation.
    
    Matches the openanalytics stage_mentions logic:
    - Generates hyperniche queries based on company analysis
    - Tests queries with Gemini + Google Search grounding
    - Calculates visibility, mentions, and quality scores
    """
    start_time = time.time()
    checked_at = datetime.now(timezone.utc).isoformat()

    # Determine number of queries
    num_queries = request.num_queries
    if num_queries is None:
        num_queries = 10 if request.mode == "fast" else 20

    logger.info(f"[Mentions] Starting check for {request.company_name} ({num_queries} queries, mode={request.mode})")

    # Extract company info
    company_info = request.company_analysis.company_info if request.company_analysis else {}
    known_competitors = []
    if request.company_analysis and request.company_analysis.competitors:
        known_competitors = [
            c.get("name") if isinstance(c, dict) else str(c) 
            for c in request.company_analysis.competitors
        ]

    # Generate queries based on company analysis
    queries = generate_queries(
        company_name=request.company_name,
        company_analysis=request.company_analysis,
        num_queries=num_queries,
        mode=request.mode,
    )

    logger.info(f"[Mentions] Generated {len(queries)} queries, testing with Gemini...")

    # Initialize Gemini client
    client = GeminiClient(service_type=ServiceType.MENTIONS)

    # Process queries in parallel
    tasks = [
        process_query(
            client=client,
            query=q["query"],
            dimension=q["dimension"],
            company_name=request.company_name,
            known_competitors=known_competitors,
        )
        for q in queries
    ]
    query_results = await asyncio.gather(*tasks)

    # Calculate aggregate metrics
    total_mentions = sum(r.mentions for r in query_results)
    total_responses = sum(1 for r in query_results if r.mention_type != "error")
    total_with_mentions = sum(1 for r in query_results if r.mentions > 0)
    
    presence_rate = (total_responses / len(query_results) * 100) if query_results else 0
    visibility = (total_with_mentions / len(query_results) * 100) if query_results else 0
    
    # Average quality score (only for queries with mentions)
    quality_scores = [r.quality_score for r in query_results if r.mentions > 0]
    avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0.0

    # Build dimension stats
    dimension_stats_response: Dict[str, DimensionStats] = {}
    for result in query_results:
        dim = result.dimension or "general"
        if dim not in dimension_stats_response:
            dimension_stats_response[dim] = DimensionStats(
                queries=0, mentions=0, quality_avg=0.0, visibility=0.0
            )
        stats = dimension_stats_response[dim]
        stats.queries += 1
        stats.mentions += result.mentions
        if result.mentions > 0:
            stats.quality_avg = (stats.quality_avg * (stats.queries - 1) + result.quality_score) / stats.queries

    # Calculate visibility per dimension
    for dim, stats in dimension_stats_response.items():
        dim_results = [r for r in query_results if r.dimension == dim]
        dim_with_mentions = sum(1 for r in dim_results if r.mentions > 0)
        stats.visibility = (dim_with_mentions / len(dim_results) * 100) if dim_results else 0

    # Platform stats
    total_tokens = sum(r.tokens_used for r in query_results)
    total_cost = sum(r.cost for r in query_results)
    
    platform_stats_response = {
        "gemini": PlatformStats(
            queries=len(query_results),
            mentions=total_mentions,
            quality_avg=avg_quality,
            tokens=total_tokens,
            cost=total_cost,
        )
    }

    # Competitor summary
    all_competitors: Dict[str, int] = {}
    for result in query_results:
        for comp in result.competitor_mentions:
            all_competitors[comp.name] = all_competitors.get(comp.name, 0) + comp.count
    
    competitor_summary = [
        CompetitorMention(name=name, count=count)
        for name, count in sorted(all_competitors.items(), key=lambda x: -x[1])[:10]
    ]

    execution_time = time.time() - start_time

    logger.info(
        f"[Mentions] Completed: {request.company_name} - {visibility:.1f}% visibility, {total_mentions} mentions in {execution_time:.1f}s"
    )

    return MentionsResponse(
        company_name=request.company_name,
        visibility=round(visibility, 1),
        band=calculate_visibility_band(visibility),
        mentions=total_mentions,
        presence_rate=round(presence_rate, 1),
        quality_score=round(avg_quality, 2),
        max_quality=10.0,
        platform_stats=platform_stats_response,
        dimension_stats=dimension_stats_response,
        query_results=list(query_results),
        queries_processed=len(query_results),
        execution_time_seconds=round(execution_time, 2),
        mode=request.mode,
        total_cost=round(total_cost, 4),
        total_tokens=total_tokens,
        platforms_used=["gemini"],
        checked_at=checked_at,
        competitor_summary=competitor_summary,
    )
