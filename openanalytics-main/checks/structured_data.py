"""Structured Data Depth Analysis - 6 AEO-focused checks

v3.0 Overhaul:
- Removed breadcrumb_schema (nice-to-have, not AEO-critical)

Analyzes Schema.org structured data for:
- Organization schema completeness
- FAQ/HowTo content schemas
- Knowledge graph signals (sameAs links)
- Content freshness (datePublished, dateModified)
- JSON-LD validation (required fields per schema type)
"""

import json
import re
from typing import List, Dict, Any, Optional, Tuple
from bs4 import BeautifulSoup


def extract_schema_data(soup: BeautifulSoup) -> Tuple[List[str], List[Dict], Optional[Dict]]:
    """Extract all JSON-LD structured data from page.
    
    Returns:
        Tuple of (schema_types, all_schemas, organization_schema)
    """
    schema_scripts = soup.find_all('script', attrs={'type': 'application/ld+json'})
    schema_types = []
    all_schemas = []
    org_schema = None
    
    for script in schema_scripts:
        try:
            data = json.loads(script.string.strip())
            
            # Handle @graph structure
            if isinstance(data, dict) and "@graph" in data:
                items = data["@graph"]
            elif isinstance(data, list):
                items = data
            else:
                items = [data]
            
            for item in items:
                if isinstance(item, dict):
                    all_schemas.append(item)
                    schema_type = item.get("@type")
                    
                    if schema_type:
                        if isinstance(schema_type, list):
                            schema_types.extend(schema_type)
                        else:
                            schema_types.append(schema_type)
                    
                    # Capture Organization/LocalBusiness schema
                    if schema_type in ["Organization", "LocalBusiness", "Corporation", "Company"]:
                        if org_schema is None:
                            org_schema = item
                            
        except (json.JSONDecodeError, TypeError, AttributeError):
            continue
    
    # Deduplicate schema types
    schema_types = list(dict.fromkeys(schema_types))
    
    return (schema_types, all_schemas, org_schema)


def calculate_org_schema_completeness(org_schema: Optional[Dict]) -> float:
    """Calculate completeness of Organization schema (0.0 - 1.0).
    
    Key fields checked:
    - name (required)
    - url (required)
    - logo (important)
    - description (important)
    - sameAs (important for knowledge graph)
    - address (good to have)
    - contactPoint (good to have)
    """
    if not org_schema:
        return 0.0
    
    # Required fields (40%)
    required_score = 0.0
    if org_schema.get("name"):
        required_score += 0.2
    if org_schema.get("url"):
        required_score += 0.2
    
    # Important fields (40%)
    important_score = 0.0
    if org_schema.get("logo"):
        important_score += 0.15
    if org_schema.get("description"):
        important_score += 0.15
    if org_schema.get("sameAs") and len(org_schema.get("sameAs", [])) > 0:
        important_score += 0.1
    
    # Good to have (20%)
    optional_score = 0.0
    if org_schema.get("address"):
        optional_score += 0.1
    if org_schema.get("contactPoint"):
        optional_score += 0.05
    if org_schema.get("foundingDate"):
        optional_score += 0.025
    if org_schema.get("founder") or org_schema.get("founders"):
        optional_score += 0.025
    
    return min(1.0, required_score + important_score + optional_score)


def count_same_as_links(org_schema: Optional[Dict]) -> int:
    """Count sameAs links for knowledge graph connectivity."""
    if not org_schema:
        return 0
    
    same_as = org_schema.get("sameAs", [])
    if isinstance(same_as, str):
        return 1
    elif isinstance(same_as, list):
        return len(same_as)
    return 0


def check_content_freshness(soup: BeautifulSoup, all_schemas: List[Dict]) -> Dict[str, Any]:
    """Check for content freshness signals.
    
    Looks for:
    - datePublished in schema (Article, BlogPosting, etc.)
    - dateModified in schema
    - HTML <time> elements with datetime attribute
    - Last-modified meta tags
    
    Returns:
        Dict with has_date_published, has_date_modified, dates_found
    """
    has_date_published = False
    has_date_modified = False
    dates_found = []
    
    # Check schema.org for dates
    for schema in all_schemas:
        schema_type = schema.get("@type", "")
        
        # Look for date fields in content schemas
        if schema_type in ["Article", "BlogPosting", "NewsArticle", "TechArticle", "HowTo", "WebPage"]:
            if schema.get("datePublished"):
                has_date_published = True
                dates_found.append(f"schema:datePublished")
            if schema.get("dateModified"):
                has_date_modified = True
                dates_found.append(f"schema:dateModified")
    
    # Check HTML <time> elements
    time_elements = soup.find_all('time', attrs={'datetime': True})
    if time_elements:
        # Assume at least one time element indicates some date presence
        if not has_date_published:
            has_date_published = True
            dates_found.append("html:time")
    
    # Check meta tags for article dates
    article_published = soup.find('meta', attrs={'property': 'article:published_time'})
    article_modified = soup.find('meta', attrs={'property': 'article:modified_time'})
    
    if article_published:
        has_date_published = True
        dates_found.append("meta:article:published_time")
    if article_modified:
        has_date_modified = True
        dates_found.append("meta:article:modified_time")
    
    return {
        'has_date_published': has_date_published,
        'has_date_modified': has_date_modified,
        'dates_found': dates_found,
    }


# Required fields for common schema types (Google's Rich Results requirements)
SCHEMA_REQUIRED_FIELDS = {
    'Organization': ['name', 'url'],
    'LocalBusiness': ['name', 'address'],
    'Article': ['headline', 'author', 'datePublished'],
    'BlogPosting': ['headline', 'author', 'datePublished'],
    'NewsArticle': ['headline', 'author', 'datePublished'],
    'Product': ['name'],
    'FAQPage': ['mainEntity'],
    'HowTo': ['name', 'step'],
    'Recipe': ['name', 'recipeIngredient', 'recipeInstructions'],
    'Event': ['name', 'startDate', 'location'],
    'Person': ['name'],
    'WebPage': ['name'],
    'WebSite': ['name', 'url'],
}


def validate_schema(schema: Dict) -> List[str]:
    """Validate a schema object has required fields.
    
    Args:
        schema: Schema.org JSON-LD object
        
    Returns:
        List of missing required field names
    """
    schema_type = schema.get('@type', '')
    
    # Handle array types (take first)
    if isinstance(schema_type, list):
        schema_type = schema_type[0] if schema_type else ''
    
    required = SCHEMA_REQUIRED_FIELDS.get(schema_type, [])
    missing = []
    
    for field in required:
        if field not in schema or not schema[field]:
            missing.append(field)
    
    return missing


def validate_all_schemas(all_schemas: List[Dict]) -> Dict[str, Any]:
    """Validate all schemas and return summary.
    
    Returns:
        Dict with validation_errors (list), has_errors (bool), schemas_checked (int)
    """
    validation_errors = []
    
    for schema in all_schemas:
        schema_type = schema.get('@type', 'Unknown')
        if isinstance(schema_type, list):
            schema_type = schema_type[0] if schema_type else 'Unknown'
        
        # Only validate schemas we have requirements for
        if schema_type in SCHEMA_REQUIRED_FIELDS:
            missing = validate_schema(schema)
            if missing:
                validation_errors.append({
                    'type': schema_type,
                    'missing_fields': missing,
                })
    
    return {
        'validation_errors': validation_errors,
        'has_errors': len(validation_errors) > 0,
        'schemas_checked': len([s for s in all_schemas if s.get('@type') in SCHEMA_REQUIRED_FIELDS]),
    }


def run_structured_data_checks(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """Run all 6 structured data depth checks.
    
    Args:
        soup: Parsed HTML content
        
    Returns:
        List of check results
    """
    issues = []
    schema_types, all_schemas, org_schema = extract_schema_data(soup)
    
    # === 1. ORGANIZATION SCHEMA COMPLETENESS ===
    completeness = calculate_org_schema_completeness(org_schema)
    
    if org_schema is None:
        issues.append({
            'check': 'org_schema_completeness',
            'category': 'structured_data',
            'passed': False,
            'severity': 'warning',
            'message': 'No Organization schema found',
            'recommendation': 'Add Organization schema with name, url, logo, description, and sameAs links',
            'score_impact': 10
        })
    elif completeness < 0.5:
        issues.append({
            'check': 'org_schema_completeness',
            'category': 'structured_data',
            'passed': False,
            'severity': 'warning',
            'message': f'Organization schema incomplete ({completeness*100:.0f}%)',
            'recommendation': 'Add missing fields: logo, description, sameAs links to Wikipedia/LinkedIn',
            'score_impact': 10
        })
    else:
        issues.append({
            'check': 'org_schema_completeness',
            'category': 'structured_data',
            'passed': True,
            'severity': 'pass',
            'message': f'Organization schema complete ({completeness*100:.0f}%)',
            'recommendation': '',
            'score_impact': 10
        })
    
    # === 2. FAQ SCHEMA ===
    has_faq = any(t in ["FAQPage", "Question"] for t in schema_types)
    
    if not has_faq:
        issues.append({
            'check': 'faq_schema',
            'category': 'structured_data',
            'passed': False,
            'severity': 'notice',
            'message': 'No FAQ schema found',
            'recommendation': 'Add FAQPage schema to help AI extract Q&A content',
            'score_impact': 5
        })
    else:
        issues.append({
            'check': 'faq_schema',
            'category': 'structured_data',
            'passed': True,
            'severity': 'pass',
            'message': 'FAQ schema present',
            'recommendation': '',
            'score_impact': 5
        })
    
    # === 3. HOWTO/ARTICLE SCHEMA ===
    content_schemas = ["HowTo", "Article", "BlogPosting", "NewsArticle", "TechArticle"]
    has_content_schema = any(t in content_schemas for t in schema_types)
    
    if not has_content_schema:
        issues.append({
            'check': 'content_schema',
            'category': 'structured_data',
            'passed': False,
            'severity': 'notice',
            'message': 'No content schema (HowTo/Article) found',
            'recommendation': 'Add Article or HowTo schema for content-rich pages',
            'score_impact': 5
        })
    else:
        found_types = [t for t in schema_types if t in content_schemas]
        issues.append({
            'check': 'content_schema',
            'category': 'structured_data',
            'passed': True,
            'severity': 'pass',
            'message': f'Content schema present: {", ".join(found_types)}',
            'recommendation': '',
            'score_impact': 5
        })
    
    # === 4. SAMEAS LINKS (Knowledge Graph) ===
    # (Breadcrumb schema check removed - nice-to-have, not AEO-critical)
    same_as_count = count_same_as_links(org_schema)
    
    if same_as_count == 0:
        issues.append({
            'check': 'sameas_links',
            'category': 'structured_data',
            'passed': False,
            'severity': 'warning',
            'message': 'No sameAs links in Organization schema',
            'recommendation': 'Add sameAs links to LinkedIn, Wikipedia, Twitter, Crunchbase for knowledge graph',
            'score_impact': 5
        })
    elif same_as_count < 3:
        issues.append({
            'check': 'sameas_links',
            'category': 'structured_data',
            'passed': False,
            'severity': 'notice',
            'message': f'Only {same_as_count} sameAs link(s)',
            'recommendation': 'Add more sameAs links (aim for 3-5) to strengthen entity recognition',
            'score_impact': 5
        })
    else:
        issues.append({
            'check': 'sameas_links',
            'category': 'structured_data',
            'passed': True,
            'severity': 'pass',
            'message': f'{same_as_count} sameAs links found',
            'recommendation': '',
            'score_impact': 5
        })
    
    # === 5. CONTENT FRESHNESS ===
    freshness = check_content_freshness(soup, all_schemas)
    
    if not freshness['has_date_published'] and not freshness['has_date_modified']:
        issues.append({
            'check': 'content_freshness',
            'category': 'structured_data',
            'passed': False,
            'severity': 'notice',
            'message': 'No content dates found (datePublished/dateModified)',
            'recommendation': 'Add datePublished and dateModified to Article schema or use <time> elements',
            'score_impact': 5
        })
    elif not freshness['has_date_modified']:
        issues.append({
            'check': 'content_freshness',
            'category': 'structured_data',
            'passed': False,
            'severity': 'notice',
            'message': f'Has datePublished but no dateModified ({", ".join(freshness["dates_found"])})',
            'recommendation': 'Add dateModified to show content is maintained and up-to-date',
            'score_impact': 5
        })
    else:
        issues.append({
            'check': 'content_freshness',
            'category': 'structured_data',
            'passed': True,
            'severity': 'pass',
            'message': f'Content dates present ({", ".join(freshness["dates_found"])})',
            'recommendation': '',
            'score_impact': 5
        })
    
    # === 6. JSON-LD VALIDATION ===
    validation = validate_all_schemas(all_schemas)
    
    if validation['schemas_checked'] == 0:
        # No schemas to validate - mark as pass (absence already penalized above)
        issues.append({
            'check': 'jsonld_validation',
            'category': 'structured_data',
            'passed': True,
            'severity': 'pass',
            'message': 'No validatable schemas found',
            'recommendation': '',
            'score_impact': 5
        })
    elif validation['has_errors']:
        # Build error summary
        error_msgs = []
        for err in validation['validation_errors'][:3]:  # Show first 3
            error_msgs.append(f"{err['type']} missing: {', '.join(err['missing_fields'])}")
        
        issues.append({
            'check': 'jsonld_validation',
            'category': 'structured_data',
            'passed': False,
            'severity': 'warning',
            'message': f"Schema validation errors ({len(validation['validation_errors'])}): {'; '.join(error_msgs)}",
            'recommendation': 'Add missing required fields to fix Rich Results eligibility',
            'score_impact': 5
        })
    else:
        issues.append({
            'check': 'jsonld_validation',
            'category': 'structured_data',
            'passed': True,
            'severity': 'pass',
            'message': f"All {validation['schemas_checked']} schemas have required fields",
            'recommendation': '',
            'score_impact': 5
        })
    
    return issues


def extract_structured_data_summary(soup: BeautifulSoup) -> Dict[str, Any]:
    """Extract structured data summary for the response."""
    schema_types, all_schemas, org_schema = extract_schema_data(soup)
    completeness = calculate_org_schema_completeness(org_schema)
    same_as_count = count_same_as_links(org_schema)
    
    # Extract sameAs URLs
    same_as_urls = []
    if org_schema and org_schema.get("sameAs"):
        same_as = org_schema.get("sameAs", [])
        if isinstance(same_as, str):
            same_as_urls = [same_as]
        elif isinstance(same_as, list):
            same_as_urls = same_as
    
    return {
        'schema_types': schema_types,
        'schema_count': len(all_schemas),
        'schema_completeness': round(completeness, 2),
        'has_organization': org_schema is not None,
        'has_faq': any(t in ["FAQPage", "Question"] for t in schema_types),
        'has_howto': "HowTo" in schema_types,
        'has_article': any(t in ["Article", "BlogPosting", "NewsArticle"] for t in schema_types),
        'same_as_count': same_as_count,
        'same_as_urls': same_as_urls[:5],  # Limit to 5
    }

