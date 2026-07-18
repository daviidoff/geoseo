"""
OpenContext Data Models

Pydantic models for company context extraction.
Full parity with openblog/stage 1 schema.
"""

import logging
import re
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)


# =============================================================================
# Voice Persona (for content writing)
# =============================================================================

class LanguageStyle(BaseModel):
    """Language style preferences for content writing."""
    formality: Optional[str] = Field(default="professional", description="casual/professional/formal")
    complexity: Optional[str] = Field(default="moderate", description="simple/moderate/technical/expert")
    sentence_length: Optional[str] = Field(default="mixed", description="short and punchy / mixed / detailed")
    perspective: Optional[str] = Field(default="expert-to-learner", description="peer-to-peer / expert-to-learner / consultant-to-executive")


class VoicePersona(BaseModel):
    """Writing persona tailored to the ICP (Ideal Customer Profile)."""
    icp_profile: Optional[str] = Field(default="", description="Brief description of the ICP")
    voice_style: Optional[str] = Field(default="", description="2-3 sentence description of writing voice")
    language_style: LanguageStyle = Field(default_factory=LanguageStyle)
    sentence_patterns: List[str] = Field(default_factory=list, description="Example sentence patterns")
    vocabulary_level: Optional[str] = Field(default="", description="Technical vocabulary expectations")
    authority_signals: List[str] = Field(default_factory=list, description="What makes ICP trust content")
    do_list: List[str] = Field(default_factory=list, description="Behaviors that resonate with ICP")
    dont_list: List[str] = Field(default_factory=list, description="Anti-patterns to avoid")
    example_phrases: List[str] = Field(default_factory=list, description="Phrases that capture tone")
    opening_styles: List[str] = Field(default_factory=list, description="Section openers that engage")


# =============================================================================
# Author Info (from Blog Articles)
# =============================================================================

class AuthorInfo(BaseModel):
    """Author information extracted from blog articles."""
    name: str = Field(..., description="Author's full name")
    title: str = Field(default="", description="Author's job title/role")
    bio: str = Field(default="", description="Short author bio if available")
    image_url: str = Field(default="", description="Author's profile image URL if available")
    linkedin_url: str = Field(default="", description="Author's LinkedIn profile if available")
    twitter_url: str = Field(default="", description="Author's Twitter/X profile if available")


# =============================================================================
# EEAT Elements (Experience, Expertise, Authority, Trust)
# =============================================================================

class EEATElements(BaseModel):
    """
    EEAT Elements for Google's content quality signals.

    These elements help demonstrate Experience, Expertise, Authoritativeness,
    and Trustworthiness - critical for AI search visibility and SEO.
    """
    model_config = {"coerce_numbers_to_str": True}

    # Experience - demonstrable first-hand experience
    customer_count: str = Field(default="", description="Number of customers served (e.g., '10,000+', '500 enterprises')")
    reviews_rating: str = Field(default="", description="Review score if visible (e.g., '4.9/5 stars', '4.8 on G2')")
    years_in_business: str = Field(default="", description="Years company has been operating")
    case_study_topics: List[str] = Field(default_factory=list, description="Topics/industries of case studies mentioned")

    # Expertise - credentials and knowledge signals
    founder_credentials: List[str] = Field(default_factory=list, description="Founder/team credentials (e.g., 'Ex-Google', 'Stanford PhD')")
    certifications: List[str] = Field(default_factory=list, description="Company certifications (e.g., 'SOC 2 Type II', 'ISO 27001')")
    awards: List[str] = Field(default_factory=list, description="Awards and recognition")

    # Authoritativeness - external validation
    media_mentions: List[str] = Field(default_factory=list, description="Publications that have featured the company")
    partnerships: List[str] = Field(default_factory=list, description="Notable partnerships or integrations")
    investors: List[str] = Field(default_factory=list, description="Notable investors if disclosed")

    # Trustworthiness - trust signals
    pricing_transparency: str = Field(default="", description="Pricing visibility (e.g., 'public pricing', 'contact sales', 'freemium')")
    guarantees: List[str] = Field(default_factory=list, description="Guarantees offered (e.g., 'money-back guarantee', 'free trial')")
    security_compliance: List[str] = Field(default_factory=list, description="Security/compliance mentions (e.g., 'GDPR compliant', 'HIPAA')")

    @field_validator('customer_count', 'reviews_rating', 'years_in_business', 'pricing_transparency', mode='before')
    @classmethod
    def convert_none_to_empty(cls, v):
        """Convert None to empty string."""
        return "" if v is None else str(v)

    @field_validator('case_study_topics', 'founder_credentials', 'certifications', 'awards',
                     'media_mentions', 'partnerships', 'investors', 'guarantees', 'security_compliance', mode='before')
    @classmethod
    def convert_none_to_list(cls, v):
        """Convert None to empty list."""
        return [] if v is None else v


# =============================================================================
# Visual Identity (for Image Generation)
# =============================================================================

class BlogImageExample(BaseModel):
    """Example image from existing blog posts for style reference."""
    url: str = Field(..., description="Image URL")
    description: str = Field(default="", description="AI-generated description of the image style/content")
    image_type: str = Field(default="hero", description="Type: hero, inline, infographic, etc.")


class VisualIdentity(BaseModel):
    """Visual identity for consistent image generation."""
    brand_colors: List[str] = Field(default_factory=list, description="Primary brand colors as hex codes (e.g., #FF5733)")
    secondary_colors: List[str] = Field(default_factory=list, description="Secondary/accent colors as hex codes")
    visual_style: Optional[str] = Field(default="", description="Overall visual style (e.g., minimalist, bold, corporate, playful)")
    design_elements: List[str] = Field(default_factory=list, description="Common design elements (gradients, icons, illustrations)")
    typography_style: Optional[str] = Field(default="", description="Typography feel (modern sans-serif, classic serif, etc.)")
    image_style_prompt: Optional[str] = Field(default="", description="Base prompt for image generation")
    blog_image_examples: List[BlogImageExample] = Field(default_factory=list, description="Example images from existing blog posts")
    mood: Optional[str] = Field(default="", description="Overall mood/feeling (professional, friendly, innovative, trustworthy)")
    avoid_in_images: List[str] = Field(default_factory=list, description="Elements to avoid in generated images")


# =============================================================================
# Company Context (main output schema)
# =============================================================================

class CompanyContext(BaseModel):
    """
    Company context extracted via OpenContext (Gemini + Google Search).

    Full parity with openblog/stage 1 schema.
    """
    company_name: str = Field(default="", description="Official company name")
    company_url: str = Field(default="", description="Company website URL")
    industry: str = Field(default="", description="Primary industry category")
    description: str = Field(default="", description="2-3 sentence company description")
    products: List[str] = Field(default_factory=list, description="Products/services offered")
    services: List[str] = Field(default_factory=list, description="Services offered")
    target_audience: str = Field(default="", description="Ideal customer profile description")
    target_audiences: List[str] = Field(default_factory=list, description="Target audience segments")
    competitors: List[str] = Field(default_factory=list, description="Main competitors (specific company names)")
    competitor_categories: List[str] = Field(default_factory=list, description="Categories of competing solutions")
    primary_region: str = Field(default="", description="Primary geographic market (e.g., 'North America', 'DACH', 'Europe')")
    primary_country: str = Field(default="US", description="Primary country ISO code (e.g., 'US', 'DE', 'GB')")
    primary_language: str = Field(default="en", description="Primary language ISO code (e.g., 'en', 'de', 'fr')")
    tone: str = Field(default="professional", description="Brand voice (professional/friendly/authoritative)")
    pain_points: List[str] = Field(default_factory=list, description="Customer pain points addressed")
    value_propositions: List[str] = Field(default_factory=list, description="Key value propositions")
    use_cases: List[str] = Field(default_factory=list, description="Common use cases")
    content_themes: List[str] = Field(default_factory=list, description="Content themes/topics")
    voice_persona: VoicePersona = Field(default_factory=VoicePersona, description="Writing persona for ICP")
    visual_identity: VisualIdentity = Field(default_factory=VisualIdentity, description="Visual identity for image generation")
    authors: List[AuthorInfo] = Field(default_factory=list, description="Blog authors extracted from articles")
    eeat: EEATElements = Field(default_factory=EEATElements, description="EEAT elements for content quality signals")
    gtm_playbook: str = Field(default="", description="Go-to-market strategy/playbook classification")
    product_type: str = Field(default="", description="Product type classification (SaaS, API, Platform, etc.)")

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CompanyContext":
        """Create from dictionary, normalizing camelCase keys and handling nested structures."""
        if not data:
            return cls()

        # Normalize camelCase to snake_case for top-level keys
        normalized: Dict[str, Any] = {}
        for key, value in data.items():
            # Convert camelCase/PascalCase to snake_case
            snake = re.sub(r'(?<!^)(?=[A-Z])', '_', key).lower()
            normalized[snake] = value

        data = normalized

        # Handle voice_persona separately
        voice_data = data.get("voice_persona", {}) or data.get("voicePersona", {})
        if voice_data and isinstance(voice_data, dict):
            # Handle nested language_style
            lang_style_data = voice_data.get("language_style", {})
            if lang_style_data and isinstance(lang_style_data, dict):
                voice_data["language_style"] = LanguageStyle(**lang_style_data)
            data["voice_persona"] = VoicePersona(**voice_data)

        # Handle visual_identity separately
        visual_data = data.get("visual_identity", {}) or data.get("visualidentity", {})
        if visual_data and isinstance(visual_data, dict):
            # Handle nested blog_image_examples with proper error handling
            examples = visual_data.get("blog_image_examples", [])
            if examples:
                parsed_examples = []
                for ex in examples:
                    if isinstance(ex, dict):
                        try:
                            parsed_examples.append(BlogImageExample(**ex))
                        except Exception as e:
                            logger.warning(f"Failed to parse BlogImageExample: {e}")
                            continue
                    elif isinstance(ex, BlogImageExample):
                        parsed_examples.append(ex)
                visual_data["blog_image_examples"] = parsed_examples
            data["visual_identity"] = VisualIdentity(**visual_data)

        # Handle authors separately
        authors_data = data.get("authors", [])
        if authors_data and isinstance(authors_data, list):
            parsed_authors = []
            for author in authors_data:
                if isinstance(author, dict) and author.get("name"):
                    # Clean None values to empty strings for optional fields
                    cleaned = {
                        k: (v if v is not None else "")
                        for k, v in author.items()
                    }
                    parsed_authors.append(AuthorInfo(**cleaned))
            data["authors"] = parsed_authors

        # Handle eeat separately
        eeat_data = data.get("eeat", {})
        if eeat_data and isinstance(eeat_data, dict):
            data["eeat"] = EEATElements(**eeat_data)

        return cls(**{k: v for k, v in data.items() if k in cls.model_fields})


def generate_slug(keyword: str, max_length: int = 100) -> str:
    """
    Generate URL-safe slug from keyword.

    Args:
        keyword: The keyword to convert to a slug
        max_length: Maximum slug length (default 100)

    Returns:
        URL-safe slug string (returns "article" if result would be empty)
    """
    if not keyword:
        return "article"

    slug = keyword.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)  # remove special chars
    slug = re.sub(r'[\s_]+', '-', slug)        # spaces/underscores to hyphens
    slug = re.sub(r'-+', '-', slug)            # collapse multiple hyphens
    slug = slug.strip('-')

    # Handle empty result (e.g., keyword was only special chars like "!!!")
    if not slug:
        return "article"

    # Truncate at word boundary if too long
    if len(slug) > max_length:
        slug = slug[:max_length]
        last_hyphen = slug.rfind('-')
        if last_hyphen > max_length // 2:
            slug = slug[:last_hyphen]

    return slug
