#!/usr/bin/env python3
"""
OpenKeywords Pipeline Orchestrator

Runs the 5-stage keyword generation pipeline:
- Stage 1: Company Analysis (runs once)
- Stage 2: Deep Research (Reddit, Quora, forums)
- Stage 3: AI Keyword Generation
- Stage 4: Scoring & Deduplication
- Stage 5: Clustering

Usage:
    python run_pipeline.py --url https://example.com --count 50
    python run_pipeline.py --url https://example.com --research --count 100

Architecture:
    Stage 1: Company Analysis
         ↓
    Stage 2: Deep Research (optional)
         ↓
    Stage 3: AI Keyword Generation
         ↓
    Stage 4: Scoring & Deduplication
         ↓
    Stage 5: Clustering
         ↓
    [Output: Keywords + Clusters]
"""

import asyncio
import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

# Load .env from mono-python-service root
_BASE_PATH = Path(__file__).parent
_ROOT_PATH = _BASE_PATH.parent.parent
load_dotenv(_ROOT_PATH / ".env")

# Add paths for imports
if str(_BASE_PATH) not in sys.path:
    sys.path.insert(0, str(_BASE_PATH))

# Configure logging
logger = logging.getLogger(__name__)


async def run_pipeline(
    company_url: str,
    company_name: Optional[str] = None,
    target_count: int = 50,
    language: str = "en",
    region: str = "us",
    enable_research: bool = False,
    enable_clustering: bool = True,
    min_score: int = 40,
    min_word_count: int = 2,
    cluster_count: int = 6,
    # New options for SERP analysis
    research_focus: bool = False,
    enable_serp_analysis: bool = False,
    serp_sample_size: int = 15,
    enable_volume_lookup: bool = False,
    # Pre-provided company context from frontend
    company_context: Optional[dict] = None,
    system_instructions: Optional[str] = None,
    custom_instructions: Optional[str] = None,
) -> dict:
    """
    Run the full keyword generation pipeline.

    Args:
        company_url: Company website URL
        company_name: Optional company name override
        target_count: Target number of keywords
        language: Target language code
        region: Target region code
        enable_research: Enable deep research (Reddit, Quora)
        enable_clustering: Enable keyword clustering
        min_score: Minimum company-fit score
        min_word_count: Minimum keyword word count
        cluster_count: Number of clusters to create
        research_focus: Agency mode - 70% research keywords, strict filtering
        enable_serp_analysis: Enable SERP analysis for AEO opportunity scoring
        serp_sample_size: Number of top keywords to analyze for SERP features
        enable_volume_lookup: Get real search volumes from DataForSEO
        company_context: Pre-provided company context dict from frontend
        system_instructions: System-level instructions for AI
        custom_instructions: Additional custom instructions

    Returns:
        Dict with pipeline results
    """
    # Research focus mode: enable research automatically, increase min_word_count
    if research_focus:
        enable_research = True
        min_word_count = max(min_word_count, 4)  # Hyper-niche = longer keywords

    start_time = time.time()

    logger.info("=" * 60)
    logger.info("OpenKeywords Pipeline")
    logger.info("=" * 60)
    logger.info(f"URL: {company_url}")
    logger.info(f"Target: {target_count} keywords")
    logger.info(f"Language: {language}, Region: {region}")
    logger.info(f"Research: {'ON' if enable_research else 'OFF'}")
    logger.info(f"Research Focus: {'ON' if research_focus else 'OFF'}")
    logger.info(f"SERP Analysis: {'ON' if enable_serp_analysis else 'OFF'}")
    logger.info(f"Volume Lookup: {'ON' if enable_volume_lookup else 'OFF'}")
    logger.info(f"SERP Sample Size: {serp_sample_size}")
    logger.info("=" * 60)

    total_ai_calls = 0

    # =========================================================================
    # Stage 1: Company Analysis
    # =========================================================================
    from stage1 import run_stage_1
    from stage1.stage1_models import Stage1Input, Stage1Output, CompanyContext

    # Build additional context text from instructions and research files
    additional_context_parts = []
    if system_instructions:
        additional_context_parts.append(f"## System Instructions:\n{system_instructions}")
    if custom_instructions:
        additional_context_parts.append(f"## Custom Instructions:\n{custom_instructions}")

    # Include research files if provided
    if company_context and company_context.get("research_files"):
        research_text = "## Research Documents for Reference:\n"
        for f in company_context["research_files"][:5]:  # Limit to 5 files
            name = f.get("name", "Document")
            summary = f.get("aiAnalysis") or f.get("summary") or ""
            content = f.get("fullTextContent") or f.get("content", "")[:2000]
            labels = ", ".join(f.get("aiLabels", []) or f.get("labels", []))
            research_text += f"\n### {name}"
            if labels:
                research_text += f" [{labels}]"
            research_text += f"\n{summary}\n"
            if content:
                research_text += f"\nContent excerpt:\n{content[:2000]}\n"
        additional_context_parts.append(research_text)
        logger.info(f"  Added {len(company_context['research_files'])} research files to context")

    additional_context = "\n\n".join(additional_context_parts) if additional_context_parts else None

    if company_context:
        # Use pre-provided context from frontend (enhances Stage 1)
        logger.info("\n[Stage 1] Using pre-provided company context")

        # Create CompanyContext from provided dict
        ctx = CompanyContext(
            company_name=company_context.get("company_name") or company_name or "Unknown",
            company_url=company_context.get("company_url") or company_url,
            industry=company_context.get("industry") or "",
            description=company_context.get("description") or "",
            products=company_context.get("products") or [],
            target_audience=company_context.get("target_audience") or "",
            competitors=company_context.get("competitors") or [],
            tone=company_context.get("tone") or "professional",
            pain_points=company_context.get("pain_points") or [],
            value_propositions=company_context.get("value_propositions") or [],
            use_cases=company_context.get("use_cases") or [],
            content_themes=company_context.get("content_themes") or [],
        )

        # Create Stage1Output with pre-provided context
        stage1_output = Stage1Output(
            company_context=ctx,
            ai_calls=0,
            opencontext_called=False,
        )

        logger.info(f"  Company: {ctx.company_name}")
        logger.info(f"  Industry: {ctx.industry or 'Not specified'}")
        logger.info(f"  Products: {len(ctx.products)} items")
    else:
        # Run Stage 1 to extract context from company_url
        stage1_input = Stage1Input(
            company_url=company_url,
            company_name=company_name,
            language=language,
            region=region,
        )

        stage1_output = await run_stage_1(stage1_input)
        total_ai_calls += stage1_output.ai_calls

    logger.info(f"\n[Stage 1 Complete] {stage1_output.company_context.company_name}")

    # =========================================================================
    # Stage 2: Deep Research (optional)
    # =========================================================================
    from stage2 import run_stage_2
    from stage2.stage2_models import Stage2Input

    stage2_input = Stage2Input(
        company_context=stage1_output.company_context,
        language=language,
        region=region,
        target_count=target_count // 2,
        enable_research=enable_research,
    )

    stage2_output = await run_stage_2(stage2_input)
    total_ai_calls += stage2_output.ai_calls

    logger.info(f"\n[Stage 2 Complete] {len(stage2_output.keywords)} research keywords")

    # =========================================================================
    # Stage 3: AI Keyword Generation
    # =========================================================================
    from stage3 import run_stage_3
    from stage3.stage3_models import Stage3Input

    stage3_input = Stage3Input(
        company_context=stage1_output.company_context,
        research_keywords=stage2_output.keywords,
        language=language,
        region=region,
        target_count=target_count,
        enable_autocomplete=False,
    )

    stage3_output = await run_stage_3(stage3_input)
    total_ai_calls += stage3_output.ai_calls

    logger.info(f"\n[Stage 3 Complete] {len(stage3_output.keywords)} AI keywords")

    # =========================================================================
    # Combine all keywords for scoring
    # =========================================================================
    all_keywords = []

    # Add research keywords (preserve source attribution from Stage 2)
    for kw in stage2_output.keywords:
        all_keywords.append({
            "keyword": kw.keyword,
            "intent": kw.intent,
            "source": kw.source,
            "is_question": kw.intent == "question",
            # Source attribution from research
            "source_url": getattr(kw, "url", None),
            "source_title": getattr(kw, "source_title", None),
            "source_quote": getattr(kw, "quote", None),
            "content_opportunity": getattr(kw, "pain_point_extracted", None),
        })

    # Add AI keywords
    for kw in stage3_output.keywords:
        all_keywords.append({
            "keyword": kw.keyword,
            "intent": kw.intent,
            "source": kw.source,
            "is_question": kw.is_question,
        })

    logger.info(f"\n[Combined] {len(all_keywords)} total keywords before scoring")

    # =========================================================================
    # Stage 4: Scoring & Deduplication
    # =========================================================================
    from stage4 import run_stage_4
    from stage4.stage4_models import Stage4Input

    stage4_input = Stage4Input(
        company_context=stage1_output.company_context,
        keywords=all_keywords,
        min_score=min_score,
        min_word_count=min_word_count,
    )

    stage4_output = await run_stage_4(stage4_input)
    total_ai_calls += stage4_output.ai_calls

    logger.info(f"\n[Stage 4 Complete] {len(stage4_output.keywords)} scored keywords")

    # =========================================================================
    # Stage 5: Clustering
    # =========================================================================
    from stage5 import run_stage_5
    from stage5.stage5_models import Stage5Input

    stage5_input = Stage5Input(
        company_context=stage1_output.company_context,
        keywords=stage4_output.keywords,
        cluster_count=cluster_count,
        enable_clustering=enable_clustering,
    )

    stage5_output = await run_stage_5(stage5_input)
    total_ai_calls += stage5_output.ai_calls

    logger.info(f"\n[Stage 5 Complete] {len(stage5_output.clusters)} clusters")

    # =========================================================================
    # Stage 6: SERP Analysis & Volume Lookup (optional)
    # =========================================================================
    total_api_calls = 0
    total_api_cost = 0.0
    
    # Track enriched keywords separately to avoid Pydantic copy issues
    enriched_keywords = None

    if enable_serp_analysis or enable_volume_lookup:
        from stage6 import run_stage_6
        from stage6.stage6_models import Stage6Input

        # Convert ClusteredKeyword objects to dicts for Stage 6
        # Using dicts to avoid Pydantic class identity issues
        scored_keywords = [
            {
                "keyword": kw.keyword,
                "intent": kw.intent,
                "score": kw.score,
                "source": kw.source,
                "is_question": kw.is_question,
                "cluster_name": kw.cluster_name,
                "volume": 0,
                "difficulty": 0,
                "aeo_opportunity": 0,
                "has_featured_snippet": False,
                "has_paa": False,
                "serp_analyzed": False,
                "serp_data": None,
                "content_brief": None,
            }
            for kw in stage5_output.keywords
        ]

        stage6_input = Stage6Input(
            keywords=scored_keywords,
            enable_serp_analysis=enable_serp_analysis,
            enable_volume_lookup=enable_volume_lookup,
            serp_sample_size=serp_sample_size,
            language=language,
            region=region,
        )

        stage6_output = await run_stage_6(stage6_input)
        total_api_calls = stage6_output.api_calls
        total_api_cost = stage6_output.api_cost

        # Store enriched keywords directly (avoid Pydantic model field assignment)
        enriched_keywords = stage6_output.keywords

        logger.info(f"\n[Stage 6 Complete] SERP: {stage6_output.serp_analyzed_count}, Volume: {stage6_output.volume_enriched_count}")
    else:
        # If Stage 6 skipped, convert to ScoredKeyword format for Stage 7
        from stage4.stage4_models import ScoredKeyword
        enriched_keywords = [
            ScoredKeyword(
                keyword=kw.keyword,
                intent=kw.intent,
                score=kw.score,
                source=kw.source,
                is_question=kw.is_question,
                cluster_name=kw.cluster_name,
            )
            for kw in stage5_output.keywords
        ]

    # =========================================================================
    # Stage 7: Content Brief Generation
    # =========================================================================
    from stage7 import run_stage_7
    from stage7.stage7_models import Stage7Input

    # Pass keywords as dicts to avoid Pydantic creating copies
    keywords_for_stage7 = [kw.model_dump() for kw in enriched_keywords]
    
    # Generate content briefs for all keywords (use target_count to match SERP sample)
    stage7_input = Stage7Input(
        keywords=keywords_for_stage7,
        company_name=stage1_output.company_context.company_name,
        industry=stage1_output.company_context.industry,
        language=language,
        brief_sample_size=serp_sample_size,  # Generate briefs for same keywords as SERP
    )

    stage7_output = await run_stage_7(stage7_input)
    total_ai_calls += stage7_output.ai_calls

    # Use Stage 7 output keywords directly (these have content_brief populated)
    final_enriched_keywords = stage7_output.keywords

    logger.info(f"\n[Stage 7 Complete] {stage7_output.briefs_generated} content briefs generated")

    # =========================================================================
    # Enforce Exact Keyword Count
    # =========================================================================
    final_keywords = final_enriched_keywords
    
    if len(final_keywords) > target_count:
        # Sort by score (descending) and trim to exact target_count
        final_keywords = sorted(final_keywords, key=lambda k: k.score, reverse=True)[:target_count]
        logger.info(f"[Count Enforcement] Trimmed to exactly {target_count} keywords (had {len(final_enriched_keywords)})")
    elif len(final_keywords) < target_count:
        logger.warning(f"[Count Enforcement] Only {len(final_keywords)} keywords generated (target: {target_count})")

    # =========================================================================
    # Build Results
    # =========================================================================
    end_time = time.time()
    duration = end_time - start_time

    # Build statistics
    intent_breakdown = {}
    source_breakdown = {}
    total_score = 0

    for kw in final_keywords:
        intent_breakdown[kw.intent] = intent_breakdown.get(kw.intent, 0) + 1
        source_breakdown[kw.source] = source_breakdown.get(kw.source, 0) + 1
        total_score += kw.score

    avg_score = total_score / len(final_keywords) if final_keywords else 0

    results = {
        "company": {
            "name": stage1_output.company_context.company_name,
            "url": company_url,
            "industry": stage1_output.company_context.industry,
        },
        "config": {
            "language": language,
            "region": region,
            "target_count": target_count,
            "enable_research": enable_research,
            "enable_clustering": enable_clustering,
            "min_score": min_score,
            "research_focus": research_focus,
            "enable_serp_analysis": enable_serp_analysis,
            "enable_volume_lookup": enable_volume_lookup,
        },
        "statistics": {
            "total_keywords": len(final_keywords),
            "total_clusters": len(stage5_output.clusters),
            "avg_score": round(avg_score, 1),
            "duplicates_removed": stage4_output.duplicates_removed,
            "low_score_removed": stage4_output.low_score_removed,
            "ai_calls": total_ai_calls,
            "api_calls": total_api_calls,
            "api_cost_usd": round(total_api_cost, 4),
            "duration_seconds": round(duration, 1),
        },
        "intent_breakdown": intent_breakdown,
        "source_breakdown": source_breakdown,
        "keywords": [kw.model_dump() for kw in final_keywords],
        "clusters": [c.model_dump() for c in stage5_output.clusters],
        "created_at": datetime.now().isoformat(),
    }

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("Pipeline Complete")
    logger.info("=" * 60)
    logger.info(f"Keywords: {len(final_keywords)}")
    logger.info(f"Clusters: {len(stage5_output.clusters)}")
    logger.info(f"Avg Score: {avg_score:.1f}")
    logger.info(f"Duration: {duration:.1f}s")
    logger.info(f"AI Calls: {total_ai_calls}")
    logger.info("=" * 60)

    return results


def main():
    parser = argparse.ArgumentParser(
        description="OpenKeywords - AI Keyword Generation Pipeline"
    )
    parser.add_argument(
        "--url",
        type=str,
        required=True,
        help="Company website URL",
    )
    parser.add_argument(
        "--name",
        type=str,
        default=None,
        help="Company name override",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=50,
        help="Target keyword count (default: 50)",
    )
    parser.add_argument(
        "--language",
        type=str,
        default="en",
        help="Target language (default: en)",
    )
    parser.add_argument(
        "--region",
        type=str,
        default="us",
        help="Target region (default: us)",
    )
    parser.add_argument(
        "--research",
        action="store_true",
        help="Enable deep research (Reddit, Quora)",
    )
    parser.add_argument(
        "--no-clustering",
        action="store_true",
        help="Disable clustering",
    )
    parser.add_argument(
        "--min-score",
        type=int,
        default=40,
        help="Minimum score (default: 40)",
    )
    parser.add_argument(
        "--clusters",
        type=int,
        default=6,
        help="Number of clusters (default: 6)",
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        help="Output JSON file path",
    )

    args = parser.parse_args()

    # Run pipeline
    results = asyncio.run(run_pipeline(
        company_url=args.url,
        company_name=args.name,
        target_count=args.count,
        language=args.language,
        region=args.region,
        enable_research=args.research,
        enable_clustering=not args.no_clustering,
        min_score=args.min_score,
        cluster_count=args.clusters,
    ))

    # Save output
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)
        logger.info(f"\nOutput saved to: {output_path}")
    else:
        # Print summary to stdout
        print(json.dumps({
            "company": results["company"]["name"],
            "keywords": results["statistics"]["total_keywords"],
            "clusters": results["statistics"]["total_clusters"],
            "avg_score": results["statistics"]["avg_score"],
            "duration": results["statistics"]["duration_seconds"],
        }, indent=2))


if __name__ == "__main__":
    main()
