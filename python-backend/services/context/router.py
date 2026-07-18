"""
Context service router.
"""

import uuid
import asyncio
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from core.job_store import job_store, JobStatus
from core.config import ServiceType
from .models import ContextRequest, ContextResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/context", tags=["Context"])


@router.get("/health")
async def health():
    """Health check for context service."""
    return {
        "service": "context",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/jobs")
async def create_job(
    request: ContextRequest,
    background_tasks: BackgroundTasks,
):
    """
    Create a context extraction job (async).
    """
    job_id = str(uuid.uuid4())

    job = job_store.create(
        job_id=job_id,
        service_type=ServiceType.CONTEXT,
        request=request.model_dump(mode="json"),
    )

    background_tasks.add_task(run_context_extraction, job_id, request)

    return {
        "job_id": job_id,
        "status": "pending",
        "message": f"Context extraction job created for {request.url}",
        "created_at": job["created_at"],
    }


@router.get("/jobs")
async def list_jobs(
    limit: int = Query(default=50, ge=1, le=100),
    status: Optional[str] = None,
):
    """List context extraction jobs."""
    status_filter = JobStatus(status) if status else None
    jobs = job_store.list_all(
        service_type=ServiceType.CONTEXT,
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

    if job["service_type"] != ServiceType.CONTEXT.value:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["service_type"] != ServiceType.CONTEXT.value:
        raise HTTPException(status_code=404, detail="Job not found")

    job_store.delete(job_id)
    return {"message": "Job deleted", "job_id": job_id}


@router.post("/analyze")
async def analyze_sync(request: ContextRequest):
    """
    Synchronous context extraction (faster, single URL).
    """
    job_id = str(uuid.uuid4())

    job_store.create(
        job_id=job_id,
        service_type=ServiceType.CONTEXT,
        request=request.model_dump(mode="json"),
    )

    try:
        await run_context_extraction(job_id, request)
        job = job_store.get(job_id)

        if job["status"] == JobStatus.FAILED.value:
            raise HTTPException(status_code=500, detail=job.get("error", "Extraction failed"))

        return job["result"]

    except Exception as e:
        logger.error(f"Sync extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def run_context_extraction(job_id: str, request: ContextRequest):
    """
    Run context extraction using OpenContext.
    """
    import time
    start_time = time.time()

    try:
        job_store.update(job_id, status=JobStatus.RUNNING)

        url = str(request.url)
        logger.info(f"[Context] Extracting context for: {url}")

        # Build user context from request
        user_context = None
        if any([
            request.system_instructions,
            request.client_knowledge_base,
            request.content_instructions,
            request.research_files,
            request.assets,
        ]):
            user_context = {
                "system_instructions": request.system_instructions,
                "client_knowledge_base": request.client_knowledge_base,
                "content_instructions": request.content_instructions,
                "research_files": request.research_files,
                "assets": request.assets,
            }
            logger.info(f"[Context] Using user-provided context")

        # Import and run actual opencontext extraction
        from .opencontext.opencontext import get_company_context

        logger.info(f"[ROUTER] Calling get_company_context for {url}")
        context, ai_called = await get_company_context(
            url=url,
            fallback_on_error=True,
            user_context=user_context,
        )
        logger.info(f"[ROUTER] get_company_context returned ai_called={ai_called}")

        # Convert to dict for storage
        result = context.model_dump()
        result["ai_called"] = ai_called
        result["processing_time_seconds"] = round(time.time() - start_time, 2)

        job_store.update(
            job_id,
            status=JobStatus.COMPLETED,
            result=result,
        )

        logger.info(f"[Context] Extraction completed: {job_id}")

    except Exception as e:
        logger.error(f"[Context] Extraction failed: {e}")
        job_store.update(
            job_id,
            status=JobStatus.FAILED,
            error=str(e),
        )
