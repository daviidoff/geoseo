#!/usr/bin/env python3
"""
OpenAnalytics - Clean Production API

Two services:
1. Health Check - 29 AEO checks, tiered scoring
2. Mentions Check - AI hyperniche query generation + visibility analysis

Environment Variables Required:
- GEMINI_API_KEY: Your Gemini API key
"""
import os
import sys
import time
import json
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import our minimal dependencies
from fetcher import fetch_website
from gemini_client import get_gemini_client
from scoring import (
    calculate_tiered_score,
    calculate_grade,
    calculate_visibility_band,
)
from checks.technical import run_technical_checks
from checks.structured_data import run_structured_data_checks
from checks.aeo_crawler import run_aeo_crawler_checks
from checks.authority import run_authority_checks

# Initialize FastAPI
app = FastAPI(
    title="OpenAnalytics",
    description="Health Check + Mentions Check with AI Hyperniche Queries",
    version="2.0.0",
)

@app.on_event("startup")
async def validate_environment():
    """Validate required environment variables on startup."""
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        print("ERROR: GEMINI_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Models ====================

class HealthCheckRequest(BaseModel):
    url: str

class HealthCheckResponse(BaseModel):
    url: str
    score: float
    max_score: float
    grade: str
    band: str
    checks_passed: int
    checks_failed: int
    issues: List[Dict[str, Any]]
    execution_time: float

class MentionsCheckRequest(BaseModel):
    company_name: str
    industry: Optional[str] = None
    products: Optional[List[str]] = None
    target_audience: Optional[str] = None
    num_queries: int = 10

class MentionsCheckResponse(BaseModel):
    company_name: str
    queries_generated: List[Dict[str, str]]
    visibility: float
    mentions: int
    presence_rate: float
    quality_score: float
    execution_time: float

# ==================== Health Check ====================

@app.post("/health", response_model=HealthCheckResponse)
async def health_check(request: HealthCheckRequest):
    """
    Run comprehensive AEO health check.

    29 checks across 4 categories:
    - Technical SEO (16 checks)
    - Structured Data (6 checks)
    - AI Crawler Access (4 checks)
    - Authority Signals (3 checks)

    Returns tiered objective scoring (0-100).
    """
    start_time = time.time()

    try:
        # Fetch website
        fetch_result = await fetch_website(request.url)

        if fetch_result.error:
            raise HTTPException(status_code=400, detail=f"Failed to fetch: {fetch_result.error}")

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(fetch_result.html, 'html.parser')

        # Run all checks
        technical_results = run_technical_checks(
            soup, fetch_result.final_url, fetch_result.sitemap_found, fetch_result.html_response_time_ms
        )
        structured_results = run_structured_data_checks(soup)
        crawler_results = run_aeo_crawler_checks(fetch_result.robots_txt or "")
        authority_results = run_authority_checks(soup)

        # Combine all results
        all_results = technical_results + structured_results + crawler_results + authority_results

        # Calculate score
        final_score, tier_details = calculate_tiered_score(all_results)
        grade = calculate_grade(final_score)
        band, _ = calculate_visibility_band(final_score)  # Returns (band_name, color)

        # Count pass/fail
        passed = sum(1 for r in all_results if r.get("passed") == True)
        failed = len(all_results) - passed

        execution_time = time.time() - start_time

        return HealthCheckResponse(
            url=fetch_result.final_url,
            score=final_score,
            max_score=100.0,
            grade=grade,
            band=band,
            checks_passed=passed,
            checks_failed=failed,
            issues=[r for r in all_results if r.get("passed") != True],
            execution_time=execution_time
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

# ==================== Mentions Check ====================

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
✅ "best [product] for [target audience] United States"
✅ "enterprise [industry] [product] solutions"
✅ "[product] for [role] in [industry]"
✅ "{company_name} [product]" (only 1 branded)

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
            # Strip markdown code blocks
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
        # Fallback to simple rule-based
        print(f"AI generation failed: {e}, using fallback")
        return [
            {"query": f"best {products[0] if products else 'solution'} for {industry or 'companies'}", "dimension": "Product-Industry"},
            {"query": f"{company_name} alternatives", "dimension": "Competitive"},
            {"query": f"{company_name}", "dimension": "Branded"}
        ][:num_queries]

async def test_query_with_gemini(query: str, company_name: str) -> Dict[str, Any]:
    """Test a single query with Gemini using real-time Google Search grounding.

    This uses live Google Search results to determine if the company
    appears in actual AI-generated responses, not just training data.
    """
    try:
        client = get_gemini_client()

        # Use search-grounded query for real-time results
        response = await client.query_with_search_grounding(query)

        if response.get("success") and response.get("response"):
            text = response["response"]
            grounding_sources = response.get("grounding_sources", [])

            # Check if company is mentioned in response text
            company_mentioned_in_text = company_name.lower() in text.lower()

            # Also check if company appears in grounding sources (URLs/titles)
            company_in_sources = False
            for source in grounding_sources:
                source_text = f"{source.get('uri', '')} {source.get('title', '')}".lower()
                if company_name.lower() in source_text:
                    company_in_sources = True
                    break

            # Company is "mentioned" if it appears in text OR in cited sources
            company_mentioned = company_mentioned_in_text or company_in_sources

            return {
                "query": query,
                "has_response": True,
                "company_mentioned": company_mentioned,
                "mentioned_in_text": company_mentioned_in_text,
                "mentioned_in_sources": company_in_sources,
                "response_length": len(text),
                "response_preview": text[:200] if text else "",
                "search_grounded": response.get("search_grounding", False),
                "source_count": response.get("source_count", 0),
                "sources": grounding_sources[:3]  # Include top 3 sources for transparency
            }
        return {
            "query": query,
            "has_response": False,
            "company_mentioned": False,
            "search_grounded": False
        }
    except Exception as e:
        return {
            "query": query,
            "has_response": False,
            "company_mentioned": False,
            "error": str(e),
            "search_grounded": False
        }

@app.post("/mentions", response_model=MentionsCheckResponse)
async def mentions_check(request: MentionsCheckRequest):
    """
    Run AI visibility check with hyperniche query generation.

    Generates sophisticated queries that test organic visibility:
    - 70% unbranded (tests real organic discovery)
    - 20% competitive (comparison queries)
    - 10% branded (brand awareness)

    Tests queries with Gemini to measure visibility.
    """
    start_time = time.time()

    try:
        # Generate queries
        queries = await generate_hyperniche_queries(
            request.company_name,
            request.industry,
            request.products,
            request.target_audience,
            request.num_queries
        )

        # Test queries in parallel for better performance
        tasks = [test_query_with_gemini(q["query"], request.company_name) for q in queries]
        results = await asyncio.gather(*tasks)

        # Calculate metrics based on actual mentions
        total_responses = sum(1 for r in results if r.get("has_response"))
        total_mentions = sum(1 for r in results if r.get("company_mentioned"))
        presence_rate = (total_responses / len(results) * 100) if results else 0
        mention_rate = (total_mentions / len(results) * 100) if results else 0

        # Calculate quality score (0-10 based on mention rate)
        visibility = mention_rate
        mentions = total_mentions
        quality_score = min(10.0, mention_rate / 10)

        execution_time = time.time() - start_time

        return MentionsCheckResponse(
            company_name=request.company_name,
            queries_generated=queries,
            visibility=visibility,
            mentions=mentions,
            presence_rate=presence_rate,
            quality_score=quality_score,
            execution_time=execution_time
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mentions check failed: {str(e)}")

# ==================== Info ====================

@app.get("/")
async def root():
    """Service info."""
    return {
        "service": "OpenAnalytics",
        "version": "2.0.0",
        "status": "ready",
        "endpoints": {
            "/health": "POST - AEO health check (29 checks)",
            "/mentions": "POST - AI visibility check (hyperniche queries)",
            "/": "GET - This info"
        },
        "requirements": {
            "GEMINI_API_KEY": "✓ Set" if os.getenv("GEMINI_API_KEY") else "✗ Missing"
        }
    }

@app.get("/status")
async def status():
    """Health status."""
    return {
        "status": "healthy",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY"))
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
