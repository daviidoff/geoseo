"""
AEO Health Check Service

Analyzes websites for AEO (AI Engine Optimization) readiness.
Performs checks across 4 categories:
- Technical SEO
- Structured Data
- AI Crawler Access
- Authority Signals
"""

import asyncio
import json
import logging
import re
import time
from typing import List, Dict, Any, Tuple, Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from .models import (
    HealthCheckRequest,
    HealthCheckResponse,
    Issue,
    TierInfo,
    TierDetail,
    TierDetails,
    Summary,
)

logger = logging.getLogger(__name__)

# AI Crawlers to check
AI_CRAWLERS = {
    "GPTBot": "gptbot",
    "Claude-Web": "claude-web",
    "PerplexityBot": "perplexitybot",
    "CCBot": "ccbot",
}


async def fetch_url(url: str, timeout: int = 30, max_retries: int = 3) -> Tuple[Optional[str], Optional[str], int]:
    """Fetch URL and return (html, robots_txt, response_time_ms). Includes retry logic."""
    start = time.time()
    html = None
    robots_txt = None
    last_error = None

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
                # Fetch main page
                response = await client.get(url)
                html = response.text
                response_time_ms = int((time.time() - start) * 1000)

                # Fetch robots.txt
                parsed = urlparse(url)
                robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
                try:
                    robots_response = await client.get(robots_url)
                    if robots_response.status_code == 200:
                        robots_txt = robots_response.text
                except Exception:
                    pass

                return html, robots_txt, response_time_ms

        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                delay = (2 ** attempt) + (time.time() % 1)  # Exponential backoff with jitter
                logger.warning(f"Fetch attempt {attempt + 1} failed for {url}: {e}. Retrying in {delay:.1f}s...")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Failed to fetch {url} after {max_retries} attempts: {e}")

    return None, None, int((time.time() - start) * 1000)


def run_technical_checks(soup: BeautifulSoup, url: str, response_time_ms: int) -> List[Issue]:
    """Run technical SEO checks."""
    issues = []

    # Title tag
    title = soup.find("title")
    title_text = title.get_text().strip() if title else ""
    title_len = len(title_text)

    if not title_text:
        issues.append(Issue(
            check="title_tag",
            category="technical",
            passed=False,
            severity="error",
            message="Missing title tag",
            recommendation="Add a descriptive title tag (50-60 characters)",
            score_impact=-10,
        ))
    elif title_len < 30:
        issues.append(Issue(
            check="title_tag",
            category="technical",
            passed=False,
            severity="warning",
            message=f"Title too short ({title_len} chars)",
            recommendation="Expand title to 50-60 characters",
            score_impact=-5,
        ))
    elif title_len > 70:
        issues.append(Issue(
            check="title_tag",
            category="technical",
            passed=False,
            severity="warning",
            message=f"Title too long ({title_len} chars)",
            recommendation="Shorten title to under 60 characters",
            score_impact=-3,
        ))
    else:
        issues.append(Issue(
            check="title_tag",
            category="technical",
            passed=True,
            severity="notice",
            message=f"Title tag present ({title_len} chars)",
            recommendation="",
            score_impact=0,
        ))

    # Meta description
    meta_desc = soup.find("meta", attrs={"name": "description"})
    meta_text = meta_desc.get("content", "").strip() if meta_desc else ""
    meta_len = len(meta_text)

    if not meta_text:
        issues.append(Issue(
            check="meta_description",
            category="technical",
            passed=False,
            severity="error",
            message="Missing meta description",
            recommendation="Add a meta description (150-160 characters)",
            score_impact=-8,
        ))
    elif meta_len < 100:
        issues.append(Issue(
            check="meta_description",
            category="technical",
            passed=False,
            severity="warning",
            message=f"Meta description too short ({meta_len} chars)",
            recommendation="Expand to 150-160 characters",
            score_impact=-3,
        ))
    else:
        issues.append(Issue(
            check="meta_description",
            category="technical",
            passed=True,
            severity="notice",
            message=f"Meta description present ({meta_len} chars)",
            recommendation="",
            score_impact=0,
        ))

    # H1 tag
    h1_tags = soup.find_all("h1")
    if not h1_tags:
        issues.append(Issue(
            check="h1_tag",
            category="technical",
            passed=False,
            severity="warning",
            message="No H1 tag found",
            recommendation="Add a single H1 tag with main topic",
            score_impact=-5,
        ))
    elif len(h1_tags) > 1:
        issues.append(Issue(
            check="h1_tag",
            category="technical",
            passed=False,
            severity="warning",
            message=f"Multiple H1 tags ({len(h1_tags)})",
            recommendation="Use only one H1 tag per page",
            score_impact=-2,
        ))
    else:
        issues.append(Issue(
            check="h1_tag",
            category="technical",
            passed=True,
            severity="notice",
            message="Single H1 tag present",
            recommendation="",
            score_impact=0,
        ))

    # HTTPS
    is_https = url.startswith("https://")
    issues.append(Issue(
        check="https",
        category="technical",
        passed=is_https,
        severity="error" if not is_https else "notice",
        message="HTTPS enabled" if is_https else "Not using HTTPS",
        recommendation="" if is_https else "Enable HTTPS for security and SEO",
        score_impact=0 if is_https else -15,
    ))

    # Canonical
    canonical = soup.find("link", rel="canonical")
    issues.append(Issue(
        check="canonical",
        category="technical",
        passed=bool(canonical),
        severity="warning" if not canonical else "notice",
        message="Canonical tag present" if canonical else "No canonical tag",
        recommendation="" if canonical else "Add canonical tag to prevent duplicate content",
        score_impact=0 if canonical else -3,
    ))

    # Response time
    if response_time_ms > 3000:
        issues.append(Issue(
            check="response_time",
            category="technical",
            passed=False,
            severity="warning",
            message=f"Slow response time ({response_time_ms}ms)",
            recommendation="Optimize server response time to under 3 seconds",
            score_impact=-5,
        ))
    else:
        issues.append(Issue(
            check="response_time",
            category="technical",
            passed=True,
            severity="notice",
            message=f"Good response time ({response_time_ms}ms)",
            recommendation="",
            score_impact=0,
        ))

    # Image alt tags
    images = soup.find_all("img")
    images_with_alt = [img for img in images if img.get("alt")]
    if images and len(images_with_alt) < len(images) * 0.8:
        issues.append(Issue(
            check="image_alt",
            category="technical",
            passed=False,
            severity="warning",
            message=f"{len(images_with_alt)}/{len(images)} images have alt text",
            recommendation="Add descriptive alt text to all images",
            score_impact=-3,
        ))
    else:
        issues.append(Issue(
            check="image_alt",
            category="technical",
            passed=True,
            severity="notice",
            message=f"Images have alt text ({len(images_with_alt)}/{len(images)})",
            recommendation="",
            score_impact=0,
        ))

    return issues


def run_structured_data_checks(soup: BeautifulSoup) -> List[Issue]:
    """Run structured data checks."""
    issues = []

    # Find JSON-LD scripts
    json_ld_scripts = soup.find_all("script", type="application/ld+json")
    schema_types = []
    has_org = False
    has_faq = False

    for script in json_ld_scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, list):
                for item in data:
                    if "@type" in item:
                        schema_types.append(item["@type"])
                        if item["@type"] == "Organization":
                            has_org = True
                        if item["@type"] == "FAQPage":
                            has_faq = True
            elif isinstance(data, dict):
                if "@type" in data:
                    schema_types.append(data["@type"])
                    if data["@type"] == "Organization":
                        has_org = True
                    if data["@type"] == "FAQPage":
                        has_faq = True
                # Check @graph
                if "@graph" in data:
                    for item in data["@graph"]:
                        if "@type" in item:
                            schema_types.append(item["@type"])
                            if item["@type"] == "Organization":
                                has_org = True
                            if item["@type"] == "FAQPage":
                                has_faq = True
        except Exception:
            pass

    # Schema presence
    if not schema_types:
        issues.append(Issue(
            check="schema_presence",
            category="structured_data",
            passed=False,
            severity="error",
            message="No structured data (JSON-LD) found",
            recommendation="Add JSON-LD structured data for better AI understanding",
            score_impact=-15,
        ))
    else:
        issues.append(Issue(
            check="schema_presence",
            category="structured_data",
            passed=True,
            severity="notice",
            message=f"Found {len(schema_types)} schema types: {', '.join(set(schema_types))}",
            recommendation="",
            score_impact=0,
        ))

    # Organization schema
    issues.append(Issue(
        check="org_schema",
        category="structured_data",
        passed=has_org,
        severity="error" if not has_org else "notice",
        message="Organization schema found" if has_org else "No Organization schema",
        recommendation="" if has_org else "Add Organization schema for entity recognition",
        score_impact=0 if has_org else -10,
    ))

    # FAQ schema (bonus)
    issues.append(Issue(
        check="faq_schema",
        category="structured_data",
        passed=has_faq,
        severity="notice",
        message="FAQ schema found" if has_faq else "No FAQ schema",
        recommendation="" if has_faq else "Consider adding FAQ schema for common questions",
        score_impact=0,
    ))

    return issues


def run_ai_crawler_checks(robots_txt: Optional[str]) -> List[Issue]:
    """Check AI crawler access in robots.txt."""
    issues = []

    if not robots_txt:
        # No robots.txt = all allowed
        for name, bot in AI_CRAWLERS.items():
            issues.append(Issue(
                check=f"{bot}_access",
                category="ai_crawler",
                passed=True,
                severity="notice",
                message=f"{name} allowed (no robots.txt)",
                recommendation="",
                score_impact=0,
            ))
        return issues

    robots_lower = robots_txt.lower()

    for name, bot in AI_CRAWLERS.items():
        # Check for User-agent blocks
        bot_pattern = rf"user-agent:\s*{bot}"
        disallow_all = rf"user-agent:\s*{bot}[^\n]*\n\s*disallow:\s*/\s*$"

        # Also check for * disallow
        general_disallow = r"user-agent:\s*\*[^\n]*\n\s*disallow:\s*/\s*$"

        is_blocked = bool(re.search(disallow_all, robots_lower, re.MULTILINE | re.IGNORECASE))

        # Check if specifically mentioned and blocked
        if re.search(bot_pattern, robots_lower, re.IGNORECASE):
            # Bot is specifically mentioned
            if re.search(rf"user-agent:\s*{bot}[^\n]*\n[^u]*disallow:\s*/", robots_lower, re.IGNORECASE):
                is_blocked = True

        issues.append(Issue(
            check=f"{bot}_access",
            category="ai_crawler",
            passed=not is_blocked,
            severity="error" if is_blocked else "notice",
            message=f"{name} {'blocked' if is_blocked else 'allowed'}",
            recommendation="" if not is_blocked else f"Allow {name} in robots.txt for AI visibility",
            score_impact=-10 if is_blocked else 0,
        ))

    return issues


def run_authority_checks(soup: BeautifulSoup) -> List[Issue]:
    """Run authority/E-E-A-T checks."""
    issues = []

    # About page link
    about_links = soup.find_all("a", href=re.compile(r"/about|/company|/team", re.I))
    issues.append(Issue(
        check="about_page",
        category="authority",
        passed=bool(about_links),
        severity="warning" if not about_links else "notice",
        message="About page link found" if about_links else "No about/company page link",
        recommendation="" if about_links else "Add link to about page for trust signals",
        score_impact=0 if about_links else -3,
    ))

    # Contact info
    contact_patterns = [
        r"contact@|info@|support@",
        r"\+\d{1,3}[\s.-]?\d",
        r"/contact",
    ]
    has_contact = any(
        re.search(p, soup.get_text(), re.I) or
        soup.find("a", href=re.compile(p, re.I))
        for p in contact_patterns
    )
    issues.append(Issue(
        check="contact_info",
        category="authority",
        passed=has_contact,
        severity="warning" if not has_contact else "notice",
        message="Contact information found" if has_contact else "No contact information",
        recommendation="" if has_contact else "Add contact email or phone for trust",
        score_impact=0 if has_contact else -3,
    ))

    # Social links
    social_patterns = ["linkedin.com", "twitter.com", "facebook.com", "github.com"]
    social_links = []
    for pattern in social_patterns:
        links = soup.find_all("a", href=re.compile(pattern, re.I))
        social_links.extend([link.get("href") for link in links])

    issues.append(Issue(
        check="social_links",
        category="authority",
        passed=len(social_links) > 0,
        severity="notice",
        message=f"Found {len(social_links)} social links" if social_links else "No social links",
        recommendation="" if social_links else "Add links to social profiles",
        score_impact=0,
    ))

    return issues


def calculate_score(issues: List[Issue]) -> Tuple[float, TierInfo]:
    """Calculate overall score using tiered system."""
    # Count blocked AI crawlers
    blocked_crawlers = sum(
        1 for i in issues
        if i.category == "ai_crawler" and not i.passed
    )

    # Tier 0: AI Access
    if blocked_crawlers >= 4:
        tier0 = TierDetail(passed=False, cap=10, reason="All AI crawlers blocked")
    elif blocked_crawlers >= 3:
        tier0 = TierDetail(passed=False, cap=25, reason=f"{blocked_crawlers}/4 AI crawlers blocked")
    else:
        tier0 = TierDetail(passed=True, cap=100, reason="AI crawlers can access")

    # Tier 1: Schema
    has_org_schema = any(
        i.check == "org_schema" and i.passed
        for i in issues
    )
    has_title = any(
        i.check == "title_tag" and i.passed
        for i in issues
    )
    has_https = any(
        i.check == "https" and i.passed
        for i in issues
    )

    if not has_org_schema:
        tier1 = TierDetail(passed=False, cap=50, reason="No Organization schema")
    elif not has_title:
        tier1 = TierDetail(passed=False, cap=50, reason="Missing title tag")
    elif not has_https:
        tier1 = TierDetail(passed=False, cap=60, reason="Not using HTTPS")
    else:
        tier1 = TierDetail(passed=True, cap=100, reason="Essential elements present")

    # Tier 2: Quality
    has_meta = any(i.check == "meta_description" and i.passed for i in issues)
    has_schema = any(i.check == "schema_presence" and i.passed for i in issues)

    if not has_meta or not has_schema:
        tier2 = TierDetail(passed=False, cap=80, reason="Incomplete optimization")
    else:
        tier2 = TierDetail(passed=True, cap=100, reason="Good quality signals")

    # Calculate base score from issues
    total_impact = sum(i.score_impact for i in issues)
    base_score = max(0, min(100, 100 + total_impact))

    # Apply tier caps
    caps = [tier0.cap, tier1.cap, tier2.cap]
    final_score = min(base_score, min(caps))

    # Determine limiting tier
    if final_score == tier0.cap and not tier0.passed:
        limiting_tier = "tier0"
        limiting_reason = tier0.reason
    elif final_score == tier1.cap and not tier1.passed:
        limiting_tier = "tier1"
        limiting_reason = tier1.reason
    elif final_score == tier2.cap and not tier2.passed:
        limiting_tier = "tier2"
        limiting_reason = tier2.reason
    else:
        limiting_tier = "none"
        limiting_reason = "No limiting tier"

    tier_info = TierInfo(
        tier0=tier0,
        tier1=tier1,
        tier2=tier2,
        base_score=base_score,
        limiting_tier=limiting_tier,
        limiting_reason=limiting_reason,
    )

    return final_score, tier_info


def get_grade(score: float) -> str:
    """Get letter grade from score."""
    if score >= 90:
        return "A+"
    elif score >= 80:
        return "A"
    elif score >= 65:
        return "B"
    elif score >= 45:
        return "C"
    elif score >= 25:
        return "D"
    else:
        return "F"


def get_visibility_band(score: float) -> Tuple[str, str]:
    """Get visibility band and color from score."""
    if score >= 80:
        return "Excellent", "#22c55e"
    elif score >= 65:
        return "Strong", "#84cc16"
    elif score >= 45:
        return "Moderate", "#eab308"
    elif score >= 25:
        return "Weak", "#f97316"
    else:
        return "Critical", "#ef4444"


async def run_health_check(request: HealthCheckRequest) -> HealthCheckResponse:
    """Run comprehensive AEO health check."""
    start_time = time.time()

    url = request.url.strip()
    if not url.startswith("http"):
        url = f"https://{url}"

    logger.info(f"[Health] Running check for: {url}")

    # Fetch website
    html, robots_txt, response_time_ms = await fetch_url(url)

    if not html:
        raise ValueError(f"Failed to fetch {url}")

    # Parse HTML
    soup = BeautifulSoup(html, "html.parser")

    # Run all checks
    all_issues = []
    all_issues.extend(run_technical_checks(soup, url, response_time_ms))
    all_issues.extend(run_structured_data_checks(soup))
    all_issues.extend(run_ai_crawler_checks(robots_txt))
    all_issues.extend(run_authority_checks(soup))

    # Calculate scores
    score, tier_info = calculate_score(all_issues)
    grade = get_grade(score)
    visibility_band, band_color = get_visibility_band(score)

    # Count issues
    passed = sum(1 for i in all_issues if i.passed)
    errors = sum(1 for i in all_issues if i.severity == "error" and not i.passed)
    warnings = sum(1 for i in all_issues if i.severity == "warning" and not i.passed)
    notices = len(all_issues) - passed - errors - warnings

    # Build summary
    title = soup.find("title")
    title_text = title.get_text().strip() if title else ""
    meta_desc = soup.find("meta", attrs={"name": "description"})
    meta_text = meta_desc.get("content", "").strip() if meta_desc else ""

    # Count words
    text = soup.get_text()
    words = len(text.split())

    # Count images
    images = soup.find_all("img")
    images_with_alt = [img for img in images if img.get("alt")]

    # Get schema info
    schema_types = []
    json_ld_scripts = soup.find_all("script", type="application/ld+json")
    has_org = False
    has_faq = False
    for script in json_ld_scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, dict) and "@type" in data:
                schema_types.append(data["@type"])
                if data["@type"] == "Organization":
                    has_org = True
                if data["@type"] == "FAQPage":
                    has_faq = True
        except Exception:
            pass

    # Get AI crawler status
    ai_allowed = []
    ai_blocked = []
    for issue in all_issues:
        if issue.category == "ai_crawler":
            name = issue.check.replace("_access", "").upper()
            if issue.passed:
                ai_allowed.append(name)
            else:
                ai_blocked.append(name)

    # Social links
    social_links = []
    for pattern in ["linkedin.com", "twitter.com", "facebook.com"]:
        for link in soup.find_all("a", href=re.compile(pattern, re.I)):
            social_links.append(link.get("href"))

    summary = Summary(
        title=title_text[:100],
        title_length=len(title_text),
        meta_description=meta_text[:200],
        meta_length=len(meta_text),
        word_count=words,
        h1_count=len(soup.find_all("h1")),
        images_total=len(images),
        images_with_alt=len(images_with_alt),
        https=url.startswith("https://"),
        schema_types=list(set(schema_types)),
        schema_count=len(json_ld_scripts),
        has_organization=has_org,
        has_faq=has_faq,
        robots_txt_found=bool(robots_txt),
        sitemap_found=False,  # Would need to check /sitemap.xml
        ai_crawlers_allowed=ai_allowed,
        ai_crawlers_blocked=ai_blocked,
        social_links=social_links[:5],
        response_time_ms=response_time_ms,
    )

    # Calculate component scores
    category_clarity = 100 if has_org else 50
    entity_strength = min(100, len(schema_types) * 20 + (30 if has_org else 0))
    authority_signal = min(100, len(social_links) * 20 + (40 if summary.h1_count > 0 else 0))

    processing_time = time.time() - start_time

    logger.info(f"[Health] Check complete: {url} - Score: {score}, Grade: {grade}")

    # Calculate tier details for frontend
    technical_issues = [i for i in all_issues if i.category == "technical"]
    structured_data_issues = [i for i in all_issues if i.category == "structured_data"]
    crawler_issues = [i for i in all_issues if i.category == "ai_crawler"]
    authority_issues = [i for i in all_issues if i.category == "authority"]

    tier_details = TierDetails(
        technical={"score": sum(1 for i in technical_issues if i.passed), "total": len(technical_issues)},
        structured_data={"score": sum(1 for i in structured_data_issues if i.passed), "total": len(structured_data_issues)},
        crawler={"score": sum(1 for i in crawler_issues if i.passed), "total": len(crawler_issues)},
        authority={"score": sum(1 for i in authority_issues if i.passed), "total": len(authority_issues)},
    )

    # Generate summaries for each category
    technical_passed = sum(1 for i in technical_issues if i.passed)
    technical_summary = f"{technical_passed}/{len(technical_issues)} technical checks passed"
    
    structured_passed = sum(1 for i in structured_data_issues if i.passed)
    structured_data_summary = f"{structured_passed}/{len(structured_data_issues)} structured data checks passed"
    
    crawler_passed = sum(1 for i in crawler_issues if i.passed)
    crawler_summary = f"{crawler_passed}/{len(crawler_issues)} AI crawler checks passed"
    
    authority_passed = sum(1 for i in authority_issues if i.passed)
    authority_summary = f"{authority_passed}/{len(authority_issues)} authority checks passed"

    return HealthCheckResponse(
        success=True,
        url=url,
        final_url=url,
        score=round(score, 1),
        grade=grade,
        visibility_band=visibility_band,
        visibility_color=band_color,
        band_color=band_color,
        tier_info=tier_info,
        tier_details=tier_details,
        category_clarity_score=category_clarity,
        entity_strength_score=entity_strength,
        authority_signal_score=authority_signal,
        total_checks=len(all_issues),
        passed=passed,
        errors=errors,
        warnings=warnings,
        notices=notices,
        issues=all_issues,
        summary=summary,
        technical_summary=technical_summary,
        structured_data_summary=structured_data_summary,
        crawler_summary=crawler_summary,
        authority_summary=authority_summary,
        metadata={
            "response_time_ms": response_time_ms,
            "word_count": words,
        },
        processing_time_seconds=round(processing_time, 2),
    )
