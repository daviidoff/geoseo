"""Technical SEO Checks - 16 core checks for SEO/AEO health

v3.0 Overhaul:
- Removed Open Graph tags (social sharing, not AEO-relevant)
- Removed Twitter Cards (social sharing, not AEO-relevant)
- Implementing partial credit scoring (not just pass/fail)

These are the foundational SEO hygiene checks that form the base of the health score.
Includes sitemap detection, response time scoring, meta robots indexing detection,
and hreflang tags for international SEO.
"""

import re
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
from bs4 import BeautifulSoup


def run_technical_checks(
    soup: BeautifulSoup, 
    final_url: str,
    sitemap_found: bool = False,
    response_time_ms: int = 0
) -> List[Dict[str, Any]]:
    """Run all 16 technical SEO checks.
    
    Args:
        soup: Parsed HTML content
        final_url: Final URL after redirects
        sitemap_found: Whether sitemap.xml was found
        response_time_ms: Page response time in milliseconds
        
    Returns:
        List of check results with pass/fail, severity, message, recommendation
    """
    issues = []
    
    # === 1. TITLE TAG ===
    title = soup.find('title')
    title_text = title.text.strip() if title else ""
    title_length = len(title_text)
    
    if not title_text:
        issues.append({
            'check': 'title_tag',
            'category': 'technical',
            'passed': False,
            'severity': 'error',
            'message': 'Missing title tag',
            'recommendation': 'Add a descriptive title tag (30-65 characters)',
            'score_impact': 10
        })
    elif title_length < 30:
        issues.append({
            'check': 'title_tag',
            'category': 'technical',
            'passed': False,
            'severity': 'warning',
            'message': f'Title too short ({title_length} chars)',
            'recommendation': 'Expand title to 30-65 characters for better visibility',
            'score_impact': 10
        })
    elif title_length > 65:
        issues.append({
            'check': 'title_tag',
            'category': 'technical',
            'passed': False,
            'severity': 'warning',
            'message': f'Title too long ({title_length} chars)',
            'recommendation': 'Shorten title to 30-65 characters to avoid truncation',
            'score_impact': 10
        })
    else:
        issues.append({
            'check': 'title_tag',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': f'Good title length ({title_length} chars)',
            'recommendation': '',
            'score_impact': 10
        })
    
    # === 2. META DESCRIPTION ===
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    meta_text = str(meta_desc.get('content', '')).strip() if meta_desc else ""
    meta_length = len(meta_text)
    
    if not meta_text:
        issues.append({
            'check': 'meta_description',
            'category': 'technical',
            'passed': False,
            'severity': 'error',
            'message': 'Missing meta description',
            'recommendation': 'Add a meta description (120-160 characters)',
            'score_impact': 10
        })
    elif meta_length < 120:
        issues.append({
            'check': 'meta_description',
            'category': 'technical',
            'passed': False,
            'severity': 'warning',
            'message': f'Meta description too short ({meta_length} chars)',
            'recommendation': 'Expand to 120-160 characters for better SERP display',
            'score_impact': 10
        })
    elif meta_length > 160:
        issues.append({
            'check': 'meta_description',
            'category': 'technical',
            'passed': False,
            'severity': 'warning',
            'message': f'Meta description too long ({meta_length} chars)',
            'recommendation': 'Shorten to 120-160 characters to avoid truncation',
            'score_impact': 10
        })
    else:
        issues.append({
            'check': 'meta_description',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': f'Good meta description ({meta_length} chars)',
            'recommendation': '',
            'score_impact': 10
        })
    
    # === 3. H1 TAG ===
    h1_tags = soup.find_all('h1')
    h1_count = len(h1_tags)
    
    if h1_count == 0:
        issues.append({
            'check': 'h1_tag',
            'category': 'technical',
            'passed': False,
            'severity': 'error',
            'message': 'No H1 tag found',
            'recommendation': 'Add exactly one H1 tag to clearly define page topic',
            'score_impact': 10
        })
    elif h1_count > 1:
        issues.append({
            'check': 'h1_tag',
            'category': 'technical',
            'passed': False,
            'severity': 'warning',
            'message': f'Multiple H1 tags ({h1_count})',
            'recommendation': 'Use only one H1 tag per page for clarity',
            'score_impact': 10
        })
    else:
        h1_text = h1_tags[0].get_text(strip=True)[:50]
        issues.append({
            'check': 'h1_tag',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': f'Single H1 tag: "{h1_text}..."',
            'recommendation': '',
            'score_impact': 10
        })
    
    # === 4. HEADING STRUCTURE ===
    h2_count = len(soup.find_all('h2'))
    h3_count = len(soup.find_all('h3'))
    h4_count = len(soup.find_all('h4'))
    
    if h2_count == 0:
        issues.append({
            'check': 'heading_structure',
            'category': 'technical',
            'passed': False,
            'severity': 'warning',
            'message': 'No H2 tags found',
            'recommendation': 'Add H2 tags to structure your content',
            'score_impact': 5
        })
    else:
        issues.append({
            'check': 'heading_structure',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': f'Good structure: {h1_count} H1, {h2_count} H2, {h3_count} H3, {h4_count} H4',
            'recommendation': '',
            'score_impact': 5
        })
    
    # === 5. IMAGE ALT TEXT ===
    # Distinguish between: no alt, empty alt (alt=""), and descriptive alt
    images = soup.find_all('img')
    total_images = len(images)
    images_with_alt_attr = len([img for img in images if img.get('alt') is not None])
    images_with_descriptive_alt = len([img for img in images if img.get('alt')])  # non-empty alt
    images_without_alt = total_images - images_with_alt_attr
    
    if total_images == 0:
        issues.append({
            'check': 'image_alt_text',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': 'No images on page',
            'recommendation': '',
            'score_impact': 10
        })
    elif images_without_alt > 0:
        # Some images missing alt attribute entirely
        alt_percentage = (images_with_alt_attr / total_images) * 100
        issues.append({
            'check': 'image_alt_text',
            'category': 'technical',
            'passed': False,
            'severity': 'error',
            'message': f'{images_without_alt}/{total_images} images missing alt attribute ({alt_percentage:.0f}% have alt)',
            'recommendation': f'Add alt attribute to all {images_without_alt} images',
            'score_impact': 10
        })
    elif images_with_descriptive_alt == 0:
        # All images have alt="" (empty) - likely misconfigured
        issues.append({
            'check': 'image_alt_text',
            'category': 'technical',
            'passed': False,
            'severity': 'warning',
            'message': f'All {total_images} images have empty alt="" (no descriptive text)',
            'recommendation': 'Add descriptive alt text to content images (empty alt is only valid for decorative images)',
            'score_impact': 10
        })
    elif images_with_descriptive_alt < total_images * 0.5:
        # Less than 50% have descriptive alt
        desc_percentage = (images_with_descriptive_alt / total_images) * 100
        issues.append({
            'check': 'image_alt_text',
            'category': 'technical',
            'passed': False,
            'severity': 'notice',
            'message': f'Only {images_with_descriptive_alt}/{total_images} images have descriptive alt text ({desc_percentage:.0f}%)',
            'recommendation': 'Add descriptive alt text to more images for better accessibility and SEO',
            'score_impact': 10
        })
    else:
        # Majority have descriptive alt - pass
        desc_percentage = (images_with_descriptive_alt / total_images) * 100
        issues.append({
            'check': 'image_alt_text',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': f'{images_with_descriptive_alt}/{total_images} images have descriptive alt text ({desc_percentage:.0f}%)',
            'recommendation': '',
            'score_impact': 10
        })
    
    # === 6. MOBILE VIEWPORT ===
    viewport = soup.find('meta', attrs={'name': 'viewport'})
    
    if not viewport:
        issues.append({
            'check': 'mobile_viewport',
            'category': 'technical',
            'passed': False,
            'severity': 'error',
            'message': 'No viewport meta tag',
            'recommendation': 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
            'score_impact': 10
        })
    else:
        viewport_content = viewport.get('content', '')
        if 'width=device-width' in viewport_content:
            issues.append({
                'check': 'mobile_viewport',
                'category': 'technical',
                'passed': True,
                'severity': 'pass',
                'message': 'Viewport configured correctly',
                'recommendation': '',
                'score_impact': 10
            })
        else:
            issues.append({
                'check': 'mobile_viewport',
                'category': 'technical',
                'passed': False,
                'severity': 'warning',
                'message': 'Viewport tag present but not optimal',
                'recommendation': 'Update viewport to include width=device-width',
                'score_impact': 10
            })
    
    # === 7. STRUCTURED DATA PRESENCE ===
    schema_scripts = soup.find_all('script', attrs={'type': 'application/ld+json'})
    schema_count = len(schema_scripts)
    
    if schema_count == 0:
        issues.append({
            'check': 'structured_data_presence',
            'category': 'technical',
            'passed': False,
            'severity': 'warning',
            'message': 'No structured data (schema.org) found',
            'recommendation': 'Add JSON-LD structured data to help AI understand your content',
            'score_impact': 10
        })
    else:
        issues.append({
            'check': 'structured_data_presence',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': f'{schema_count} structured data blocks found',
            'recommendation': '',
            'score_impact': 10
        })
    
    # === 8. HTTPS ===
    is_https = final_url.startswith('https://')
    
    if not is_https:
        issues.append({
            'check': 'https',
            'category': 'technical',
            'passed': False,
            'severity': 'error',
            'message': 'Site not using HTTPS',
            'recommendation': 'Enable HTTPS for security and SEO benefits',
            'score_impact': 10
        })
    else:
        issues.append({
            'check': 'https',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': 'Site using HTTPS',
            'recommendation': '',
            'score_impact': 10
        })
    
    # === 9. CANONICAL TAG ===
    canonical = soup.find('link', attrs={'rel': 'canonical'})
    
    if not canonical:
        issues.append({
            'check': 'canonical_tag',
            'category': 'technical',
            'passed': False,
            'severity': 'notice',
            'message': 'No canonical tag',
            'recommendation': 'Add canonical tag to prevent duplicate content issues',
            'score_impact': 5
        })
    else:
        canonical_href = canonical.get('href', '').strip()
        
        # Normalize URLs for comparison (remove trailing slashes, lowercase)
        def normalize_url(url):
            return url.rstrip('/').lower().replace('http://', 'https://')
        
        canonical_normalized = normalize_url(canonical_href)
        final_url_normalized = normalize_url(final_url)
        
        if not canonical_href:
            issues.append({
                'check': 'canonical_tag',
                'category': 'technical',
                'passed': False,
                'severity': 'warning',
                'message': 'Canonical tag has empty href',
                'recommendation': 'Set canonical href to the preferred URL for this page',
                'score_impact': 5
            })
        elif canonical_normalized == final_url_normalized:
            # Self-referencing canonical - correct
            issues.append({
                'check': 'canonical_tag',
                'category': 'technical',
                'passed': True,
                'severity': 'pass',
                'message': 'Canonical tag is self-referencing (correct)',
                'recommendation': '',
                'score_impact': 5
            })
        else:
            # Points to different URL - could be intentional but flag it
            canonical_short = canonical_href[:60] + ('...' if len(canonical_href) > 60 else '')
            issues.append({
                'check': 'canonical_tag',
                'category': 'technical',
                'passed': False,
                'severity': 'notice',
                'message': f'Canonical points to different URL: {canonical_short}',
                'recommendation': 'Verify canonical URL is correct - this page may be considered duplicate content',
                'score_impact': 5
            })
    
    # === 10. ROBOTS META (noindex/nofollow detection) ===
    robots_meta = soup.find('meta', attrs={'name': 'robots'})
    googlebot_meta = soup.find('meta', attrs={'name': 'googlebot'})
    
    noindex_found = False
    nofollow_found = False
    
    for meta in [robots_meta, googlebot_meta]:
        if meta:
            content = (meta.get('content') or '').lower()
            if 'noindex' in content:
                noindex_found = True
            if 'nofollow' in content:
                nofollow_found = True
    
    if noindex_found:
        issues.append({
            'check': 'robots_meta',
            'category': 'technical',
            'passed': False,
            'severity': 'error',
            'message': 'Page has noindex directive - blocked from search engines',
            'recommendation': 'Remove noindex directive if this page should be indexed by search engines and AI',
            'score_impact': 15
        })
    elif nofollow_found:
        issues.append({
            'check': 'robots_meta',
            'category': 'technical',
            'passed': False,
            'severity': 'warning',
            'message': 'Page has nofollow directive - links not followed by crawlers',
            'recommendation': 'Consider removing nofollow if you want crawlers to follow links on this page',
            'score_impact': 5
        })
    else:
        issues.append({
            'check': 'robots_meta',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': 'No indexing restrictions found',
            'recommendation': '',
            'score_impact': 15
        })
    
    # === 11. CONTENT QUALITY (Word Count) ===
    body_text = soup.get_text(separator=' ', strip=True)
    word_count = len(body_text.split())
    
    if word_count < 300:
        issues.append({
            'check': 'content_word_count',
            'category': 'technical',
            'passed': False,
            'severity': 'warning',
            'message': f'Low word count ({word_count} words)',
            'recommendation': 'Add more comprehensive content (aim for 500+ words)',
            'score_impact': 10
        })
    elif word_count < 500:
        issues.append({
            'check': 'content_word_count',
            'category': 'technical',
            'passed': False,
            'severity': 'notice',
            'message': f'Moderate word count ({word_count} words)',
            'recommendation': 'Consider expanding to 500+ words for better ranking',
            'score_impact': 10
        })
    else:
        issues.append({
            'check': 'content_word_count',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': f'Good content length ({word_count} words)',
            'recommendation': '',
            'score_impact': 10
        })
    
    # === 12. INTERNAL LINKING ===
    all_links = soup.find_all('a', href=True)
    domain = urlparse(final_url).netloc
    
    def is_internal_link(href: str) -> bool:
        """Check if a link is internal (relative or same domain)."""
        if not href:
            return False
        # Skip non-navigational links
        if href.startswith(('javascript:', 'mailto:', 'tel:', 'data:')):
            return False
        # Anchor links are internal
        if href.startswith('#'):
            return True
        # Relative paths (starting with / but not //) are internal
        if href.startswith('/') and not href.startswith('//'):
            return True
        # Check if absolute URL matches domain
        try:
            parsed = urlparse(href)
            # If no netloc, it's a relative URL
            if not parsed.netloc:
                return True
            # If netloc matches our domain
            return domain in parsed.netloc or parsed.netloc in domain
        except:
            return False
    
    internal_count = sum(1 for link in all_links if is_internal_link(link.get('href', '')))
    external_count = len(all_links) - internal_count
    
    if internal_count < 3:
        issues.append({
            'check': 'internal_linking',
            'category': 'technical',
            'passed': False,
            'severity': 'notice',
            'message': f'Only {internal_count} internal links',
            'recommendation': 'Add more internal links (5-10) to improve site structure',
            'score_impact': 5
        })
    else:
        issues.append({
            'check': 'internal_linking',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': f'{internal_count} internal links, {external_count} external',
            'recommendation': '',
            'score_impact': 5
        })
    
    # === 13. LANGUAGE TAG ===
    html_tag = soup.find('html')
    lang_attr = html_tag.get('lang') if html_tag else None
    
    if not lang_attr:
        issues.append({
            'check': 'language_tag',
            'category': 'technical',
            'passed': False,
            'severity': 'notice',
            'message': 'No lang attribute on <html> tag',
            'recommendation': "Add lang='en' (or appropriate language) to <html> tag",
            'score_impact': 5
        })
    else:
        issues.append({
            'check': 'language_tag',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': f'Language set to: {lang_attr}',
            'recommendation': '',
            'score_impact': 5
        })
    
    # === 14. SITEMAP.XML ===
    if sitemap_found:
        issues.append({
            'check': 'sitemap_xml',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': 'Sitemap.xml found',
            'recommendation': '',
            'score_impact': 5
        })
    else:
        issues.append({
            'check': 'sitemap_xml',
            'category': 'technical',
            'passed': False,
            'severity': 'warning',
            'message': 'No sitemap.xml found',
            'recommendation': 'Add sitemap.xml to help search engines and AI crawlers discover content',
            'score_impact': 5
        })
    
    # === 15. RESPONSE TIME ===
    if response_time_ms > 0:
        if response_time_ms < 500:
            issues.append({
                'check': 'response_time',
                'category': 'technical',
                'passed': True,
                'severity': 'pass',
                'message': f'Fast response time ({response_time_ms}ms)',
                'recommendation': '',
                'score_impact': 5
            })
        elif response_time_ms < 1000:
            issues.append({
                'check': 'response_time',
                'category': 'technical',
                'passed': False,
                'severity': 'notice',
                'message': f'Moderate response time ({response_time_ms}ms)',
                'recommendation': 'Consider optimizing for sub-500ms response time',
                'score_impact': 5
            })
        elif response_time_ms < 2000:
            issues.append({
                'check': 'response_time',
                'category': 'technical',
                'passed': False,
                'severity': 'warning',
                'message': f'Slow response time ({response_time_ms}ms)',
                'recommendation': 'Optimize server response time to under 1 second',
                'score_impact': 5
            })
        else:
            issues.append({
                'check': 'response_time',
                'category': 'technical',
                'passed': False,
                'severity': 'error',
                'message': f'Very slow response time ({response_time_ms}ms)',
                'recommendation': 'Critical: response time over 2 seconds significantly impacts SEO and user experience',
                'score_impact': 5
            })
    
    # === 16. HREFLANG TAGS (International SEO) ===
    hreflang_tags = soup.find_all('link', attrs={'rel': 'alternate', 'hreflang': True})
    
    if len(hreflang_tags) > 0:
        # Extract language codes
        langs = [tag.get('hreflang', '') for tag in hreflang_tags]
        # Check for x-default (important for hreflang)
        has_x_default = 'x-default' in langs
        
        # Display first 5 languages
        display_langs = langs[:5]
        more_text = f" (+{len(langs) - 5} more)" if len(langs) > 5 else ""
        
        if has_x_default:
            issues.append({
                'check': 'hreflang_tags',
                'category': 'technical',
                'passed': True,
                'severity': 'pass',
                'message': f'Hreflang configured for {len(langs)} versions including x-default: {", ".join(display_langs)}{more_text}',
                'recommendation': '',
                'score_impact': 5
            })
        else:
            issues.append({
                'check': 'hreflang_tags',
                'category': 'technical',
                'passed': False,
                'severity': 'notice',
                'message': f'Hreflang present ({len(langs)} versions) but missing x-default: {", ".join(display_langs)}{more_text}',
                'recommendation': 'Add x-default hreflang to specify the default/fallback page',
                'score_impact': 5
            })
    else:
        # No hreflang - this is fine for single-language sites, so mark as pass
        issues.append({
            'check': 'hreflang_tags',
            'category': 'technical',
            'passed': True,
            'severity': 'pass',
            'message': 'No hreflang tags (single-language site)',
            'recommendation': '',
            'score_impact': 5
        })
    
    return issues


def extract_technical_summary(soup: BeautifulSoup, final_url: str) -> Dict[str, Any]:
    """Extract technical summary data for the response."""
    title = soup.find('title')
    title_text = title.text.strip() if title else ""
    
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    meta_text = str(meta_desc.get('content', '')).strip() if meta_desc else ""
    
    images = soup.find_all('img')
    total_images = len(images)
    images_with_alt = len([img for img in images if img.get('alt') is not None])
    images_with_descriptive_alt = len([img for img in images if img.get('alt')])
    
    body_text = soup.get_text(separator=' ', strip=True)
    word_count = len(body_text.split())
    
    return {
        'title': title_text[:100] if title_text else 'Missing',
        'title_length': len(title_text),
        'meta_description': meta_text[:160] if meta_text else 'Missing',
        'meta_length': len(meta_text),
        'word_count': word_count,
        'h1_count': len(soup.find_all('h1')),
        'images_total': total_images,
        'images_with_alt': images_with_alt,
        'images_with_descriptive_alt': images_with_descriptive_alt,
        'https': final_url.startswith('https://'),
    }

