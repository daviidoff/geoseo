"""
Unified Gemini Client for all services.

Features:
- URL Context (fetch and analyze web pages)
- Google Search (grounded search results)
- Structured JSON output
- Automatic retry with exponential backoff
- Service-type aware configuration
"""

import asyncio
import json
import logging
import os
import random
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import httpx
from dotenv import load_dotenv

from .config import GeminiConfig, ServiceType

# Load .env from root
load_dotenv(Path(__file__).parent.parent / ".env", override=True)

logger = logging.getLogger(__name__)


class GeminiClient:
    """
    Unified Gemini client with URL Context + Google Search + JSON output.

    Usage:
        client = GeminiClient(ServiceType.BLOG)

        # With grounding (URL Context + Google Search)
        result = await client.generate(
            prompt="Analyze https://example.com",
            use_url_context=True,
            use_google_search=True,
            json_output=True,
        )

        # Without grounding (faster)
        result = await client.generate(
            prompt="Fix this JSON...",
            use_url_context=False,
            use_google_search=False,
            json_output=True,
        )
    """

    def __init__(
        self,
        service_type: ServiceType = ServiceType.CONTEXT,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_retries: Optional[int] = None,
        base_delay: Optional[float] = None,
        max_delay: Optional[float] = None,
    ):
        """
        Initialize Gemini client.

        Args:
            service_type: Service type for default config
            api_key: Gemini API key. Falls back to GEMINI_API_KEY env var.
            model: Override model (uses service-type default if None)
            max_retries: Override max retries
            base_delay: Override base delay
            max_delay: Override max delay
        """
        self.service_type = service_type
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

        if not self.api_key:
            raise ValueError(
                "No Gemini API key provided. Set GEMINI_API_KEY environment variable "
                "or pass api_key parameter."
            )

        self.model = model or GeminiConfig.get_model(service_type)
        self.default_timeout = GeminiConfig.get_timeout(service_type)
        self.max_retries = max_retries if max_retries is not None else GeminiConfig.MAX_RETRIES
        self.base_delay = base_delay if base_delay is not None else GeminiConfig.BASE_DELAY
        self.max_delay = max_delay if max_delay is not None else GeminiConfig.MAX_DELAY

        self._client = None
        self._types = None
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy initialization of google-genai client."""
        if self._initialized:
            return

        try:
            from google import genai
            from google.genai import types

            self._genai = genai
            self._types = types
            self._client = genai.Client(api_key=self.api_key)
            self._initialized = True
            logger.debug(f"GeminiClient initialized: model={self.model}, service={self.service_type.value}")
        except ImportError:
            raise ImportError("google-genai not installed. Run: pip install google-genai")

    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        use_url_context: bool = False,
        use_google_search: bool = False,
        json_output: bool = True,
        extract_sources: bool = False,
        temperature: float = 0.3,
        max_tokens: int = 8192,
        timeout: Optional[int] = None,
    ) -> Union[Dict[str, Any], str]:
        """
        Generate content using Gemini.

        Args:
            prompt: The prompt to send
            system_instruction: Optional system instruction
            use_url_context: Enable URL Context tool for fetching web pages
            use_google_search: Enable Google Search tool for grounding
            json_output: Request structured JSON output
            extract_sources: Extract real URLs from grounding metadata
            temperature: Generation temperature (0-1)
            max_tokens: Maximum output tokens
            timeout: Request timeout in seconds

        Returns:
            Dict if json_output=True, otherwise raw string.
        """
        self._ensure_initialized()

        # Build tools list
        tools = []
        if use_url_context:
            tools.append(self._types.Tool(url_context=self._types.UrlContext()))
        if use_google_search:
            tools.append(self._types.Tool(google_search=self._types.GoogleSearch()))

        # Auto-select timeout
        if timeout is None:
            timeout = GeminiConfig.TIMEOUT_GROUNDING if tools else self.default_timeout

        # Build config
        config = self._types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
            max_output_tokens=max_tokens,
            tools=tools if tools else None,
            response_mime_type="application/json" if json_output else None,
        )

        logger.debug(f"Generating: model={self.model}, tools={len(tools)}, json={json_output}")

        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        self._client.models.generate_content,
                        model=self.model,
                        contents=prompt,
                        config=config,
                    ),
                    timeout=timeout,
                )

                # Handle empty response from Gemini API
                if response.text is None or response.text.strip() == '':
                    raise ValueError("Gemini API returned empty response - temporarily unavailable")

                text = response.text.strip()

                if json_output:
                    result = self._parse_json(text)

                    # Extract sources from grounding metadata
                    if extract_sources and use_google_search:
                        grounding_sources = await self._extract_grounding_sources(response)
                        if grounding_sources:
                            result["_grounding_sources"] = grounding_sources

                    return result
                else:
                    return text

            except asyncio.TimeoutError:
                last_error = asyncio.TimeoutError(f"Request timed out after {timeout}s")
                logger.warning(f"Timeout (attempt {attempt + 1}/{self.max_retries + 1})")
            except Exception as e:
                last_error = e
                error_str = str(e).lower()
                is_retryable = any(x in error_str for x in [
                    'rate limit', '429', '500', '502', '503', '504',
                    'overloaded', 'quota', 'temporarily unavailable',
                    'connection', 'timeout', 'resource exhausted'
                ])

                # Also retry JSON decode errors - Gemini sometimes returns malformed JSON
                is_json_error = isinstance(e, (json.JSONDecodeError, ValueError)) and 'json' in error_str

                if not (is_retryable or is_json_error) or attempt >= self.max_retries:
                    logger.error(f"Gemini generation failed: {e}")
                    raise

                logger.warning(f"Retryable error (attempt {attempt + 1}/{self.max_retries + 1}): {e}")

            # Exponential backoff with jitter
            if attempt < self.max_retries:
                delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                jitter = random.uniform(0, delay * 0.1)
                await asyncio.sleep(delay + jitter)

        raise last_error

    def _parse_json(self, text: str) -> Dict[str, Any]:
        """Parse JSON from Gemini response, handling markdown code blocks."""
        # Extract JSON from markdown if present
        if "```json" in text:
            parts = text.split("```json")
            if len(parts) > 1:
                text = parts[1].split("```")[0].strip()
        elif "```" in text:
            parts = text.split("```")
            if len(parts) > 1:
                text = parts[1].split("```")[0].strip()

        # Find JSON object start
        if not text.startswith("{") and not text.startswith("["):
            match = re.search(r'[\{\[]', text)
            if match:
                text = text[match.start():]
            else:
                raise ValueError(f"Could not find JSON in response: {text[:200]}")

        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try repair before balanced extraction
            try:
                repaired = self._repair_json(text)
                return json.loads(repaired)
            except json.JSONDecodeError:
                pass

        # Fallback: Extract balanced JSON object
        brace_count = 0
        end_idx = 0
        in_string = False
        escape_next = False
        start_char = text[0]
        end_char = "}" if start_char == "{" else "]"

        for i, char in enumerate(text):
            if escape_next:
                escape_next = False
                continue
            if char == '\\' and in_string:
                escape_next = True
                continue
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
            if in_string:
                continue

            if char == start_char:
                brace_count += 1
            elif char == end_char:
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i + 1
                    break

        if end_idx > 0:
            text = text[:end_idx]

        # Apply repair to balanced extracted text before final parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            repaired = self._repair_json(text)
            return json.loads(repaired)

    def _repair_json(self, text: str) -> str:
        """Attempt to repair common JSON issues from Gemini responses."""
        # Fix unquoted property names (JavaScript-style): { foo: "bar" } -> { "foo": "bar" }
        # Use re.DOTALL to handle newlines between { or , and the property name
        text = re.sub(r'([{,])(\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*):', r'\1\2"\3"\4:', text, flags=re.DOTALL)
        
        # Remove trailing commas before ] or }
        text = re.sub(r',\s*([}\]])', r'\1', text)
        
        # Add missing commas between array elements or object properties
        text = re.sub(r'([}\]"])\s*\n\s*"', r'\1,\n"', text)
        text = re.sub(r'([}\]])\s*\n\s*\{', r'\1,\n{', text)
        text = re.sub(r'([}\]])\s*\n\s*\[', r'\1,\n[', text)
        
        # Fix missing commas between string values (with or without newlines)
        text = re.sub(r'"\s*\n\s*"', '",\n"', text)
        text = re.sub(r'"\s+"', '", "', text)  # Missing comma between strings on same line
        
        # Fix missing comma after closing bracket/brace followed by quote
        text = re.sub(r'([\]})]\s*)"', r'\1,"', text)
        
        # Fix missing comma between values in arrays: ["a""b"] -> ["a","b"]
        text = re.sub(r'""', '","', text)
        
        # Fix missing comma after boolean/null/number followed by quote
        text = re.sub(r'(true|false|null)(\s*)"', r'\1,\2"', text)
        text = re.sub(r'(\d)(\s*)"', r'\1,\2"', text)
        
        # Fix single quotes to double quotes (outside of strings)
        # This is tricky, so we do a simple replacement for obvious cases
        text = re.sub(r"'([^']*)'(\s*[,}\]])", r'"\1"\2', text)
        
        # Remove control characters that break JSON (except newlines/tabs which we handle)
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
        
        # Fix common escaping issues - be more careful here
        # Only fix double-escaped quotes, not legitimate ones
        text = re.sub(r'\\\\(["\\/])', r'\\\1', text)
        
        # Ensure proper string escaping for newlines in values
        # Replace literal newlines inside strings with \n
        def fix_string_newlines(match):
            content = match.group(1)
            content = content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
            return f'"{content}"'
        
        text = re.sub(r'"([^"]*(?:\n|\r)[^"]*)"', fix_string_newlines, text)
        
        return text

    async def _extract_grounding_sources(self, response) -> List[Dict[str, str]]:
        """Extract real URLs from Gemini grounding metadata."""
        try:
            if not hasattr(response, 'candidates') or not response.candidates:
                return []

            candidate = response.candidates[0]
            if not hasattr(candidate, 'grounding_metadata') or not candidate.grounding_metadata:
                return []

            gm = candidate.grounding_metadata
            if not hasattr(gm, 'grounding_chunks') or not gm.grounding_chunks:
                return []

            sources = []
            seen_urls = set()

            async with httpx.AsyncClient(
                timeout=10.0,
                follow_redirects=True,
                limits=httpx.Limits(max_connections=10)
            ) as client:
                for chunk in gm.grounding_chunks[:10]:
                    if not hasattr(chunk, 'web') or not chunk.web or not chunk.web.uri:
                        continue

                    redirect_url = chunk.web.uri
                    title = chunk.web.title if hasattr(chunk.web, 'title') else ""

                    try:
                        resp = await client.get(redirect_url)
                        real_url = str(resp.url)

                        if resp.status_code < 200 or resp.status_code >= 300:
                            continue

                    except Exception:
                        continue

                    if real_url in seen_urls or 'vertexaisearch' in real_url:
                        continue

                    seen_urls.add(real_url)
                    sources.append({
                        "url": real_url,
                        "title": title or self._extract_domain(real_url),
                    })

                    if len(sources) >= 5:
                        break

            return sources

        except Exception as e:
            logger.warning(f"Failed to extract grounding sources: {e}")
            return []

    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL for fallback title."""
        try:
            from urllib.parse import urlparse
            return urlparse(url).netloc.replace('www.', '')
        except Exception:
            return "Source"

    async def generate_with_schema(
        self,
        prompt: str,
        response_schema: Any,
        use_url_context: bool = False,
        use_google_search: bool = False,
        extract_sources: bool = False,
        temperature: float = 0.3,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Generate content with a specific response schema."""
        self._ensure_initialized()

        tools = []
        if use_url_context:
            tools.append(self._types.Tool(url_context=self._types.UrlContext()))
        if use_google_search:
            tools.append(self._types.Tool(google_search=self._types.GoogleSearch()))

        if timeout is None:
            timeout = GeminiConfig.TIMEOUT_GROUNDING if tools else self.default_timeout

        config = self._types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=8192,
            tools=tools if tools else None,
            response_mime_type="application/json",
            response_schema=response_schema,
        )

        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        self._client.models.generate_content,
                        model=self.model,
                        contents=prompt,
                        config=config,
                    ),
                    timeout=timeout,
                )

                # Handle empty response from Gemini API
                if response.text is None or response.text.strip() == '':
                    raise ValueError("Gemini API returned empty response - temporarily unavailable")

                # The SDK already parses schema-constrained responses. Prefer that
                # representation so valid structured output is not damaged by the
                # legacy best-effort text repair logic.
                parsed = getattr(response, "parsed", None)
                if isinstance(parsed, dict):
                    result = parsed
                elif parsed is not None and hasattr(parsed, "model_dump"):
                    result = parsed.model_dump()
                else:
                    result = self._parse_json(response.text.strip())

                if extract_sources and use_google_search:
                    grounding_sources = await self._extract_grounding_sources(response)
                    if grounding_sources:
                        result["_grounding_sources"] = grounding_sources

                return result

            except asyncio.TimeoutError:
                last_error = asyncio.TimeoutError(f"Request timed out after {timeout}s")
                logger.warning(f"Schema timeout (attempt {attempt + 1}/{self.max_retries + 1})")
            except Exception as e:
                last_error = e
                error_str = str(e).lower()
                is_retryable = any(x in error_str for x in [
                    'rate limit', '429', '500', '502', '503', '504',
                    'overloaded', 'quota', 'temporarily unavailable',
                    'connection', 'timeout', 'resource exhausted'
                ])

                # Also retry JSON decode errors - Gemini sometimes returns malformed JSON
                is_json_error = isinstance(e, (json.JSONDecodeError, ValueError)) and 'json' in error_str

                if not (is_retryable or is_json_error) or attempt >= self.max_retries:
                    raise
                
                logger.warning(f"Schema retryable error (attempt {attempt + 1}/{self.max_retries + 1}): {e}")

            if attempt < self.max_retries:
                delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                jitter = random.uniform(0, delay * 0.1)
                await asyncio.sleep(delay + jitter)

        raise last_error

    def __repr__(self) -> str:
        return f"GeminiClient(service={self.service_type.value}, model={self.model})"
