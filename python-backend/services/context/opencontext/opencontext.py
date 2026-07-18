"""
OpenContext - Company Context Extraction via Gemini

Extracts comprehensive company context from a URL using Google Gemini AI
with Google Search grounding.

Uses core GeminiClient for consistency.
"""

import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import Optional, Tuple

from .models import CompanyContext

# Import from core module (unified GeminiClient with retry)
try:
    from core.gemini_client import GeminiClient
    from core.config import ServiceType
except ImportError:
    GeminiClient = None  # Fallback mode
    ServiceType = None

try:
    from core.prompt_loader import load_prompt
    _PROMPT_LOADER_AVAILABLE = True
except ImportError:
    try:
        from services.context.shared.prompt_loader import load_prompt
        _PROMPT_LOADER_AVAILABLE = True
    except ImportError:
        _PROMPT_LOADER_AVAILABLE = False

logger = logging.getLogger(__name__)


# =============================================================================
# OpenContext Prompt - loaded from prompts/opencontext.txt
# =============================================================================

def _get_opencontext_prompt(url: str) -> str:
    """Load OpenContext prompt from file or use fallback."""
    if _PROMPT_LOADER_AVAILABLE:
        try:
            return load_prompt("opencontext", "opencontext", url=url)
        except FileNotFoundError:
            logger.warning("Prompt file not found, using fallback")

    # Fallback prompt (minimal version)
    return f'''Analyze the company website at {url} and extract company context.
Return JSON with: company_name, company_url, industry, description, products,
target_audience, competitors, tone, voice_persona, visual_identity, authors.
Analyze: {url}'''


# =============================================================================
# Gemini Client
# =============================================================================

def _get_company_context_schema():
    """Build response schema for CompanyContext structured output."""
    try:
        from google.genai import types

        # Simplified schema for Gemini structured output
        # Note: Gemini's response_schema doesn't support deeply nested objects well,
        # so we flatten complex nested structures
        return types.Schema(
            type=types.Type.OBJECT,
            properties={
                "company_name": types.Schema(type=types.Type.STRING, description="Official company name"),
                "company_url": types.Schema(type=types.Type.STRING, description="Company website URL"),
                "industry": types.Schema(type=types.Type.STRING, description="Primary industry category"),
                "description": types.Schema(type=types.Type.STRING, description="2-3 sentence company description"),
                "products": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING), description="Products offered"),
                "services": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING), description="Services offered"),
                "target_audience": types.Schema(type=types.Type.STRING, description="Ideal customer profile"),
                "target_audiences": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING), description="Target audience segments"),
                "competitors": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING), description="Main competitors"),
                "competitor_categories": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING), description="Competing solution categories"),
                "primary_region": types.Schema(type=types.Type.STRING, description="Primary geographic market"),
                "primary_country": types.Schema(type=types.Type.STRING, description="Primary country ISO code"),
                "primary_language": types.Schema(type=types.Type.STRING, description="Primary language ISO code"),
                "tone": types.Schema(type=types.Type.STRING, description="Brand voice tone"),
                "pain_points": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING), description="Customer pain points"),
                "value_propositions": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING), description="Key value propositions"),
                "use_cases": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING), description="Common use cases"),
                "content_themes": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING), description="Content themes/topics"),
                "gtm_playbook": types.Schema(type=types.Type.STRING, description="Go-to-market strategy classification"),
                "product_type": types.Schema(type=types.Type.STRING, description="Product type (SaaS, API, Platform, etc.)"),
            },
            required=["company_name", "company_url", "industry", "description"],
        )
    except ImportError:
        logger.warning("google.genai.types not available, falling back to dict schema")
        return None


async def run_opencontext(
    url: str,
    api_key: Optional[str] = None,
    user_context: Optional[dict] = None,
) -> CompanyContext:
    """
    Run OpenContext analysis on a company URL.

    Uses core GeminiClient with Google Search grounding and structured output.

    Args:
        url: Company website URL
        api_key: Gemini API key (falls back to GEMINI_API_KEY env var)
        user_context: Optional dict with user-provided context

    Returns:
        CompanyContext with extracted company information

    Raises:
        ValueError: If no API key provided
        Exception: If Gemini call fails
    """
    # Normalize URL
    if not url.startswith("http"):
        url = f"https://{url}"

    logger.info(f"Running OpenContext for {url}")

    try:
        # Use core GeminiClient
        if GeminiClient is None:
            raise ImportError("GeminiClient not available")

        # Use ServiceType.CONTEXT if available, otherwise use default
        if ServiceType is not None:
            client = GeminiClient(service_type=ServiceType.CONTEXT, api_key=api_key)
        else:
            client = GeminiClient(api_key=api_key)

        # Build prompt (loaded from prompts/opencontext.txt)
        prompt = _get_opencontext_prompt(url)

        # Append user-provided context if available
        if user_context:
            additional_context = []

            if user_context.get("system_instructions"):
                additional_context.append(f"\n\n## User Instructions:\n{user_context['system_instructions']}")

            if user_context.get("client_knowledge_base"):
                additional_context.append(f"\n\n## Known Facts About This Company:\n{user_context['client_knowledge_base']}")

            if user_context.get("content_instructions"):
                additional_context.append(f"\n\n## Content Guidelines:\n{user_context['content_instructions']}")

            if user_context.get("research_files"):
                research_text = "\n".join([
                    f"- {f.get('name', 'Document')}: {f.get('content', '')[:500]}..."
                    for f in user_context["research_files"][:3]  # Limit to 3 files
                ])
                additional_context.append(f"\n\n## Research Documents:\n{research_text}")

            if user_context.get("assets"):
                assets_text = "\n".join([
                    f"- {a.get('name', 'Asset')}: {a.get('description', '')[:200]}"
                    for a in user_context["assets"][:5]  # Limit to 5 assets
                ])
                additional_context.append(f"\n\n## Asset Descriptions:\n{assets_text}")

            if additional_context:
                prompt += "\n\nUse this additional context provided by the user to enhance your analysis:"
                prompt += "".join(additional_context)
                logger.info(f"Added user context: {len(additional_context)} sections")

        # Get structured output schema
        response_schema = _get_company_context_schema()

        # Call with Google Search grounding + URL Context + structured output
        if response_schema and hasattr(client, 'generate_with_schema'):
            logger.info("Using generate_with_schema for structured output")
            result = await client.generate_with_schema(
                prompt=prompt,
                response_schema=response_schema,
                use_url_context=True,
                use_google_search=True,
                temperature=0.3,
                extract_sources=True,
            )
        else:
            # Fallback to regular generate
            logger.warning("Falling back to generate without schema")
            result = await client.generate(
                prompt=prompt,
                use_url_context=True,
                use_google_search=True,
                json_output=True,
                temperature=0.3,
            )

        logger.info(f"OpenContext complete: {result.get('company_name', 'Unknown')}")

        # Convert to CompanyContext
        return CompanyContext.from_dict(result)

    except Exception as e:
        logger.error(f"OpenContext failed for {url}: {e}")
        raise


# =============================================================================
# Fallback: Basic Detection (no AI)
# =============================================================================

def basic_company_detection(url: str, reason: str = "no API key") -> CompanyContext:
    """
    Basic company detection from URL when AI extraction fails or no API key available.

    Extracts company name from domain. No AI call.

    Args:
        url: Company website URL
        reason: Reason for using basic detection (for logging)

    Returns:
        CompanyContext with basic info from URL
    """
    from urllib.parse import urlparse

    # Normalize URL
    if not url.startswith("http"):
        url = f"https://{url}"

    # Extract domain
    domain = urlparse(url).netloc.replace("www.", "")
    company_name = domain.split(".")[0].replace("-", " ").title()

    logger.warning(f"Using basic detection for {url} ({reason})")

    return CompanyContext(
        company_name=company_name,
        company_url=url,
        industry="",
        description="",
        products=[],
        target_audience="",
        competitors=[],
        tone="professional",
        pain_points=[],
        value_propositions=[],
        use_cases=[],
        content_themes=[],
    )


# =============================================================================
# Main Entry Point
# =============================================================================

async def get_company_context(
    url: str,
    api_key: Optional[str] = None,
    fallback_on_error: bool = True,
    user_context: Optional[dict] = None,
) -> Tuple[CompanyContext, bool]:
    """
    Get company context, with optional fallback to basic detection.

    Args:
        url: Company website URL
        api_key: Gemini API key (optional, uses env var)
        fallback_on_error: If True, returns basic detection on error
        user_context: Optional dict with system_instructions, client_knowledge_base, 
                     content_instructions, research_files, assets

    Returns:
        Tuple of (CompanyContext, ai_called: bool)
    """
    logger.warning(f"[OpenContext] get_company_context called for: {url}")
    # Check if API key available
    api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    
    logger.warning(f"[OpenContext] API key present: {bool(api_key)} (length: {len(api_key) if api_key else 0}), GeminiClient available: {GeminiClient is not None}")

    if not api_key:
        if fallback_on_error:
            logger.warning("No API key, using basic detection")
            return basic_company_detection(url, reason="no API key"), False
        else:
            raise ValueError("No Gemini API key available")

    try:
        logger.warning(f"[OpenContext] About to call run_opencontext")
        context = await run_opencontext(url, api_key, user_context)
        logger.warning(f"[OpenContext] run_opencontext returned successfully")
        return context, True
    except Exception as e:
        import traceback
        error_msg = f"OpenContext failed with error: {type(e).__name__}: {e}"
        tb = traceback.format_exc()
        logger.warning(f"[OpenContext ERROR] {error_msg}")
        logger.warning(f"[OpenContext TRACEBACK]\n{tb}")
        if fallback_on_error:
            logger.warning(f"OpenContext failed, using basic detection: {e}")
            return basic_company_detection(url, reason=f"AI extraction failed: {type(e).__name__}"), False
        else:
            raise


# =============================================================================
# CLI for standalone testing
# =============================================================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python opencontext.py <company_url>")
        sys.exit(1)

    url = sys.argv[1]

    async def main():
        context, ai_called = await get_company_context(url)
        print(json.dumps(context.model_dump(), indent=2))
        print(f"\nAI called: {ai_called}")

    asyncio.run(main())
