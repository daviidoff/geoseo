"""
Shared constants for OpenContext.
"""

import os

# Gemini model with Google Search + structured output support
# Using gemini-3-flash-preview for best response_schema support
# Can be overridden via GEMINI_MODEL environment variable
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
