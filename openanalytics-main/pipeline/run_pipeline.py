#!/usr/bin/env python3
"""
OpenAnalytics - Main Pipeline Orchestrator

Runs health and mentions checks in parallel or sequence.

Usage:
    python run_pipeline.py --url https://example.com
    python run_pipeline.py --company "Example Corp" --industry "SaaS"
    python run_pipeline.py --url https://example.com --company "Example Corp"

Architecture:
    ┌──────────────┬──────────────┐
    │              │              │
    ▼              ▼              │
  Health        Mentions         │
  Check         Check            │ parallel
    │              │              │
    ▼              ▼              │
  [Score]       [Visibility]     │
    │              │              │
    └──────────────┴──────────────┘
             │
             ▼
        Combined Output
"""

import asyncio
import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Optional, Dict, Any

from dotenv import load_dotenv

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.models import PipelineInput, PipelineOutput

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def run_health_check(url: str, timeout: float = 30.0) -> Dict[str, Any]:
    """Run health check stage.

    Args:
        url: URL to analyze
        timeout: Request timeout

    Returns:
        Health check output dict
    """
    # Import here to avoid circular imports
    sys.path.insert(0, str(Path(__file__).parent.parent / "stage health"))
    from stage_health import run_stage_health
    from health_models import HealthStageInput

    input_data = HealthStageInput(url=url, timeout=timeout)
    output = await run_stage_health(input_data)
    return output.model_dump()


async def run_mentions_check(
    company_name: str,
    industry: Optional[str] = None,
    products: Optional[list] = None,
    target_audience: Optional[str] = None,
    num_queries: int = 10
) -> Dict[str, Any]:
    """Run mentions check stage.

    Args:
        company_name: Company name to check
        industry: Optional industry
        products: Optional product list
        target_audience: Optional target audience
        num_queries: Number of queries to generate

    Returns:
        Mentions check output dict
    """
    # Import here to avoid circular imports
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


async def run_pipeline(input_data: PipelineInput) -> PipelineOutput:
    """Run full OpenAnalytics pipeline.

    Can run health check, mentions check, or both in parallel.

    Args:
        input_data: PipelineInput with URL and/or company info

    Returns:
        PipelineOutput with health and mentions results
    """
    start_time = time.time()

    logger.info("=" * 60)
    logger.info("OpenAnalytics Pipeline")
    logger.info("=" * 60)
    if input_data.url:
        logger.info(f"URL: {input_data.url}")
    if input_data.company_name:
        logger.info(f"Company: {input_data.company_name}")
    logger.info("=" * 60)

    health_result = None
    mentions_result = None
    error = None

    try:
        tasks = []

        # Create health check task if URL provided
        if input_data.run_health and input_data.url:
            logger.info("\n[Health Check] Starting...")
            tasks.append(("health", run_health_check(input_data.url)))

        # Create mentions check task if company name provided
        if input_data.run_mentions and input_data.company_name:
            logger.info("\n[Mentions Check] Starting...")
            tasks.append(("mentions", run_mentions_check(
                input_data.company_name,
                input_data.industry,
                input_data.products,
                input_data.target_audience,
                input_data.num_queries
            )))

        # Run tasks in parallel
        if tasks:
            results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)

            for i, (name, _) in enumerate(tasks):
                result = results[i]
                if isinstance(result, Exception):
                    logger.error(f"[{name}] Failed: {result}")
                    if error is None:
                        error = str(result)
                elif name == "health":
                    health_result = result
                    logger.info(f"[Health Check] Score: {result.get('score', 0)}, Grade: {result.get('grade', 'F')}")
                elif name == "mentions":
                    mentions_result = result
                    logger.info(f"[Mentions Check] Visibility: {result.get('visibility', 0):.1f}%")

    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        error = str(e)

    total_time = time.time() - start_time

    logger.info("\n" + "=" * 60)
    logger.info("Pipeline Complete")
    logger.info("=" * 60)
    logger.info(f"Duration: {total_time:.1f}s")
    logger.info("=" * 60)

    # Convert dicts back to model instances for output
    from shared.models import HealthCheckOutput, MentionsCheckOutput

    return PipelineOutput(
        health=HealthCheckOutput(**health_result) if health_result else None,
        mentions=MentionsCheckOutput(**mentions_result) if mentions_result else None,
        total_execution_time=total_time,
        error=error
    )


def main():
    """CLI entry point."""
    load_dotenv('.env.local')

    parser = argparse.ArgumentParser(
        description="OpenAnalytics - AEO Health + Visibility Pipeline"
    )
    parser.add_argument(
        "--url",
        type=str,
        help="URL to analyze for health check"
    )
    parser.add_argument(
        "--company",
        type=str,
        help="Company name for mentions check"
    )
    parser.add_argument(
        "--industry",
        type=str,
        help="Industry for mentions check"
    )
    parser.add_argument(
        "--products",
        type=str,
        nargs="+",
        help="Products for mentions check"
    )
    parser.add_argument(
        "--target-audience",
        type=str,
        help="Target audience for mentions check"
    )
    parser.add_argument(
        "--num-queries",
        type=int,
        default=10,
        help="Number of queries for mentions check (default: 10)"
    )
    parser.add_argument(
        "--health-only",
        action="store_true",
        help="Run only health check"
    )
    parser.add_argument(
        "--mentions-only",
        action="store_true",
        help="Run only mentions check"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        help="Output JSON file path"
    )

    args = parser.parse_args()

    if not args.url and not args.company:
        parser.print_help()
        sys.exit(1)

    # Build pipeline input
    input_data = PipelineInput(
        url=args.url,
        company_name=args.company,
        industry=args.industry,
        products=args.products,
        target_audience=args.target_audience,
        run_health=not args.mentions_only and bool(args.url),
        run_mentions=not args.health_only and bool(args.company),
        num_queries=args.num_queries
    )

    # Run pipeline
    result = asyncio.run(run_pipeline(input_data))

    # Output
    output_dict = result.model_dump()

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(output_dict, f, indent=2)
        logger.info(f"\nOutput saved to: {output_path}")
    else:
        # Print summary
        print("\n" + json.dumps({
            "health_score": output_dict.get("health", {}).get("score") if output_dict.get("health") else None,
            "health_grade": output_dict.get("health", {}).get("grade") if output_dict.get("health") else None,
            "mentions_visibility": output_dict.get("mentions", {}).get("visibility") if output_dict.get("mentions") else None,
            "mentions_count": output_dict.get("mentions", {}).get("mentions") if output_dict.get("mentions") else None,
            "total_time": output_dict.get("total_execution_time"),
        }, indent=2))


if __name__ == "__main__":
    main()
