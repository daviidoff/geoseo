"""Authority & E-E-A-T Signal Checks - 3 trust indicator checks

v3.0 Overhaul:
- Removed author_team_pages (often missing even on great sites)
- Removed privacy_policy (legal requirement, not AEO-relevant)

Detects Experience, Expertise, Authoritativeness, and Trustworthiness signals:
- About page presence
- Contact information
- Social proof links
"""

import re
from typing import List, Dict, Any, Set
from bs4 import BeautifulSoup


def find_link_patterns(soup: BeautifulSoup, patterns: List[str]) -> bool:
    """Check if any links match the given URL patterns.
    
    Args:
        soup: Parsed HTML
        patterns: List of regex patterns to match against href
        
    Returns:
        True if any matching link found
    """
    all_links = soup.find_all('a', href=True)
    
    for link in all_links:
        href = link.get('href', '').lower()
        for pattern in patterns:
            if re.search(pattern, href):
                return True
    
    return False


def extract_social_links(soup: BeautifulSoup, same_as_urls: List[str] = None) -> Set[str]:
    """Extract social media platform links from HTML and schema.org sameAs.
    
    Args:
        soup: Parsed HTML
        same_as_urls: Optional list of sameAs URLs from structured data
        
    Returns:
        Set of social platform names found
    """
    social_patterns = {
        'linkedin': r'linkedin\.com',
        'twitter': r'(twitter\.com|x\.com)',
        'facebook': r'facebook\.com',
        'instagram': r'instagram\.com',
        'youtube': r'youtube\.com',
        'github': r'github\.com',
        'tiktok': r'tiktok\.com',
    }
    
    found_socials = set()
    
    # 1. Check HTML <a> tags
    all_links = soup.find_all('a', href=True)
    for link in all_links:
        href = link.get('href', '').lower()
        for platform, pattern in social_patterns.items():
            if re.search(pattern, href):
                found_socials.add(platform)
    
    # 2. Check schema.org sameAs URLs
    if same_as_urls:
        for url in same_as_urls:
            url_lower = url.lower()
            for platform, pattern in social_patterns.items():
                if re.search(pattern, url_lower):
                    found_socials.add(platform)
    
    return found_socials


def has_contact_info(soup: BeautifulSoup) -> Dict[str, bool]:
    """Check for contact information on the page."""
    text = soup.get_text(separator=' ', strip=True)
    
    # Email pattern (stricter to avoid false positives)
    has_email = bool(re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text))
    
    # Phone patterns - require context or international format to avoid false positives
    phone_patterns = [
        r'(?:tel|phone|call|fax|mobile)[\s:]+[\+\d\s\-\(\)\.]{10,}',  # With context word
        r'\+\d{1,3}[\s\-]?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}',  # International format with +
        r'(?:1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',  # US format with area code
    ]
    has_phone = any(re.search(p, text, re.IGNORECASE) for p in phone_patterns)
    
    # Address indicators
    address_patterns = [
        r'\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|way|drive|dr)\b',
        r'(?:floor|suite|ste|unit)\s*#?\s*\d+',
        r'\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b',  # US ZIP
        r'\b\d{5}\s+[A-Za-z]+\b',  # German postal (5 digits + city)
    ]
    has_address = any(re.search(p, text, re.IGNORECASE) for p in address_patterns)
    
    return {
        'has_email': has_email,
        'has_phone': has_phone,
        'has_address': has_address,
    }


def run_authority_checks(soup: BeautifulSoup, same_as_urls: List[str] = None) -> List[Dict[str, Any]]:
    """Run all 3 authority/E-E-A-T signal checks.
    
    Args:
        soup: Parsed HTML content
        same_as_urls: Optional list of sameAs URLs from structured data
        
    Returns:
        List of check results
    """
    issues = []
    
    # === 1. ABOUT PAGE ===
    about_patterns = [
        r'/about($|/|-us|_us)',
        r'/company($|/)',
        r'/who-we-are',
        r'/our-story',
        r'/ueber-uns',  # German
        r'/wir-sind',   # German
    ]
    has_about = find_link_patterns(soup, about_patterns)
    
    if not has_about:
        issues.append({
            'check': 'about_page',
            'category': 'authority',
            'passed': False,
            'severity': 'notice',
            'message': 'No About page link found',
            'recommendation': 'Add a visible link to your About/Company page for trust signals',
            'score_impact': 5
        })
    else:
        issues.append({
            'check': 'about_page',
            'category': 'authority',
            'passed': True,
            'severity': 'pass',
            'message': 'About page link found',
            'recommendation': '',
            'score_impact': 5
        })
    
    # === 2. CONTACT INFORMATION ===
    contact_info = has_contact_info(soup)
    has_any_contact = contact_info['has_email'] or contact_info['has_phone'] or contact_info['has_address']
    
    # Also check for contact page link
    contact_patterns = [r'/contact($|/|-us)', r'/kontakt', r'/get-in-touch']
    has_contact_page = find_link_patterns(soup, contact_patterns)
    
    if not has_any_contact and not has_contact_page:
        issues.append({
            'check': 'contact_info',
            'category': 'authority',
            'passed': False,
            'severity': 'warning',
            'message': 'No contact information found',
            'recommendation': 'Add visible email, phone, or address for trust and local SEO',
            'score_impact': 5
        })
    else:
        contact_types = []
        if contact_info['has_email']:
            contact_types.append('email')
        if contact_info['has_phone']:
            contact_types.append('phone')
        if contact_info['has_address']:
            contact_types.append('address')
        if has_contact_page:
            contact_types.append('contact page')
        
        issues.append({
            'check': 'contact_info',
            'category': 'authority',
            'passed': True,
            'severity': 'pass',
            'message': f'Contact info found: {", ".join(contact_types)}',
            'recommendation': '',
            'score_impact': 5
        })
    
    # === 3. SOCIAL PROOF LINKS ===
    # (Author/team pages check removed - often missing even on great sites)
    social_links = extract_social_links(soup, same_as_urls=same_as_urls)
    key_socials = {'linkedin', 'twitter'}
    has_key_socials = len(social_links.intersection(key_socials)) > 0
    
    if len(social_links) == 0:
        issues.append({
            'check': 'social_proof_links',
            'category': 'authority',
            'passed': False,
            'severity': 'warning',
            'message': 'No social media links found',
            'recommendation': 'Add links to LinkedIn, Twitter/X for social proof and entity recognition',
            'score_impact': 4
        })
    elif not has_key_socials:
        issues.append({
            'check': 'social_proof_links',
            'category': 'authority',
            'passed': False,
            'severity': 'notice',
            'message': f'Found social links ({", ".join(social_links)}) but missing LinkedIn/Twitter',
            'recommendation': 'Add LinkedIn and Twitter for stronger business authority signals',
            'score_impact': 4
        })
    else:
        issues.append({
            'check': 'social_proof_links',
            'category': 'authority',
            'passed': True,
            'severity': 'pass',
            'message': f'Social proof links found: {", ".join(sorted(social_links))}',
            'recommendation': '',
            'score_impact': 4
        })
    
    # (Privacy policy check removed - legal requirement, not AEO-relevant)
    
    return issues


def extract_authority_summary(soup: BeautifulSoup, same_as_urls: List[str] = None) -> Dict[str, Any]:
    """Extract authority signal summary for the response.
    
    Args:
        soup: Parsed HTML
        same_as_urls: Optional list of sameAs URLs from structured data
    """
    about_patterns = [r'/about($|/|-us)', r'/company($|/)']
    contact_patterns = [r'/contact($|/)', r'/kontakt']
    
    contact_info = has_contact_info(soup)
    social_links = extract_social_links(soup, same_as_urls=same_as_urls)
    
    return {
        'has_about_page': find_link_patterns(soup, about_patterns),
        'has_contact_page': find_link_patterns(soup, contact_patterns),
        'has_contact_info': contact_info['has_email'] or contact_info['has_phone'],
        'social_links': list(social_links),
    }

