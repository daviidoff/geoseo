"""
Service routers for mono-python-service.
"""

from .keywords.router import router as keywords_router
from .blog.router import router as blog_router
from .context.router import router as context_router

__all__ = [
    "keywords_router",
    "blog_router",
    "context_router",
]
