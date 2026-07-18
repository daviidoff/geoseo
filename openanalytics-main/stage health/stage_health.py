"""
Stage Health - Main orchestrator for AEO health checks.

Runs 29 checks across 4 categories and returns tiered scoring.
"""

import time
import logging
import sys
from pathlib import Path
from typing import Dict, Any

from bs4 import BeautifulSoup

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.fetcher import fetch_website
from shared.scoring import calculate_tiered_score, calculate_grade, calculate_visibility_band
from .health_models import HealthStageInput, HealthStageOutput

# Import check modules from checks directory
from checks.technical import run_technical_checks
from checks.structured_data import run_structured_data_checks
from checks.aeo_crawler import run_aeo_crawler_checks
from checks.authority import run_authority_checks

logger = logging.getLogger(__name__)


async def run_stage_health(input_data: HealthStageInput) -> HealthStageOutput:
    """Run comprehensive AEO health check.

    29 checks across 4 categories:
    - Technical SEO (16 checks)
    - Structured Data (6 checks)
    - AI Crawler Access (4 checks)
    - Authority Signals (3 checks)

    Returns tiered objective scoring (0-100).

    Args:
        input_data: HealthStageInput with URL and options

    Returns:
        HealthStageOutput with score, grade, and issues
    """
    start_time = time.time()

    logger.info(f"[Stage Health] Starting health check for {input_data.url}")

    # Fetch website
    fetch_result = await fetch_website(
        url=input_data.url,
        timeout=input_data.timeout,
        enable_js_rendering=input_data.enable_js_rendering
    )

    if fetch_result.error:
        execution_time = time.time() - start_time
        return HealthStageOutput(
            url=fetch_result.final_url,
            score=0.0,
            grade='F',
            band='Critical',
            band_color='#ef4444',
            checks_passed=0,
            checks_failed=29,
            issues=[{
                'check': 'fetch',
                'category': 'critical',
                'passed': False,
                'severity': 'error',
                'message': fetch_result.error,
                'recommendation': 'Ensure the URL is accessible and not blocking requests'
            }],
            tier_details={
                'tier0': {'passed': False, 'cap': 0, 'reason': fetch_result.error},
                'tier1': {'passed': False, 'cap': 0, 'reason': 'Could not fetch'},
                'tier2': {'passed': False, 'cap': 0, 'reason': 'Could not fetch'},
                'base_score': 0,
                'limiting_tier': 'tier0',
                'limiting_reason': fetch_result.error
            },
            execution_time=execution_time,
            fetch_time_ms=fetch_result.total_fetch_time_ms,
            js_rendered=fetch_result.js_rendered
        )

    # Parse HTML
    soup = BeautifulSoup(fetch_result.html, 'html.parser')

    # Run all checks
    logger.info(f"[Stage Health] Running technical checks...")
    technical_results = run_technical_checks(
        soup, fetch_result.final_url, fetch_result.sitemap_found, fetch_result.html_response_time_ms
    )

    logger.info(f"[Stage Health] Running structured data checks...")
    structured_results = run_structured_data_checks(soup)

    logger.info(f"[Stage Health] Running AI crawler checks...")
    crawler_results = run_aeo_crawler_checks(fetch_result.robots_txt or "")

    logger.info(f"[Stage Health] Running authority checks...")
    authority_results = run_authority_checks(soup)

    # Combine all results
    all_results = technical_results + structured_results + crawler_results + authority_results

    # Calculate score
    final_score, tier_details = calculate_tiered_score(all_results)
    grade = calculate_grade(final_score)
    band, band_color = calculate_visibility_band(final_score)

    # Count pass/fail
    passed = sum(1 for r in all_results if r.get("passed") == True)
    failed = len(all_results) - passed

    execution_time = time.time() - start_time

    logger.info(f"[Stage Health] Completed: Score {final_score}, Grade {grade}, {passed}/{len(all_results)} checks passed")

    return HealthStageOutput(
        url=fetch_result.final_url,
        score=final_score,
        grade=grade,
        band=band,
        band_color=band_color,
        checks_passed=passed,
        checks_failed=failed,
        issues=[r for r in all_results if r.get("passed") != True],
        tier_details=tier_details,
        execution_time=execution_time,
        fetch_time_ms=fetch_result.html_response_time_ms,
        js_rendered=fetch_result.js_rendered
    )


async def run_stage_health_dict(input_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Run health check from dict input, return dict output.

    Convenience wrapper for API endpoints.
    """
    input_data = HealthStageInput(**input_dict)
    output = await run_stage_health(input_data)
    return output.model_dump()
