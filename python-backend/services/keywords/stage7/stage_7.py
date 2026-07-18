"""
ABOUTME: Stage 7 - Content Brief Generation
ABOUTME: Generates content briefs for top keywords using AI and SERP data.
Uses core GeminiClient which has built-in retry with exponential backoff.
"""

import asyncio
import logging
from typing import List, Optional

from core.gemini_client import GeminiClient
from core.config import ServiceType

from .stage7_models import Stage7Input, Stage7Output, ContentBrief
from services.keywords.stage4.stage4_models import ScoredKeyword

logger = logging.getLogger(__name__)

# Response schema for content brief
CONTENT_BRIEF_SCHEMA = {
    "type": "object",
    "properties": {
        "content_angle": {"type": "string"},
        "target_questions": {"type": "array", "items": {"type": "string"}},
        "content_gap": {"type": "string"},
        "audience_pain_point": {"type": "string"},
        "recommended_word_count": {"type": "integer"},
    },
    "required": ["content_angle", "target_questions", "content_gap", "audience_pain_point", "recommended_word_count"],
}


async def run_stage_7(input_data: Stage7Input) -> Stage7Output:
    """
    Run Stage 7: Content Brief Generation
    
    Generates content briefs for top keywords based on SERP data and company context.
    
    Args:
        input_data: Stage7Input with keywords and options
        
    Returns:
        Stage7Output with keywords enriched with content briefs
    """
    logger.info("=" * 60)
    logger.info("[Stage 7] Content Brief Generation")
    logger.info("=" * 60)
    
    keywords = list(input_data.keywords)

    if not keywords:
        logger.info("  No keywords to process")
        return Stage7Output(keywords=keywords)

    # Initialize core GeminiClient (has built-in retry)
    client = GeminiClient(service_type=ServiceType.KEYWORDS)

    # Sort by score and take top N for content brief generation
    sorted_keywords = sorted(keywords, key=lambda k: k.score, reverse=True)
    sample_keywords = sorted_keywords[:input_data.brief_sample_size]

    logger.info(f"  Generating content briefs for top {len(sample_keywords)} keywords...")

    ai_calls = 0
    briefs_generated = 0

    # Process in batches of 5 for efficiency
    batch_size = 5
    for i in range(0, len(sample_keywords), batch_size):
        batch = sample_keywords[i:i + batch_size]

        # Generate briefs in parallel
        tasks = [
            _generate_brief_for_keyword(
                client,
                kw,
                input_data.company_name,
                input_data.industry,
                input_data.language
            )
            for kw in batch
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        ai_calls += len(batch)
        
        for kw, result in zip(batch, results):
            if isinstance(result, Exception):
                logger.error(f"  Brief generation failed for '{kw.keyword}': {result}")
            elif result:
                kw.content_brief = result
                briefs_generated += 1
        
        # Small delay between batches
        if i + batch_size < len(sample_keywords):
            await asyncio.sleep(0.3)
    
    logger.info(f"  ✓ Generated {briefs_generated} content briefs")
    
    # Use model_construct to avoid Pydantic creating copies of the keywords
    # This preserves the content_brief modifications we made
    return Stage7Output.model_construct(
        keywords=keywords,
        briefs_generated=briefs_generated,
        ai_calls=ai_calls,
    )


async def _generate_brief_for_keyword(
    client: GeminiClient,
    keyword: ScoredKeyword,
    company_name: str,
    industry: str,
    language: str,
) -> Optional[dict]:
    """
    Generate a content brief for a single keyword.
    Uses core GeminiClient (has built-in retry).

    Uses SERP data (if available) to understand the competitive landscape
    and generate actionable content recommendations.
    """
    # Build context from SERP data
    serp_context = ""
    if keyword.serp_data:
        organic = keyword.serp_data.get("organic_results", [])[:5]
        if organic:
            titles = [r.get("title", "") for r in organic if r.get("title")]
            serp_context = f"\nTop ranking content titles:\n" + "\n".join(f"- {t}" for t in titles[:5])

        paa = keyword.serp_data.get("paa_questions", [])
        if paa:
            questions = [q.get("question", "") for q in paa if q.get("question")]
            serp_context += f"\n\nPeople Also Ask questions:\n" + "\n".join(f"- {q}" for q in questions[:5])

        if keyword.serp_data.get("featured_snippet"):
            fs = keyword.serp_data["featured_snippet"]
            serp_context += f"\n\nFeatured snippet exists: {fs.get('source_title', 'Yes')}"

    prompt = f"""Generate a content brief for the keyword: "{keyword.keyword}"

Company: {company_name}
Industry: {industry or "General"}
Search Intent: {keyword.intent}
Is Question: {"Yes" if keyword.is_question else "No"}
{serp_context}

Generate a content brief with these fields:
1. content_angle: A unique angle or perspective to differentiate from competitors (1-2 sentences)
2. target_questions: 3-5 key questions the content should answer
3. content_gap: What's missing from existing content that we can fill (1 sentence)
4. audience_pain_point: The main pain point to address (1 sentence)
5. recommended_word_count: Recommended word count based on topic complexity (number between 800-3000)"""

    try:
        # Use core GeminiClient with built-in retry
        data = await client.generate_with_schema(
            prompt=prompt,
            response_schema=CONTENT_BRIEF_SCHEMA,
            temperature=0.7,
        )

        # Validate and normalize
        brief = {
            "content_angle": str(data.get("content_angle", ""))[:500],
            "target_questions": [str(q)[:200] for q in data.get("target_questions", [])[:5]],
            "content_gap": str(data.get("content_gap", ""))[:300],
            "audience_pain_point": str(data.get("audience_pain_point", ""))[:300],
            "recommended_word_count": min(max(int(data.get("recommended_word_count", 1500)), 500), 5000),
        }

        return brief

    except Exception as e:
        logger.error(f"  Error generating brief for '{keyword.keyword}': {e}")
        return None
