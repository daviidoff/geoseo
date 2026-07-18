"""
Stage Mentions - AI Visibility Check orchestrator.

Generates hyperniche queries and tests them with Gemini to measure
company visibility in AI responses.
"""

import asyncio
import json
import time
import logging
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.gemini_client import get_gemini_client
from .mentions_models import MentionsStageInput, MentionsStageOutput, QueryResult

logger = logging.getLogger(__name__)


async def generate_hyperniche_queries(
    company_name: str,
    industry: Optional[str],
    products: Optional[List[str]],
    target_audience: Optional[str],
    num_queries: int
) -> List[Dict[str, str]]:
    """Generate AI-powered hyperniche queries using Gemini."""

    products_str = ", ".join(products) if products else "N/A"

    prompt = f"""Generate {num_queries} hyperniche AEO visibility queries for {company_name}.

Company Data:
- Industry: {industry or 'N/A'}
- Products: {products_str}
- Target Audience: {target_audience or 'N/A'}

Query Distribution:
- 70% UNBRANDED (no mention of {company_name})
- 20% COMPETITIVE (alternatives, comparisons)
- 10% BRANDED ({company_name} + product)

Requirements:
- Layer 2-3 targeting dimensions (Industry + Role + Geo)
- Use actual ICP data
- Make queries hyper-specific

Examples:
- "best [product] for [target audience] United States"
- "enterprise [industry] [product] solutions"
- "[product] for [role] in [industry]"
- "{company_name} [product]" (only 1 branded)

Return as JSON array:
[{{"query": "actual query", "dimension": "UNBRANDED_HYPERNICHE"}}]"""

    try:
        client = get_gemini_client()
        response = await client.query_with_structured_output(
            prompt=prompt,
            system_prompt="You are a B2B hyperniche query generation expert.",
            model="gemini-3-flash-preview",
            response_format="json"
        )

        if response.get("success") and response.get("response"):
            text = response["response"].strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            queries = json.loads(text)
            return queries[:num_queries]
        else:
            raise Exception("AI query generation failed")

    except Exception as e:
        logger.warning(f"AI generation failed: {e}, using fallback")
        return [
            {"query": f"best {products[0] if products else 'solution'} for {industry or 'companies'}", "dimension": "Product-Industry"},
            {"query": f"{company_name} alternatives", "dimension": "Competitive"},
            {"query": f"{company_name}", "dimension": "Branded"}
        ][:num_queries]


async def test_query_with_gemini(query: str, company_name: str) -> QueryResult:
    """Test a single query with Gemini and detect company mentions."""
    try:
        client = get_gemini_client()
        response = await client.query_with_structured_output(
            prompt=query,
            system_prompt="Answer this query concisely.",
            model="gemini-3-flash-preview"
        )

        if response.get("success") and response.get("response"):
            text = response["response"]
            company_mentioned = company_name.lower() in text.lower()
            return QueryResult(
                query=query,
                has_response=True,
                company_mentioned=company_mentioned,
                response_length=len(text),
                response_preview=text[:200] if text else ""
            )
        return QueryResult(query=query, has_response=False, company_mentioned=False)
    except Exception as e:
        return QueryResult(
            query=query,
            has_response=False,
            company_mentioned=False,
            error=str(e)
        )


async def run_stage_mentions(input_data: MentionsStageInput) -> MentionsStageOutput:
    """Run AI visibility check with hyperniche query generation.

    Generates sophisticated queries that test organic visibility:
    - 70% unbranded (tests real organic discovery)
    - 20% competitive (comparison queries)
    - 10% branded (brand awareness)

    Tests queries with Gemini to measure visibility.

    Args:
        input_data: MentionsStageInput with company info

    Returns:
        MentionsStageOutput with visibility metrics
    """
    start_time = time.time()
    ai_calls = 0

    logger.info(f"[Stage Mentions] Starting visibility check for {input_data.company_name}")

    # Generate queries (1 AI call)
    logger.info(f"[Stage Mentions] Generating {input_data.num_queries} hyperniche queries...")
    queries = await generate_hyperniche_queries(
        input_data.company_name,
        input_data.industry,
        input_data.products,
        input_data.target_audience,
        input_data.num_queries
    )
    ai_calls += 1

    logger.info(f"[Stage Mentions] Generated {len(queries)} queries, testing...")

    # Test queries in parallel
    tasks = [test_query_with_gemini(q["query"], input_data.company_name) for q in queries]
    results = await asyncio.gather(*tasks)
    ai_calls += len(tasks)

    # Calculate metrics
    total_responses = sum(1 for r in results if r.has_response)
    total_mentions = sum(1 for r in results if r.company_mentioned)
    presence_rate = (total_responses / len(results) * 100) if results else 0
    mention_rate = (total_mentions / len(results) * 100) if results else 0

    visibility = mention_rate
    mentions = total_mentions
    quality_score = min(10.0, mention_rate / 10)

    execution_time = time.time() - start_time

    logger.info(f"[Stage Mentions] Completed: {mentions} mentions, {visibility:.1f}% visibility")

    return MentionsStageOutput(
        company_name=input_data.company_name,
        queries_generated=queries,
        query_results=list(results),
        visibility=visibility,
        mentions=mentions,
        presence_rate=presence_rate,
        quality_score=quality_score,
        execution_time=execution_time,
        ai_calls=ai_calls
    )


async def run_stage_mentions_dict(input_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Run mentions check from dict input, return dict output.

    Convenience wrapper for API endpoints.
    """
    input_data = MentionsStageInput(**input_dict)
    output = await run_stage_mentions(input_data)
    return output.model_dump()
