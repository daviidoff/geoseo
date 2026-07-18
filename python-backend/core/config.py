"""
Unified configuration for mono-python-service.
"""

import os
from enum import Enum
from typing import Dict, Any

# Load .env file if it exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed, rely on system environment variables


class ServiceType(str, Enum):
    """Service type enumeration."""
    KEYWORDS = "keywords"
    BLOG = "blog"
    CONTEXT = "context"
    MENTIONS = "mentions"
    HEALTH = "health"


class GeminiConfig:
    """Centralized Gemini configuration."""

    # Model per service (can be overridden via env)
    # Context defaults to a stable, low-cost model that supports URL Context.
    # Other services keep their existing model until they are migrated separately.
    MODEL_MAP: Dict[ServiceType, str] = {
        ServiceType.KEYWORDS: os.getenv("GEMINI_MODEL_KEYWORDS", "gemini-3-flash-preview"),
        ServiceType.BLOG: os.getenv("GEMINI_MODEL_BLOG", "gemini-3-flash-preview"),
        ServiceType.CONTEXT: os.getenv("GEMINI_MODEL_CONTEXT", "gemini-3.1-flash-lite"),
        ServiceType.MENTIONS: os.getenv("GEMINI_MODEL_MENTIONS", "gemini-3-flash-preview"),
    }

    # Timeout per service (seconds)
    TIMEOUT_MAP: Dict[ServiceType, int] = {
        ServiceType.KEYWORDS: int(os.getenv("GEMINI_TIMEOUT_KEYWORDS", "180")),
        ServiceType.BLOG: int(os.getenv("GEMINI_TIMEOUT_BLOG", "300")),
        ServiceType.CONTEXT: int(os.getenv("GEMINI_TIMEOUT_CONTEXT", "120")),
        ServiceType.MENTIONS: int(os.getenv("GEMINI_TIMEOUT_MENTIONS", "120")),
    }

    # Grounding timeout (when using URL Context / Google Search)
    TIMEOUT_GROUNDING = int(os.getenv("GEMINI_TIMEOUT_GROUNDING", "300"))
    TIMEOUT_DEFAULT = int(os.getenv("GEMINI_TIMEOUT_DEFAULT", "120"))
    # Voice enhancement timeout (fetches multiple blog URLs + deep analysis)
    TIMEOUT_VOICE_ENHANCEMENT = int(os.getenv("GEMINI_TIMEOUT_VOICE_ENHANCEMENT", "420"))

    # Retry configuration
    MAX_RETRIES = int(os.getenv("GEMINI_MAX_RETRIES", "4"))
    BASE_DELAY = float(os.getenv("GEMINI_BASE_DELAY", "1.0"))
    MAX_DELAY = float(os.getenv("GEMINI_MAX_DELAY", "30.0"))

    @classmethod
    def get_model(cls, service_type: ServiceType) -> str:
        """Get model for service type."""
        return cls.MODEL_MAP.get(service_type, "gemini-3-flash-preview")

    @classmethod
    def get_timeout(cls, service_type: ServiceType) -> int:
        """Get timeout for service type."""
        return cls.TIMEOUT_MAP.get(service_type, 120)


# API Configuration
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# CORS Configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:3005").split(",")

# Job Store Configuration
MAX_JOBS = int(os.getenv("MAX_JOBS", "1000"))
JOB_TTL_HOURS = int(os.getenv("JOB_TTL_HOURS", "24"))
