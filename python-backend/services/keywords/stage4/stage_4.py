"""
Stage 4: Scoring & Deduplication

Scores keywords for company-fit and removes duplicates.
Uses core GeminiClient which has built-in retry with exponential backoff.
"""

import json
import logging
from typing import List, Dict, Any

from core.gemini_client import GeminiClient
from core.config import ServiceType

from .stage4_models import Stage4Input, Stage4Output, ScoredKeyword

logger = logging.getLogger(__name__)

# Response schema for scoring
SCORING_SCHEMA = {
    "type": "object",
    "properties": {
        "keywords": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string"},
                    "score": {"type": "integer", "minimum": 0, "maximum": 100},
                },
                "required": ["keyword", "score"],
            },
        }
    },
    "required": ["keywords"],
}


async def run_stage_4(input_data: Stage4Input) -> Stage4Output:
    """
    Run Stage 4: Scoring & Deduplication

    Args:
        input_data: Stage4Input with keywords and company context

    Returns:
        Stage4Output with scored and deduplicated keywords
    """
    logger.info("=" * 60)
    logger.info("[Stage 4] Scoring & Deduplication")
    logger.info("=" * 60)

    company = input_data.company_context
    keywords = input_data.keywords

    logger.info(f"  Input keywords: {len(keywords)}")

    # Initialize core GeminiClient (has built-in retry)
    client = GeminiClient(service_type=ServiceType.KEYWORDS)

    # Step 1: Fast deduplication
    keywords, dup_count = _deduplicate_fast(keywords)
    logger.info(f"  After dedup: {len(keywords)} ({dup_count} removed)")

    # Step 2: Score keywords
    keywords = await _score_keywords(client, keywords, company)
    logger.info(f"  Scored {len(keywords)} keywords")

    # Step 3: Filter by score
    original_count = len(keywords)
    keywords = [kw for kw in keywords if kw.get("score", 0) >= input_data.min_score]
    low_score_removed = original_count - len(keywords)
    logger.info(f"  After score filter: {len(keywords)} ({low_score_removed} removed)")

    # Step 4: Filter by word count
    if input_data.min_word_count > 2:
        before = len(keywords)
        keywords = [
            kw for kw in keywords
            if len(kw.get("keyword", "").split()) >= input_data.min_word_count
        ]
        logger.info(f"  After word count filter: {len(keywords)} ({before - len(keywords)} removed)")

    # Convert to ScoredKeyword objects
    scored_keywords = [
        ScoredKeyword(
            keyword=kw.get("keyword", ""),
            intent=kw.get("intent", "informational"),
            score=kw.get("score", 0),
            source=kw.get("source", "ai_generated"),
            is_question=kw.get("is_question", False),
        )
        for kw in keywords
    ]

    logger.info(f"  ✓ Output: {len(scored_keywords)} scored keywords")

    return Stage4Output(
        keywords=scored_keywords,
        duplicates_removed=dup_count,
        low_score_removed=low_score_removed,
        ai_calls=1,
    )


def _deduplicate_fast(keywords: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], int]:
    """Fast deduplication using exact match and token signature."""
    seen_exact = set()
    seen_tokens = set()
    unique = []
    dup_count = 0

    for kw in keywords:
        text = kw.get("keyword", "").lower().strip()
        if not text:
            continue

        # Exact match check
        if text in seen_exact:
            dup_count += 1
            continue

        # Token signature check (handles reordering)
        tokens = tuple(sorted(text.split()))
        if tokens in seen_tokens:
            dup_count += 1
            continue

        seen_exact.add(text)
        seen_tokens.add(tokens)
        unique.append(kw)

    return unique, dup_count


async def _score_keywords(
    client: GeminiClient,
    keywords: List[Dict[str, Any]],
    company,
) -> List[Dict[str, Any]]:
    """Score keywords for company-fit using core GeminiClient (has built-in retry)."""
    if not keywords:
        return []

    # Build company context for scoring
    products = ", ".join(company.products[:5]) if company.products else "N/A"
    services = ", ".join(company.services[:5]) if company.services else "N/A"
    pain_points = ", ".join(company.pain_points[:3]) if company.pain_points else "N/A"

    # Process in batches
    batch_size = 50
    scored = []

    for i in range(0, len(keywords), batch_size):
        batch = keywords[i:i + batch_size]
        keyword_list = [kw.get("keyword", "") for kw in batch]

        prompt = f"""Score these keywords for company-fit (0-100):

COMPANY: {company.company_name}
INDUSTRY: {company.industry or "N/A"}
PRODUCTS: {products}
SERVICES: {services}
PAIN POINTS: {pain_points}

SCORING CRITERIA:
- 80-100: Directly mentions company products/services/solutions
- 60-79: Highly relevant to company's pain points and value props
- 40-59: Generally relevant to industry/niche
- 20-39: Loosely related, might attract some relevant traffic
- 0-19: Not relevant, too generic, or wrong audience

KEYWORDS TO SCORE:
{json.dumps(keyword_list, indent=2)}

Return JSON with array of {{keyword, score}} for each."""

        try:
            # Use core GeminiClient with built-in retry
            data = await client.generate_with_schema(
                prompt=prompt,
                response_schema=SCORING_SCHEMA,
                temperature=0.2,
            )

            scores = {s["keyword"]: s["score"] for s in data.get("keywords", [])}

            # Apply scores to batch
            for kw in batch:
                text = kw.get("keyword", "")
                kw["score"] = scores.get(text, 50)
                scored.append(kw)

        except Exception as e:
            logger.error(f"Scoring batch failed: {e}")
            # Default to 50 if scoring fails
            for kw in batch:
                kw["score"] = 50
                scored.append(kw)

    return scored
