"""
Health check service router.
"""

import uuid
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from core.job_store import job_store, JobStatus
from core.config import ServiceType
from .models import HealthCheckRequest, HealthCheckResponse
from .service import run_health_check

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health-check", tags=["Health Check"])


@router.get("/health")
async def health():
    """Health check for health-check service."""
    return {
        "service": "health-check",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/jobs")
async def create_job(
    request: HealthCheckRequest,
    background_tasks: BackgroundTasks,
):
    """
    Create a health check job (async).
    """
    job_id = str(uuid.uuid4())

    job = job_store.create(
        job_id=job_id,
        service_type=ServiceType.HEALTH,
        request=request.model_dump(mode="json"),
    )

    background_tasks.add_task(run_health_check_job, job_id, request)

    return {
        "job_id": job_id,
        "status": "pending",
        "message": f"Health check job created for {request.url}",
        "created_at": job["created_at"],
    }


@router.get("/jobs")
async def list_jobs(
    limit: int = Query(default=50, ge=1, le=100),
    status: Optional[str] = None,
):
    """List health check jobs."""
    status_filter = JobStatus(status) if status else None
    jobs = job_store.list_all(
        service_type=ServiceType.HEALTH,
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

    if job["service_type"] != ServiceType.HEALTH.value:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["service_type"] != ServiceType.HEALTH.value:
        raise HTTPException(status_code=404, detail="Job not found")

    job_store.delete(job_id)
    return {"message": "Job deleted", "job_id": job_id}


@router.post("/check")
async def check_sync(request: HealthCheckRequest):
    """
    Synchronous health check (for single URL).
    """
    job_id = str(uuid.uuid4())

    job_store.create(
        job_id=job_id,
        service_type=ServiceType.HEALTH,
        request=request.model_dump(mode="json"),
    )

    try:
        await run_health_check_job(job_id, request)
        job = job_store.get(job_id)

        if job["status"] == JobStatus.FAILED.value:
            raise HTTPException(status_code=500, detail=job.get("error", "Check failed"))

        return job["result"]

    except Exception as e:
        logger.error(f"Sync health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def run_health_check_job(job_id: str, request: HealthCheckRequest):
    """
    Run health check job.
    """
    try:
        job_store.update(job_id, status=JobStatus.RUNNING)

        logger.info(f"[Health] Starting check for: {request.url}")

        result = await run_health_check(request)

        # Convert to dict for storage
        result_dict = result.model_dump()

        job_store.update(
            job_id,
            status=JobStatus.COMPLETED,
            result=result_dict,
        )

        logger.info(f"[Health] Check completed: {job_id}")

    except Exception as e:
        logger.error(f"[Health] Check failed: {e}")
        job_store.update(
            job_id,
            status=JobStatus.FAILED,
            error=str(e),
        )
