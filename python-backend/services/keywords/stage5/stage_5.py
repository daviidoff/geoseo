"""
Stage 5: Clustering

Groups keywords into semantic clusters using Gemini AI.
Uses core GeminiClient which has built-in retry with exponential backoff.
"""

import json
import logging
from typing import List, Dict

from core.gemini_client import GeminiClient
from core.config import ServiceType

from .stage5_models import Stage5Input, Stage5Output, ClusteredKeyword, Cluster

logger = logging.getLogger(__name__)

# Response schema for clustering
CLUSTERING_SCHEMA = {
    "type": "object",
    "properties": {
        "clusters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "keywords": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["name", "keywords"],
            },
        }
    },
    "required": ["clusters"],
}


async def run_stage_5(input_data: Stage5Input) -> Stage5Output:
    """
    Run Stage 5: Clustering

    Args:
        input_data: Stage5Input with scored keywords

    Returns:
        Stage5Output with clustered keywords
    """
    logger.info("=" * 60)
    logger.info("[Stage 5] Clustering")
    logger.info("=" * 60)

    company = input_data.company_context
    keywords = input_data.keywords

    logger.info(f"  Input keywords: {len(keywords)}")
    logger.info(f"  Target clusters: {input_data.cluster_count}")

    if not input_data.enable_clustering or not keywords:
        # Return keywords without clustering
        clustered = [
            ClusteredKeyword(
                keyword=kw.keyword,
                intent=kw.intent,
                score=kw.score,
                source=kw.source,
                is_question=kw.is_question,
                cluster_name=None,
            )
            for kw in keywords
        ]
        return Stage5Output(keywords=clustered, clusters=[], ai_calls=0)

    # Initialize core GeminiClient (has built-in retry)
    client = GeminiClient(service_type=ServiceType.KEYWORDS)

    # Build clustering prompt
    keyword_list = [kw.keyword for kw in keywords]

    prompt = f"""Group these keywords into {input_data.cluster_count} semantic clusters for {company.company_name}:

INDUSTRY: {company.industry or "N/A"}

KEYWORDS:
{json.dumps(keyword_list, indent=2)}

CLUSTERING RULES:
1. Create exactly {input_data.cluster_count} clusters
2. Each cluster should have a short, descriptive name (2-4 words)
3. Group by semantic similarity and topic
4. Every keyword must belong to exactly one cluster
5. Balance cluster sizes (avoid putting everything in one cluster)

Example cluster names:
- "Pricing & Plans"
- "How-To Guides"
- "Competitor Comparisons"
- "Product Features"
- "Industry Solutions"

Return JSON with clusters array, each containing name and keywords array."""

    try:
        # Use core GeminiClient with built-in retry
        data = await client.generate_with_schema(
            prompt=prompt,
            response_schema=CLUSTERING_SCHEMA,
            temperature=0.3,
        )

        # Build keyword-to-cluster mapping
        keyword_cluster_map: Dict[str, str] = {}
        clusters = []

        for cluster_data in data.get("clusters", []):
            cluster_name = cluster_data.get("name", "Uncategorized")
            cluster_keywords = cluster_data.get("keywords", [])

            clusters.append(Cluster(name=cluster_name, keywords=cluster_keywords))

            for kw in cluster_keywords:
                keyword_cluster_map[kw.lower()] = cluster_name

        # Apply clusters to keywords
        clustered_keywords = []
        for kw in keywords:
            cluster_name = keyword_cluster_map.get(kw.keyword.lower(), "Uncategorized")
            clustered_keywords.append(
                ClusteredKeyword(
                    keyword=kw.keyword,
                    intent=kw.intent,
                    score=kw.score,
                    source=kw.source,
                    is_question=kw.is_question,
                    cluster_name=cluster_name,
                )
            )

        logger.info(f"  ✓ Created {len(clusters)} clusters")
        for cluster in clusters:
            logger.info(f"    - {cluster.name}: {cluster.count} keywords")

        return Stage5Output(
            keywords=clustered_keywords,
            clusters=clusters,
            ai_calls=1,
        )

    except Exception as e:
        logger.error(f"Clustering failed: {e}")
        # Return keywords without clustering
        clustered = [
            ClusteredKeyword(
                keyword=kw.keyword,
                intent=kw.intent,
                score=kw.score,
                source=kw.source,
                is_question=kw.is_question,
                cluster_name="Uncategorized",
            )
            for kw in keywords
        ]
        return Stage5Output(keywords=clustered, clusters=[], ai_calls=1)
