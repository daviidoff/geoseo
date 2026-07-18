"""
Unified Gemini Client for OpenAnalytics.

Provides:
- Structured output generation (JSON) with native response_schema
- Search grounding for mentions (google_search tool)
- URL context for web page analysis (url_context tool)
- OpenAI-compatible message format
- Automatic retry with exponential backoff
"""

import os
import json
import logging
import asyncio
import random
import httpx
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types
from dotenv import load_dotenv

from .constants import GEMINI_MODEL

logger = logging.getLogger(__name__)

# Retry configuration
DEFAULT_MAX_RETRIES = 3
DEFAULT_BASE_DELAY = 1.0
DEFAULT_MAX_DELAY = 30.0


class GeminiClient:
    """Gemini client using the google-genai SDK with automatic retry."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        max_retries: int = DEFAULT_MAX_RETRIES,
        base_delay: float = DEFAULT_BASE_DELAY,
        max_delay: float = DEFAULT_MAX_DELAY,
    ):
        """Initialize Gemini client.

        Args:
            api_key: Optional API key. If not provided, uses GEMINI_API_KEY env var.
            max_retries: Maximum number of retry attempts (default: 3)
            base_delay: Base delay between retries in seconds (default: 1.0)
            max_delay: Maximum delay between retries in seconds (default: 30.0)
        """
        load_dotenv('.env.local')

        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment")

        self.client = genai.Client(api_key=self.api_key)
        self.serper_api_key = os.getenv('SERPER_API_KEY')
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay

        logger.info("GeminiClient initialized with google-genai SDK (retry enabled)")

    def _is_retryable_error(self, error: Exception) -> bool:
        """Check if an error is retryable."""
        error_str = str(error).lower()
        retryable_patterns = [
            'rate limit', '429', '500', '502', '503', '504',
            'overloaded', 'timeout', 'connection', 'network',
            'unavailable', 'deadline', 'internal error'
        ]
        return any(pattern in error_str for pattern in retryable_patterns)

    async def _retry_delay(self, attempt: int) -> None:
        """Calculate and wait for retry delay with jitter."""
        delay = min(self.base_delay * (2 ** attempt), self.max_delay)
        jitter = delay * 0.1 * random.random()
        await asyncio.sleep(delay + jitter)

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        model: str = GEMINI_MODEL,
        json_output: bool = False,
        temperature: float = 0.3,
        max_tokens: int = 8192,
        use_search: bool = False,
        use_url_context: bool = False,
        extract_sources: bool = False,
    ) -> Dict[str, Any]:
        """Generate content with Gemini.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            model: Gemini model to use
            json_output: Request JSON output (uses response_mime_type)
            temperature: Generation temperature
            max_tokens: Maximum output tokens
            use_search: Enable web search grounding (google_search tool)
            use_url_context: Enable URL context tool for web page analysis
            extract_sources: Extract grounding sources from response metadata

        Returns:
            Dict with success, response, and metadata.
            If extract_sources=True, adds "_grounding_sources" key.
        """
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        # Build tools list
        tools = []
        if use_url_context:
            tools.append(types.Tool(url_context=types.UrlContext()))
        if use_search:
            tools.append(types.Tool(google_search=types.GoogleSearch()))

        # Build config
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        if json_output:
            config.response_mime_type = "application/json"
        if tools:
            config.tools = tools

        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                response = self.client.models.generate_content(
                    model=model,
                    contents=full_prompt,
                    config=config,
                )

                result = {
                    "success": True,
                    "response": response.text,
                    "model": model
                }

                # Extract grounding sources if requested
                if extract_sources and (use_search or use_url_context):
                    grounding_sources = await self._extract_grounding_sources(response)
                    if grounding_sources:
                        result["_grounding_sources"] = grounding_sources
                        logger.info(f"Extracted {len(grounding_sources)} sources from grounding")

                return result

            except Exception as e:
                last_error = e
                if self._is_retryable_error(e) and attempt < self.max_retries:
                    logger.warning(f"Gemini request failed (attempt {attempt + 1}/{self.max_retries + 1}): {e}")
                    await self._retry_delay(attempt)
                else:
                    break

        logger.error(f"Gemini generation failed after {self.max_retries + 1} attempts: {last_error}")
        return {
            "success": False,
            "error": str(last_error),
            "response": ""
        }

    async def generate_with_schema(
        self,
        prompt: str,
        response_schema: Any,
        system_prompt: str = "",
        model: str = GEMINI_MODEL,
        temperature: float = 0.3,
        max_tokens: int = 8192,
        use_search: bool = False,
        use_url_context: bool = False,
        extract_sources: bool = False,
    ) -> Dict[str, Any]:
        """Generate content with native structured output (response_schema).

        Uses Gemini's native JSON schema validation for guaranteed structure.

        Args:
            prompt: User prompt
            response_schema: types.Schema defining the output structure
            system_prompt: Optional system prompt
            model: Gemini model to use
            temperature: Generation temperature
            max_tokens: Maximum output tokens
            use_search: Enable web search grounding (google_search tool)
            use_url_context: Enable URL context tool for web page analysis
            extract_sources: Extract grounding sources from response metadata

        Returns:
            Parsed JSON dict matching the schema.
            If extract_sources=True, adds "_grounding_sources" key.
        """
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        # Build tools list
        tools = []
        if use_url_context:
            tools.append(types.Tool(url_context=types.UrlContext()))
        if use_search:
            tools.append(types.Tool(google_search=types.GoogleSearch()))

        # Build config with response_schema
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            response_mime_type="application/json",
            response_schema=response_schema,
        )
        if tools:
            config.tools = tools

        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                response = self.client.models.generate_content(
                    model=model,
                    contents=full_prompt,
                    config=config,
                )

                # Parse JSON response
                result = json.loads(response.text)

                # Extract grounding sources if requested
                if extract_sources and (use_search or use_url_context):
                    grounding_sources = await self._extract_grounding_sources(response)
                    if grounding_sources:
                        result["_grounding_sources"] = grounding_sources
                        logger.info(f"Extracted {len(grounding_sources)} sources from grounding")

                return result

            except Exception as e:
                last_error = e
                if self._is_retryable_error(e) and attempt < self.max_retries:
                    logger.warning(f"Gemini schema request failed (attempt {attempt + 1}/{self.max_retries + 1}): {e}")
                    await self._retry_delay(attempt)
                else:
                    break

        logger.error(f"Gemini generate_with_schema failed after {self.max_retries + 1} attempts: {last_error}")
        raise last_error

    async def query_with_structured_output(
        self,
        prompt: str,
        system_prompt: str = "",
        model: str = GEMINI_MODEL,
        response_format: str = "json",
        **kwargs
    ) -> Dict[str, Any]:
        """Generate structured output (JSON) from prompt.

        Alias for generate() with json_output=True for compatibility.
        """
        return await self.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            model=model,
            json_output=(response_format == "json"),
            **kwargs
        )

    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: str = GEMINI_MODEL,
        **kwargs
    ) -> Any:
        """OpenAI-compatible completion interface.

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model to use

        Returns:
            OpenAI-compatible response object
        """
        try:
            prompt = self._convert_messages_to_prompt(messages)

            response = self.client.models.generate_content(
                model=model,
                contents=prompt
            )

            class MockChoice:
                def __init__(self, content):
                    self.message = MockMessage(content)

            class MockMessage:
                def __init__(self, content):
                    self.content = content

            class MockResponse:
                def __init__(self, content):
                    self.choices = [MockChoice(content)]

            return MockResponse(response.text)

        except Exception as e:
            logger.error(f"Gemini completion error: {e}")
            raise

    async def query_mentions_with_search_grounding(
        self,
        query: str,
        company_name: str
    ) -> Dict[str, Any]:
        """Query for company mentions with search grounding.

        Main method for AEO mentions check.
        """
        try:
            prompt = f"""I need information about "{query}".

Please search the web and provide information about the best companies, tools, or platforms related to this query. Focus on:
1. Which companies or platforms are mentioned as top options
2. What specific features and services they offer
3. Any rankings, reviews, or recommendations
4. Market leaders and popular choices

Please include specific company names and details about their capabilities."""

            response = await self._generate_with_search(prompt)

            return {
                "success": True,
                "response": response.text,
                "model": GEMINI_MODEL,
                "search_grounding": True
            }

        except Exception as e:
            logger.error(f"Gemini mentions query error: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": "",
                "search_grounding": False
            }

    async def _generate_with_search(
        self,
        prompt: str,
        model: str = GEMINI_MODEL
    ):
        """Generate with native google_search grounding tool."""
        try:
            # Use native google_search tool
            config = types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
            )

            return self.client.models.generate_content(
                model=model,
                contents=prompt,
                config=config,
            )
        except Exception as e:
            logger.warning(f"Search generation failed: {e}, falling back to Serper")
            # Fallback to Serper if google_search fails
            if self.serper_api_key:
                return await self._generate_with_serper(prompt, model)
            else:
                logger.warning("No Serper API key, using regular Gemini")
                return self.client.models.generate_content(
                    model=model,
                    contents=prompt
                )

    async def _extract_grounding_sources(self, response) -> List[Dict[str, str]]:
        """
        Extract real URLs from Gemini grounding metadata.

        Follows redirect URLs to get actual source URLs.
        Validates each URL returns HTTP 200-299 before including.

        Args:
            response: Gemini API response object

        Returns:
            List of dicts with 'url' and 'title' keys (only validated URLs)
        """
        try:
            if not hasattr(response, 'candidates') or not response.candidates:
                logger.debug("No candidates in response")
                return []

            candidate = response.candidates[0]
            if not hasattr(candidate, 'grounding_metadata') or not candidate.grounding_metadata:
                logger.debug("No grounding_metadata in candidate")
                return []

            gm = candidate.grounding_metadata
            if not hasattr(gm, 'grounding_chunks') or not gm.grounding_chunks:
                logger.debug("No grounding_chunks in metadata")
                return []

            total_chunks = len(gm.grounding_chunks)
            logger.debug(f"Found {total_chunks} grounding chunks")

            sources = []
            seen_urls = set()
            skipped_invalid = 0

            async with httpx.AsyncClient(
                timeout=10.0,
                follow_redirects=True,
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)
            ) as client:
                for chunk in gm.grounding_chunks[:10]:  # Check up to 10 to get 5 valid
                    if not hasattr(chunk, 'web') or not chunk.web or not chunk.web.uri:
                        continue

                    redirect_url = chunk.web.uri
                    title = chunk.web.title if hasattr(chunk.web, 'title') and chunk.web.title else ""

                    # Follow redirect to get real URL and validate status
                    try:
                        resp = await client.get(redirect_url)
                        real_url = str(resp.url)

                        # Only include URLs that return 200-299 (success)
                        if resp.status_code < 200 or resp.status_code >= 300:
                            logger.debug(f"Skipping source (HTTP {resp.status_code}): {real_url[:60]}...")
                            skipped_invalid += 1
                            continue

                    except Exception as e:
                        logger.debug(f"Skipping source (request failed): {redirect_url[:60]}... - {e}")
                        skipped_invalid += 1
                        continue

                    # Skip duplicates and Vertex redirect URLs
                    if real_url in seen_urls:
                        continue
                    if 'vertexaisearch.cloud.google.com' in real_url:
                        continue

                    seen_urls.add(real_url)
                    sources.append({
                        "url": real_url,
                        "title": title or self._extract_domain(real_url),
                    })

                    # Stop after 5 valid sources
                    if len(sources) >= 5:
                        break

            if skipped_invalid > 0:
                logger.info(f"Grounding sources: {len(sources)} valid, {skipped_invalid} skipped")

            return sources

        except Exception as e:
            logger.warning(f"Failed to extract grounding sources: {e}")
            return []

    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL for fallback title."""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc.replace('www.', '')
        except Exception:
            return "Source"

    async def _generate_with_serper(self, prompt: str, model: str = GEMINI_MODEL):
        """Generate with Serper search fallback."""
        try:
            search_query = self._extract_search_terms(prompt)
            search_results = await self._serper_search(search_query)

            enhanced_prompt = f"{prompt}\n\nBased on these search results:\n{search_results}"

            return self.client.models.generate_content(
                model=model,
                contents=enhanced_prompt
            )

        except Exception as e:
            logger.warning(f"Serper fallback failed: {e}")
            return self.client.models.generate_content(
                model=model,
                contents=prompt
            )

    async def _serper_search(self, query: str) -> str:
        """Search using Serper API."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://google.serper.dev/search",
                    headers={
                        "X-API-KEY": self.serper_api_key,
                        "Content-Type": "application/json"
                    },
                    json={"q": query, "num": 5}
                )

                if response.status_code == 200:
                    data = response.json()
                    results = []
                    for item in data.get("organic", []):
                        results.append(f"- {item.get('title', '')}: {item.get('snippet', '')}")
                    return "\n".join(results)
                else:
                    logger.error(f"Serper API error: {response.status_code}")
                    return ""
        except Exception as e:
            logger.error(f"Serper search error: {e}")
            return ""

    def _convert_messages_to_prompt(self, messages: List[Dict[str, str]]) -> str:
        """Convert OpenAI-style messages to single prompt."""
        parts = []
        for message in messages:
            role = message.get("role", "user")
            content = message.get("content", "")

            if role == "system":
                parts.append(f"System: {content}")
            elif role == "user":
                parts.append(f"User: {content}")
            elif role == "assistant":
                parts.append(f"Assistant: {content}")

        return "\n\n".join(parts)

    def _needs_web_search(self, prompt: str) -> bool:
        """Determine if prompt needs web search."""
        search_indicators = [
            "search the web", "find information", "latest", "current",
            "best companies", "top companies", "alternatives to",
            "information about", "details about", "companies that",
            "tools for", "platforms for", "services for"
        ]

        prompt_lower = prompt.lower()
        return any(indicator in prompt_lower for indicator in search_indicators)

    def _extract_search_terms(self, prompt: str) -> str:
        """Extract relevant search terms from prompt."""
        import re

        quoted = re.findall(r'"([^"]*)"', prompt)
        if quoted:
            return quoted[0]

        info_match = re.search(r'information about (.+?)[\.\?]', prompt, re.IGNORECASE)
        if info_match:
            return info_match.group(1).strip()

        best_match = re.search(r'(?:best|top) (.+?) (?:for|in)', prompt, re.IGNORECASE)
        if best_match:
            return best_match.group(1).strip()

        sentences = prompt.split('.')
        if sentences:
            return sentences[0][:100]

        return prompt[:100]


# Singleton instance
_gemini_client = None


def get_gemini_client() -> GeminiClient:
    """Get singleton Gemini client instance."""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client
