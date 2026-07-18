"""
Blog service router.
"""

import uuid
import asyncio
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Dict, Any, List

from core.job_store import job_store, JobStatus
from core.config import ServiceType
from .models import BlogRequest


class RefreshRequest(BaseModel):
    """Request model for content refresh."""
    article: Dict[str, Any] = Field(..., description="Article content to refresh")
    keyword: str = Field(..., description="Original keyword for the article")

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/blog", tags=["Blog"])


@router.get("/health")
async def health():
    """Health check for blog service."""
    return {
        "service": "blog",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/jobs")
async def create_job(
    request: BlogRequest,
    background_tasks: BackgroundTasks,
):
    """
    Create a blog generation job (async).

    Returns immediately with job_id, processes in background.
    """
    job_id = str(uuid.uuid4())

    job = job_store.create(
        job_id=job_id,
        service_type=ServiceType.BLOG,
        request=request.model_dump(mode="json"),
    )

    background_tasks.add_task(run_blog_pipeline, job_id, request)

    return {
        "job_id": job_id,
        "status": "pending",
        "message": f"Blog generation job created for {len(request.keywords)} keywords",
        "created_at": job["created_at"],
    }


@router.get("/jobs")
async def list_jobs(
    limit: int = Query(default=50, ge=1, le=100),
    status: Optional[str] = None,
):
    """List blog generation jobs."""
    status_filter = JobStatus(status) if status else None
    jobs = job_store.list_all(
        service_type=ServiceType.BLOG,
        status=status_filter,
        limit=limit,
    )
    return {"jobs": jobs, "count": len(jobs)}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get job status and results."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["service_type"] != ServiceType.BLOG.value:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.get("/jobs/{job_id}/articles")
async def get_articles(job_id: str):
    """Get article previews for a job."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["service_type"] != ServiceType.BLOG.value:
        raise HTTPException(status_code=404, detail="Job not found")

    result = job.get("result", {})
    articles = result.get("articles", [])

    return {
        "job_id": job_id,
        "articles": articles,
        "count": len(articles),
    }


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["service_type"] != ServiceType.BLOG.value:
        raise HTTPException(status_code=404, detail="Job not found")

    job_store.delete(job_id)
    return {"message": "Job deleted", "job_id": job_id}


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a running or pending job."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["service_type"] != ServiceType.BLOG.value:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if job can be cancelled
    if job["status"] not in ["pending", "running"]:
        return {
            "message": f"Job cannot be cancelled (status: {job['status']})",
            "job_id": job_id,
            "status": job["status"],
            "cancelled": False,
        }

    cancelled_job = job_store.cancel(job_id)
    
    return {
        "message": "Job cancelled",
        "job_id": job_id,
        "status": cancelled_job["status"] if cancelled_job else "unknown",
        "cancelled": True,
    }


async def run_blog_pipeline(job_id: str, request: BlogRequest):
    """
    Run the blog generation pipeline.

    Uses the actual 5-stage openblog pipeline.
    """
    try:
        job_store.update(job_id, status=JobStatus.RUNNING)
        logger.info(f"[Blog] Running pipeline for {len(request.keywords)} keywords")

        # Import and run actual pipeline
        from .pipeline import run_pipeline

        # Build keyword configs dict for per-keyword settings
        keyword_configs = {}
        if request.keyword_configs:
            for kc in request.keyword_configs:
                keyword_configs[kc.keyword] = {
                    "word_count": kc.word_count,
                    "instructions": kc.instructions,
                }

        result = await run_pipeline(
            keywords=request.keywords,
            company_url=str(request.company_url),
            language=request.language or "en",
            market=request.market or "US",
            skip_images=request.skip_images or False,
            max_parallel=request.max_parallel,
            word_count=request.word_count,
            tone=request.tone,
            custom_instructions=request.custom_instructions,
            keyword_configs=keyword_configs,
            job_id=job_id,
            company_context=request.company_context.model_dump() if request.company_context else None,
        )

        job_store.update(
            job_id,
            status=JobStatus.COMPLETED,
            result=result,
        )

        logger.info(f"[Blog] Pipeline completed: {job_id}")

    except Exception as e:
        logger.error(f"[Blog] Pipeline failed: {e}")
        job_store.update(
            job_id,
            status=JobStatus.FAILED,
            error=str(e),
        )


@router.post("/refresh")
async def refresh_content(request: RefreshRequest):
    """
    Refresh article content using AI + Google Search.

    Identifies and updates outdated facts with verified current data.
    """
    try:
        logger.info(f"[Blog] Refreshing content for: {request.keyword}")

        from .stage_refresh.stage_refresh import run_stage_refresh
        from .stage_refresh.refresh_models import RefreshInput

        refresh_input = RefreshInput(
            article=request.article,
            keyword=request.keyword,
        )

        result = await run_stage_refresh(refresh_input)

        return {
            "article": result.article,
            "fixes_applied": result.fixes_applied,
            "fixes": [fix.model_dump() for fix in result.fixes],
            "ai_calls": result.ai_calls,
        }

    except Exception as e:
        logger.error(f"[Blog] Refresh failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
