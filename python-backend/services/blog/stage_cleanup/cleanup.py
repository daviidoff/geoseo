"""
HTML Cleanup Stage - Clean and validate article content.

Matches TypeScript stage-08-cleanup.ts functionality:
- Remove empty HTML tags (paragraphs, divs, spans, headings, lists)
- Fix unclosed tags
- Normalize quotes and whitespace
- Remove control characters
- Validate article structure
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class ValidationStats:
    """Article validation statistics."""
    total_sections: int = 0
    total_faqs: int = 0
    total_paas: int = 0
    has_intro: bool = False
    has_direct_answer: bool = False


@dataclass
class CleanupResult:
    """Result of cleanup operation."""
    valid: bool = True
    warnings: List[str] = field(default_factory=list)
    stats: ValidationStats = field(default_factory=ValidationStats)
    fields_cleaned: int = 0


def run_cleanup(article: Dict[str, Any]) -> CleanupResult:
    """
    Clean HTML content and validate article structure.

    Args:
        article: Article dictionary to clean (modified in place)

    Returns:
        CleanupResult with validation info and stats
    """
    logger.info("[Cleanup] Starting HTML cleanup stage...")

    result = CleanupResult()

    # Fields to clean
    fields_to_clean = [
        "Intro",
        "Direct_Answer",
    ]

    # Add section content fields
    for i in range(1, 10):
        fields_to_clean.append(f"section_{i:02d}_content")

    # Add FAQ answer fields
    for i in range(1, 7):
        fields_to_clean.append(f"faq_{i:02d}_answer")

    # Add PAA answer fields
    for i in range(1, 5):
        fields_to_clean.append(f"paa_{i:02d}_answer")

    # Clean each field
    for field_name in fields_to_clean:
        original = article.get(field_name, "")
        if isinstance(original, str) and original:
            cleaned = _clean_html(original)
            if cleaned != original:
                article[field_name] = cleaned
                result.fields_cleaned += 1

    logger.info(f"[Cleanup] Cleaned {result.fields_cleaned} fields")

    # Validate article structure
    validation = _validate_article_structure(article)
    result.valid = len(validation["warnings"]) == 0
    result.warnings = validation["warnings"]
    result.stats = validation["stats"]

    if result.warnings:
        logger.warning(f"[Cleanup] Validation warnings: {result.warnings}")

    logger.info("[Cleanup] Cleanup stage completed")
    return result


def _clean_html(html: str) -> str:
    """
    Clean HTML content.

    Removes:
    - Empty paragraphs, divs, spans, headings, list items, lists
    - Multiple consecutive spaces/line breaks
    - Leading/trailing whitespace in tags
    - Control characters

    Fixes:
    - Unclosed tags (basic fix)
    - Quote normalization
    """
    if not html:
        return ""

    cleaned = html

    # 1. Remove empty paragraphs
    cleaned = re.sub(r'<p>\s*</p>', '', cleaned, flags=re.IGNORECASE)

    # 2. Remove empty divs
    cleaned = re.sub(r'<div>\s*</div>', '', cleaned, flags=re.IGNORECASE)

    # 3. Remove empty spans
    cleaned = re.sub(r'<span>\s*</span>', '', cleaned, flags=re.IGNORECASE)

    # 4. Remove empty headings
    cleaned = re.sub(r'<h[1-6]>\s*</h[1-6]>', '', cleaned, flags=re.IGNORECASE)

    # 5. Remove empty list items
    cleaned = re.sub(r'<li>\s*</li>', '', cleaned, flags=re.IGNORECASE)

    # 6. Remove empty lists
    cleaned = re.sub(r'<ul>\s*</ul>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<ol>\s*</ol>', '', cleaned, flags=re.IGNORECASE)

    # 7. Fix multiple consecutive spaces
    cleaned = re.sub(r' {2,}', ' ', cleaned)

    # 8. Fix multiple consecutive line breaks
    cleaned = re.sub(r'(\n\s*){3,}', '\n\n', cleaned)

    # 9. Remove leading/trailing whitespace in tags
    cleaned = re.sub(r'>\s+', '>', cleaned)
    cleaned = re.sub(r'\s+<', '<', cleaned)

    # 10. Fix unclosed tags (basic)
    cleaned = _fix_unclosed_tags(cleaned)

    # 11. Normalize quotes
    cleaned = cleaned.replace('"', '"').replace('"', '"')
    cleaned = cleaned.replace(''', "'").replace(''', "'")

    # 12. Remove control characters
    cleaned = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]', '', cleaned)

    return cleaned.strip()


def _fix_unclosed_tags(html: str) -> str:
    """
    Fix basic unclosed tag issues.

    Counts opening and closing tags for common elements
    and adds missing closing tags at the end.
    """
    tags = ['p', 'div', 'span', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4']

    for tag in tags:
        # Count opening tags (with or without attributes)
        open_pattern = rf'<{tag}(?:\s[^>]*)?>'.lower()
        open_count = len(re.findall(open_pattern, html.lower()))

        # Count closing tags
        close_pattern = rf'</{tag}>'.lower()
        close_count = len(re.findall(close_pattern, html.lower()))

        # If more opens than closes, add closing tags at the end
        if open_count > close_count:
            diff = open_count - close_count
            html += f'</{tag}>' * diff

    return html


def _validate_article_structure(article: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate article structure.

    Checks:
    - Required fields (meta_title, Intro, Direct_Answer)
    - Meta title length (max 55 chars)
    - Section count
    - FAQ/PAA count
    """
    warnings = []
    stats = ValidationStats()

    # Check meta_title
    meta_title = article.get("Meta_Title", "")
    if not meta_title:
        warnings.append("Missing Meta_Title")
    elif len(meta_title) > 55:
        warnings.append(f"Meta_Title too long: {len(meta_title)} chars (max 55)")

    # Check Intro
    intro = article.get("Intro", "")
    stats.has_intro = bool(intro and intro.strip())
    if not stats.has_intro:
        warnings.append("Missing or empty Intro")

    # Check Direct_Answer
    direct_answer = article.get("Direct_Answer", "")
    stats.has_direct_answer = bool(direct_answer and direct_answer.strip())
    if not stats.has_direct_answer:
        warnings.append("Missing or empty Direct_Answer")

    # Count sections
    for i in range(1, 10):
        title = article.get(f"section_{i:02d}_title", "")
        content = article.get(f"section_{i:02d}_content", "")
        if title and content and content.strip():
            stats.total_sections += 1

    if stats.total_sections == 0:
        warnings.append("No sections with content found")

    # Count FAQs
    for i in range(1, 7):
        question = article.get(f"faq_{i:02d}_question", "")
        answer = article.get(f"faq_{i:02d}_answer", "")
        if question and answer and answer.strip():
            stats.total_faqs += 1

    # Count PAAs
    for i in range(1, 5):
        question = article.get(f"paa_{i:02d}_question", "")
        answer = article.get(f"paa_{i:02d}_answer", "")
        if question and answer and answer.strip():
            stats.total_paas += 1

    return {
        "valid": len(warnings) == 0,
        "warnings": warnings,
        "stats": stats,
    }
