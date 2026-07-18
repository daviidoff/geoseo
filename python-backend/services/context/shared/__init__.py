"""
Shared components for OpenContext.

- Constants: Shared configuration
- PromptLoader: Load prompts from text files

Note: GeminiClient moved to core/gemini_client.py (unified client for all services)
"""

from .constants import GEMINI_MODEL
from .prompt_loader import load_prompt, prompt_exists

# Re-export GeminiClient from core for backwards compatibility
try:
    from core.gemini_client import GeminiClient
except ImportError:
    GeminiClient = None

__all__ = [
    "GeminiClient",
    "GEMINI_MODEL",
    "load_prompt",
    "prompt_exists",
]
