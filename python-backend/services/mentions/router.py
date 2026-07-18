"""
Mentions service router.
"""

import uuid
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from core.job_store import job_store, JobStatus
from core.config import ServiceType
from .models import MentionsRequest, MentionsResponse
from .service import check_mentions, validate_company_analysis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mentions", tags=["Mentions"])


@router.get("/health")
async def health():
    """Health check for mentions service."""
    return {
        "service": "mentions",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/jobs")
async def create_job(
    request: MentionsRequest,
    background_tasks: BackgroundTasks,
):
    """
    Create a mentions check job (async).
    """
    # Validate company analysis
    validation = validate_company_analysis(request.company_analysis)
    if not validation.get("valid"):
        raise HTTPException(status_code=400, detail=validation)

    job_id = str(uuid.uuid4())

    job = job_store.create(
        job_id=job_id,
        service_type=ServiceType.MENTIONS,
        request=request.model_dump(mode="json"),
    )

    background_tasks.add_task(run_mentions_check, job_id, request)

    return {
        "job_id": job_id,
        "status": "pending",
        "message": f"Mentions check job created for {request.company_name}",
        "created_at": job["created_at"],
    }


@router.get("/jobs")
async def list_jobs(
    limit: int = Query(default=50, ge=1, le=100),
    status: Optional[str] = None,
):
    """List mentions check jobs."""
    status_filter = JobStatus(status) if status else None
    jobs = job_store.list_all(
        service_type=ServiceType.MENTIONS,
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

    if job["service_type"] != ServiceType.MENTIONS.value:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["service_type"] != ServiceType.MENTIONS.value:
        raise HTTPException(status_code=404, detail="Job not found")

    job_store.delete(job_id)
    return {"message": "Job deleted", "job_id": job_id}


@router.post("/check")
async def check_sync(request: MentionsRequest):
    """
    Synchronous mentions check (for single company).
    """
    # Validate company analysis
    validation = validate_company_analysis(request.company_analysis)
    if not validation.get("valid"):
        raise HTTPException(status_code=400, detail=validation)

    job_id = str(uuid.uuid4())

    job_store.create(
        job_id=job_id,
        service_type=ServiceType.MENTIONS,
        request=request.model_dump(mode="json"),
    )

    try:
        await run_mentions_check(job_id, request)
        job = job_store.get(job_id)

        if job["status"] == JobStatus.FAILED.value:
            raise HTTPException(status_code=500, detail=job.get("error", "Check failed"))

        return job["result"]

    except Exception as e:
        logger.error(f"Sync mentions check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def run_mentions_check(job_id: str, request: MentionsRequest):
    """
    Run mentions visibility check.
    """
    try:
        job_store.update(job_id, status=JobStatus.RUNNING)

        logger.info(f"[Mentions] Starting check for: {request.company_name}")

        result = await check_mentions(request)

        # Convert to dict for storage
        result_dict = result.model_dump()

        job_store.update(
            job_id,
            status=JobStatus.COMPLETED,
            result=result_dict,
        )

        logger.info(f"[Mentions] Check completed: {job_id}")

    except Exception as e:
        logger.error(f"[Mentions] Check failed: {e}")
        job_store.update(
            job_id,
            status=JobStatus.FAILED,
            error=str(e),
        )
