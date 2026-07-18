"""
Mono Python Service - Unified FastAPI Application

Combines all AI services into a single backend:
- /api/v1/keywords - Keyword generation
- /api/v1/blog - Blog generation
- /api/v1/context - Company context extraction

Usage:
    uvicorn api:app --reload --port 8000

API Docs:
    - Swagger UI: http://localhost:8000/docs
    - ReDoc: http://localhost:8000/redoc
"""

import sys
import io
from pathlib import Path

# Load environment variables before anything else
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env", override=True)
except ImportError:
    pass  # dotenv not installed

# Fix Windows console encoding for emoji/unicode characters
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from core.config import CORS_ORIGINS, API_HOST, API_PORT
from core.job_store import job_store
from services.keywords.router import router as keywords_router
from services.blog.router import router as blog_router
from services.context.router import router as context_router
from services.mentions.router import router as mentions_router
from services.health.router import router as health_router

# Configure logging - force=True ensures this overrides any existing config
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    force=True,
)
# Also ensure child loggers inherit the level
logging.getLogger("services").setLevel(logging.INFO)
logging.getLogger("core").setLevel(logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    # Startup
    logger.info("Mono Python Service starting up...")
    logger.info(f"CORS origins: {CORS_ORIGINS}")
    yield
    # Shutdown
    logger.info("Mono Python Service shutting down...")


# Create FastAPI app
app = FastAPI(
    lifespan=lifespan,
    title="Mono Python Service",
    description="""
Unified AI backend service combining:
- **Keywords**: AI-powered SEO keyword generation (6-stage pipeline with SERP analysis)
- **Blog**: AI-powered blog article generation (7-stage pipeline with cleanup & similarity)
- **Context**: Company context extraction from URLs
- **Mentions**: Multi-platform AI visibility check (Gemini, Claude, ChatGPT, Perplexity)
- **Health Check**: AEO website health scoring (29 checks across 4 categories)

All services use a unified core Gemini client with:
- URL Context (web page analysis)
- Google Search grounding
- Automatic retry with exponential backoff
""",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


# Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/health", tags=["Health"])
async def health():
    """Global health check."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "services": ["keywords", "blog", "context", "mentions", "health-check"],
    }


# Job stats
@app.get("/stats", tags=["Health"])
async def stats():
    """Get job store statistics."""
    return job_store.stats()


# Include service routers
app.include_router(keywords_router, prefix="/api/v1")
app.include_router(blog_router, prefix="/api/v1")
app.include_router(context_router, prefix="/api/v1")
app.include_router(mentions_router, prefix="/api/v1")
app.include_router(health_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=API_HOST, port=API_PORT)
