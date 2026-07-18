"""
Gemini Client using the new google-genai SDK with Search Grounding.

v2.0: Added native Google Search grounding for real-time AI visibility testing.
This allows the Mentions Check to test actual live search results, not just training data.
"""
import os
import json
import logging
import httpx
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

class GeminiClient:
    """Gemini client using the new google-genai SDK."""

    def __init__(self):
        # Load environment variables
        load_dotenv('.env.local')

        # Get API key
        self.api_key = os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment")

        # Initialize client with new SDK
        self.client = genai.Client(api_key=self.api_key)

        # Serper dev API fallback
        self.serper_api_key = os.getenv('SERPER_API_KEY')

        logger.info(f"GeminiClient initialized with new google-genai SDK")

    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Any = "auto",
        **kwargs
    ) -> Any:
        """Simple completion using new Gemini SDK."""
        try:
            # Convert messages to prompt
            prompt = self._convert_messages_to_prompt(messages)

            # Generate content with new API
            response = self.client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt
            )

            # Return OpenAI-compatible format
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

    async def complete_with_tools(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        tools: Optional[List[str]] = None,
        max_iterations: int = 5,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate completion with tool integration."""
        try:
            # Convert messages to prompt
            prompt = self._convert_messages_to_prompt(messages)

            # Use search-enabled completion for web search queries
            if self._needs_web_search(prompt):
                response = await self._complete_with_search(prompt)
            else:
                response = self.client.models.generate_content(
                    model="gemini-3-flash-preview",
                    contents=prompt
                )

            # Return result in expected format
            return {
                "choices": [{
                    "message": {
                        "content": response.text,
                        "role": "assistant"
                    }
                }],
                "model": "gemini-3-flash-preview",
                "usage": {
                    "total_tokens": len(response.text.split())
                }
            }

        except Exception as e:
            logger.error(f"Gemini tools completion error: {e}")
            return {
                "choices": [{
                    "message": {
                        "content": f"Error: {str(e)}",
                        "role": "assistant"
                    }
                }],
                "error": str(e)
            }

    async def query_with_structured_output(
        self,
        prompt: str,
        system_prompt: str = "",
        model: str = "gemini-3-flash-preview",
        response_format: str = "json",
        **kwargs
    ) -> Dict[str, Any]:
        """Generate structured output (JSON) from prompt."""
        try:
            # Combine system and user prompts
            full_prompt = prompt
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{prompt}"

            # Add JSON formatting instruction
            if response_format == "json":
                full_prompt += "\n\nReturn your response as valid JSON."

            # Generate content with new API
            response = self.client.models.generate_content(
                model=model,
                contents=full_prompt
            )

            return {
                "success": True,
                "response": response.text,
                "model": model
            }

        except Exception as e:
            logger.error(f"Gemini structured output error: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": ""
            }

    async def _complete_with_search(self, prompt: str):
        """Complete prompt with web search (Serper fallback for now)."""
        try:
            # For now, use Serper search fallback
            return await self._complete_with_serper_fallback(prompt)
        except Exception as e:
            logger.warning(f"Search failed: {e}, using regular Gemini")
            response = self.client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt
            )
            return response

    async def _complete_with_serper_fallback(self, prompt: str):
        """Fallback to Serper dev API for search."""
        if not self.serper_api_key:
            logger.warning("No Serper API key, using regular Gemini")
            response = self.client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt
            )
            return response

        try:
            # Extract search terms from prompt
            search_query = self._extract_search_terms(prompt)

            # Search with Serper
            search_results = await self._serper_search(search_query)

            # Enhance prompt with search results
            enhanced_prompt = f"{prompt}\n\nBased on these search results:\n{search_results}"

            # Generate response with enhanced context
            response = self.client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=enhanced_prompt
            )
            return response

        except Exception as e:
            logger.warning(f"Serper fallback failed: {e}, using regular Gemini")
            response = self.client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt
            )
            return response

    async def _serper_search(self, query: str) -> str:
        """Search using Serper dev API."""
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

                    # Format search results
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
        # Simple extraction - look for quoted terms or key phrases
        import re

        # Look for quoted terms
        quoted = re.findall(r'"([^"]*)"', prompt)
        if quoted:
            return quoted[0]

        # Look for "information about X"
        info_match = re.search(r'information about (.+?)[\.\?]', prompt, re.IGNORECASE)
        if info_match:
            return info_match.group(1).strip()

        # Look for "best X" or "top X"
        best_match = re.search(r'(?:best|top) (.+?) (?:for|in)', prompt, re.IGNORECASE)
        if best_match:
            return best_match.group(1).strip()

        # Fallback: use first meaningful sentence
        sentences = prompt.split('.')
        if sentences:
            return sentences[0][:100]  # Limit length

        return prompt[:100]  # Fallback

    async def query_with_search_grounding(self, query: str) -> Dict[str, Any]:
        """Query Gemini with real-time Google Search grounding.

        This is the key method for accurate AEO visibility testing.
        Instead of relying on training data, it uses live Google Search
        to ground the response in real-time web results.

        Returns:
            Dict with response text, grounding sources, and metadata
        """
        try:
            # Configure Google Search grounding tool
            grounding_tool = types.Tool(
                google_search=types.GoogleSearch()
            )

            config = types.GenerateContentConfig(
                tools=[grounding_tool]
            )

            # Generate content with search grounding
            response = self.client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=query,
                config=config,
            )

            # Extract grounding metadata (sources, citations)
            grounding_sources = []
            grounding_chunks = []

            if response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    metadata = candidate.grounding_metadata

                    # Extract grounding chunks (actual sources)
                    if hasattr(metadata, 'grounding_chunks') and metadata.grounding_chunks:
                        for chunk in metadata.grounding_chunks:
                            if hasattr(chunk, 'web') and chunk.web:
                                grounding_sources.append({
                                    'uri': chunk.web.uri if hasattr(chunk.web, 'uri') else '',
                                    'title': chunk.web.title if hasattr(chunk.web, 'title') else ''
                                })

                    # Extract search queries used
                    if hasattr(metadata, 'search_entry_point') and metadata.search_entry_point:
                        grounding_chunks.append(str(metadata.search_entry_point))

            return {
                "success": True,
                "response": response.text,
                "model": "gemini-3-flash-preview",
                "search_grounding": True,
                "grounding_sources": grounding_sources,
                "source_count": len(grounding_sources)
            }

        except Exception as e:
            logger.error(f"Search grounding query error: {e}")
            # Fallback to non-grounded query
            return await self._fallback_query(query)

    async def _fallback_query(self, query: str) -> Dict[str, Any]:
        """Fallback to standard query without search grounding."""
        try:
            response = self.client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=query
            )
            return {
                "success": True,
                "response": response.text,
                "model": "gemini-3-flash-preview",
                "search_grounding": False,
                "grounding_sources": [],
                "source_count": 0
            }
        except Exception as e:
            logger.error(f"Fallback query error: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": "",
                "search_grounding": False
            }

    async def query_mentions_with_search_grounding(self, query: str, company_name: str) -> Dict[str, Any]:
        """Query for company mentions with search grounding - main method for AEO mentions check.

        DEPRECATED: Use query_with_search_grounding instead.
        """
        return await self.query_with_search_grounding(query)


# Singleton instance
_gemini_client = None

def get_gemini_client() -> GeminiClient:
    """Get singleton Gemini client instance."""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client
