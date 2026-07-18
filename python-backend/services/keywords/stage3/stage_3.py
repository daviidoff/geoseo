"""
Stage 3: AI Keyword Generation

Generates keywords using Gemini AI based on company context.
Uses core GeminiClient which has built-in retry with exponential backoff.
"""

import logging
from typing import List

from core.gemini_client import GeminiClient
from core.config import ServiceType

from .stage3_models import Stage3Input, Stage3Output, GeneratedKeyword

logger = logging.getLogger(__name__)

# Response schema for keyword generation
KEYWORD_SCHEMA = {
    "type": "object",
    "properties": {
        "keywords": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string"},
                    "intent": {"type": "string", "enum": ["transactional", "commercial", "informational", "question", "comparison"]},
                    "is_question": {"type": "boolean"},
                },
                "required": ["keyword", "intent"],
            },
        }
    },
    "required": ["keywords"],
}


async def run_stage_3(input_data: Stage3Input) -> Stage3Output:
    """
    Run Stage 3: AI Keyword Generation

    Args:
        input_data: Stage3Input with company context and research keywords

    Returns:
        Stage3Output with generated keywords
    """
    logger.info("=" * 60)
    logger.info("[Stage 3] AI Keyword Generation")
    logger.info("=" * 60)

    company = input_data.company_context
    logger.info(f"  Company: {company.company_name}")
    logger.info(f"  Research keywords: {len(input_data.research_keywords)}")

    # Initialize core GeminiClient (has built-in retry)
    client = GeminiClient(service_type=ServiceType.KEYWORDS)

    # Calculate how many AI keywords we need
    existing_count = len(input_data.research_keywords)
    ai_target = max(input_data.target_count - existing_count, input_data.target_count // 3)

    logger.info(f"  Generating {ai_target} AI keywords")

    # Build comprehensive prompt
    products = ", ".join(company.products[:5]) if company.products else "N/A"
    services = ", ".join(company.services[:5]) if company.services else "N/A"
    pain_points = ", ".join(company.pain_points[:5]) if company.pain_points else "N/A"
    differentiators = ", ".join(company.differentiators[:3]) if company.differentiators else "N/A"

    prompt = f"""Generate {ai_target} SEO keywords for this company:

COMPANY: {company.company_name}
INDUSTRY: {company.industry or "N/A"}
PRODUCTS: {products}
SERVICES: {services}
PAIN POINTS: {pain_points}
DIFFERENTIATORS: {differentiators}
TARGET REGION: {input_data.region.upper()}
LANGUAGE: {input_data.language}

REQUIREMENTS:
1. Generate DIVERSE keywords across these intents:
   - transactional (buy, pricing, demo)
   - commercial (comparison, alternatives, vs)
   - informational (how to, what is, guide)
   - question (actual questions users ask)

2. Include:
   - Long-tail keywords (3-5 words)
   - Question keywords ("how to...", "what is...")
   - Comparison keywords ("X vs Y", "alternatives to")
   - Product-specific keywords
   - Problem-solving keywords

3. AVOID:
   - Generic industry terms
   - Single-word keywords
   - Duplicate variations

Return JSON with array of keywords, each with:
- keyword: the keyword text
- intent: one of [transactional, commercial, informational, question, comparison]
- is_question: true if it's a question"""

    try:
        # Use core GeminiClient with built-in retry
        data = await client.generate_with_schema(
            prompt=prompt,
            response_schema=KEYWORD_SCHEMA,
            temperature=0.7,
        )

        keywords = [
            GeneratedKeyword(
                keyword=kw.get("keyword", ""),
                intent=kw.get("intent", "informational"),
                source="ai_generated",
                is_question=kw.get("is_question", False),
            )
            for kw in data.get("keywords", [])
            if kw.get("keyword")
        ]

        logger.info(f"  ✓ Generated {len(keywords)} AI keywords")

        return Stage3Output(
            keywords=keywords,
            ai_calls=1,
        )

    except Exception as e:
        logger.error(f"AI keyword generation failed: {e}")
        return Stage3Output(keywords=[], ai_calls=1)
