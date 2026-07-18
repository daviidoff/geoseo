"""
Tiered Objective AEO Scoring System.

The AEO funnel:
1. CAN AI ACCESS? -> If blocked, nothing else matters
2. CAN AI UNDERSTAND? -> Schema.org is essential for entity recognition
3. IS CONTENT STRUCTURED? -> Technical SEO for content extraction
4. IS IT TRUSTWORTHY? -> Authority signals for citation confidence

Tier 0: CRITICAL (Gate)
- Blocks ALL AI crawlers -> Max score = 10
- Has noindex directive -> Max score = 5

Tier 1: ESSENTIAL (Floor)
- No Organization schema -> Max score = 50
- Missing title OR meta -> Max score = 50

Tier 2: IMPORTANT (Ceiling)
- Incomplete schema -> Max score = 80
- Poor content quality -> Max score = 80

Tier 3: EXCELLENCE
- Full optimization -> Score up to 100
"""

import re
from typing import List, Dict, Any, Tuple


def evaluate_tier0_critical(issues: List[Dict[str, Any]]) -> Tuple[bool, int, str]:
    """Evaluate Tier 0: Critical gates.

    Deal-breakers that cap your maximum score:
    - Blocking ALL AI crawlers = invisible to AI
    - noindex directive = won't be indexed

    Returns:
        Tuple of (passed, max_score_cap, reason)
    """
    ai_crawler_checks = ['gptbot_access', 'claude_access', 'perplexitybot_access', 'ccbot_access']
    blocked_crawlers = []

    for issue in issues:
        if issue.get('check') in ai_crawler_checks and not issue.get('passed', False):
            blocked_crawlers.append(issue.get('check'))

    if len(blocked_crawlers) >= 4:
        return (False, 10, "Blocks all AI crawlers - invisible to AI")

    if len(blocked_crawlers) >= 3:
        return (False, 25, f"Blocks most AI crawlers ({len(blocked_crawlers)}/4)")

    for issue in issues:
        if issue.get('check') == 'robots_meta':
            message = issue.get('message', '').lower()
            if 'noindex' in message and not issue.get('passed', False):
                return (False, 5, "Has noindex - won't be indexed by AI")

    return (True, 100, "AI can access site")


def evaluate_tier1_essential(issues: List[Dict[str, Any]]) -> Tuple[bool, int, str]:
    """Evaluate Tier 1: Essential requirements.

    Minimum requirements for AI to understand your site:
    - Organization schema EXISTS
    - Title tag EXISTS
    - HTTPS

    Returns:
        Tuple of (passed, max_score_cap, reason)
    """
    has_org_schema = False
    has_title = False
    has_https = False

    for issue in issues:
        check = issue.get('check', '')
        passed = issue.get('passed', False)
        message = issue.get('message', '').lower()

        if check == 'org_schema_completeness':
            if 'no organization schema' not in message:
                has_org_schema = True
        elif check == 'title_tag':
            if 'missing title' not in message:
                has_title = True
        elif check == 'https' and passed:
            has_https = True

    missing = []
    if not has_org_schema:
        missing.append("Organization schema")
    if not has_title:
        missing.append("title tag")
    if not has_https:
        missing.append("HTTPS")

    if not has_org_schema:
        return (False, 45, "Missing Organization schema - AI can't identify entity")

    if missing:
        return (False, 55, f"Missing essentials: {', '.join(missing)}")

    return (True, 100, "Has essential elements")


def evaluate_tier2_important(issues: List[Dict[str, Any]]) -> Tuple[bool, int, str]:
    """Evaluate Tier 2: Important optimizations.

    Important for good AI visibility:
    - Complete Organization schema (logo, description)
    - sameAs links for knowledge graph
    - Meta description
    - Good content length

    Returns:
        Tuple of (passed, max_score_cap, reason)
    """
    org_complete = False
    org_partial = False
    has_meta_desc = False
    good_content = False
    has_sameas = False

    for issue in issues:
        check = issue.get('check', '')
        passed = issue.get('passed', False)
        message = issue.get('message', '')

        if check == 'org_schema_completeness':
            if 'no organization schema' not in message.lower():
                org_partial = True
                match = re.search(r'(\d+)%', message or '0%')
                if match:
                    completeness = int(match.group(1))
                    if completeness >= 70:
                        org_complete = True
        elif check == 'meta_description':
            if 'missing' not in message.lower():
                has_meta_desc = True
        elif check == 'content_word_count' and passed:
            good_content = True
        elif check == 'sameas_links' and passed:
            has_sameas = True

    critical_issues = []
    important_issues = []
    minor_issues = []

    if org_partial and not org_complete:
        important_issues.append("incomplete Organization schema")

    if not has_sameas:
        important_issues.append("no sameAs links")

    if not has_meta_desc:
        minor_issues.append("no meta description")

    if not good_content:
        minor_issues.append("thin content")

    if len(critical_issues) > 0:
        return (False, 70, f"Critical: {', '.join(critical_issues)}")
    elif len(important_issues) >= 2:
        return (False, 75, f"Issues: {', '.join(important_issues)}")
    elif len(important_issues) == 1:
        return (False, 85, f"Issue: {important_issues[0]}")
    elif len(minor_issues) >= 2:
        return (False, 90, f"Minor issues: {', '.join(minor_issues)}")
    elif len(minor_issues) == 1:
        return (False, 95, f"Minor: {minor_issues[0]}")

    return (True, 100, "Excellent AEO optimization")


def calculate_base_score(issues: List[Dict[str, Any]]) -> float:
    """Calculate base score from all checks (0-100).

    Simple calculation: passed checks / total checks, weighted by impact.
    """
    total_impact = 0
    earned_impact = 0

    for issue in issues:
        impact = issue.get('score_impact', 5)
        total_impact += impact

        if issue.get('passed', False):
            earned_impact += impact
        elif issue.get('severity') == 'notice':
            earned_impact += impact * 0.7
        elif issue.get('severity') == 'warning':
            earned_impact += impact * 0.3

    if total_impact > 0:
        return (earned_impact / total_impact) * 100
    return 0.0


def calculate_tiered_score(issues: List[Dict[str, Any]]) -> Tuple[float, Dict[str, Any]]:
    """Calculate final score using tiered gating system.

    The score is the MINIMUM of:
    - Tier 0 cap (critical gates)
    - Tier 1 cap (essential requirements)
    - Tier 2 cap (important optimizations)
    - Base score (actual check performance)

    Returns:
        Tuple of (final_score, tier_details)
    """
    tier0_passed, tier0_cap, tier0_reason = evaluate_tier0_critical(issues)
    tier1_passed, tier1_cap, tier1_reason = evaluate_tier1_essential(issues)
    tier2_passed, tier2_cap, tier2_reason = evaluate_tier2_important(issues)

    base_score = calculate_base_score(issues)

    final_score = min(tier0_cap, tier1_cap, tier2_cap, base_score)

    limiting_tier = "base"
    limiting_reason = "Check performance"

    if tier0_cap <= final_score + 1:
        limiting_tier = "tier0"
        limiting_reason = tier0_reason
    elif tier1_cap <= final_score + 1:
        limiting_tier = "tier1"
        limiting_reason = tier1_reason
    elif tier2_cap <= final_score + 1:
        limiting_tier = "tier2"
        limiting_reason = tier2_reason

    tier_details = {
        'tier0': {'passed': tier0_passed, 'cap': tier0_cap, 'reason': tier0_reason},
        'tier1': {'passed': tier1_passed, 'cap': tier1_cap, 'reason': tier1_reason},
        'tier2': {'passed': tier2_passed, 'cap': tier2_cap, 'reason': tier2_reason},
        'base_score': round(base_score, 1),
        'limiting_tier': limiting_tier,
        'limiting_reason': limiting_reason,
    }

    return (round(final_score, 1), tier_details)


def calculate_grade(score: float) -> str:
    """Convert score to letter grade.

    - A+ (90+): Exceptional - passes all tiers with excellence
    - A (80-89): Excellent - full schema, good optimization
    - B (65-79): Good - has schema, some gaps
    - C (45-64): Fair - missing schema or has issues
    - D (25-44): Poor - major gaps, partial AI access
    - F (<25): Critical - blocks AI or fundamental issues
    """
    if score >= 90:
        return 'A+'
    elif score >= 80:
        return 'A'
    elif score >= 65:
        return 'B'
    elif score >= 45:
        return 'C'
    elif score >= 25:
        return 'D'
    else:
        return 'F'


def calculate_visibility_band(score: float) -> tuple:
    """Convert score to visibility band and color.

    Returns:
        Tuple of (band_name, hex_color)
    """
    if score >= 80:
        return ('Excellent', '#22c55e')
    elif score >= 65:
        return ('Strong', '#84cc16')
    elif score >= 45:
        return ('Moderate', '#eab308')
    elif score >= 25:
        return ('Weak', '#f97316')
    else:
        return ('Critical', '#ef4444')
