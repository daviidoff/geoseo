"""
Keywords service router.
"""

import uuid
import asyncio
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import StreamingResponse
import csv
import io
import json

from core.job_store import job_store, JobStatus
from core.config import ServiceType
from .models import KeywordRequest, GenerationResponse, RefreshRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/keywords", tags=["Keywords"])


@router.get("/health")
async def health():
    """Health check for keywords service."""
    return {
        "service": "keywords",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/jobs")
async def create_job(
    request: KeywordRequest,
    background_tasks: BackgroundTasks,
):
    """
    Create a keyword generation job (async).

    Returns immediately with job_id, processes in background.
    """
    job_id = str(uuid.uuid4())

    # Create job
    job = job_store.create(
        job_id=job_id,
        service_type=ServiceType.KEYWORDS,
        request=request.model_dump(),
    )

    # Start background processing
    background_tasks.add_task(run_keyword_pipeline, job_id, request)

    return {
        "job_id": job_id,
        "status": "pending",
        "message": "Keyword generation job created",
        "created_at": job["created_at"],
    }


@router.get("/jobs")
async def list_jobs(
    limit: int = Query(default=50, ge=1, le=100),
    status: Optional[str] = None,
):
    """List keyword generation jobs."""
    status_filter = JobStatus(status) if status else None
    jobs = job_store.list_all(
        service_type=ServiceType.KEYWORDS,
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

    if job["service_type"] != ServiceType.KEYWORDS.value:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["service_type"] != ServiceType.KEYWORDS.value:
        raise HTTPException(status_code=404, detail="Job not found")

    job_store.delete(job_id)
    return {"message": "Job deleted", "job_id": job_id}


@router.get("/jobs/{job_id}/export/json")
async def export_json(job_id: str):
    """Export keywords as JSON file."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["service_type"] != ServiceType.KEYWORDS.value:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] != JobStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Job not completed")

    result = job.get("result", {})
    content = json.dumps(result, indent=2)

    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=keywords_{job_id}.json"},
    )


@router.get("/jobs/{job_id}/export/csv")
async def export_csv(job_id: str):
    """Export keywords as CSV file."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["service_type"] != ServiceType.KEYWORDS.value:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] != JobStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Job not completed")

    result = job.get("result", {})
    keywords = result.get("keywords", [])

    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(["keyword", "intent", "score", "source", "is_question", "cluster", "volume", "difficulty", "aeo_opportunity"])

    # Rows (with CSV injection prevention)
    for kw in keywords:
        keyword = kw.get("keyword", "")
        # Prevent CSV injection
        if keyword.startswith(("=", "+", "-", "@")):
            keyword = "'" + keyword
        writer.writerow([
            keyword,
            kw.get("intent", ""),
            kw.get("score", ""),
            kw.get("source", ""),
            kw.get("is_question", False),
            kw.get("cluster_name", ""),
            kw.get("volume", 0),
            kw.get("difficulty", 0),
            kw.get("aeo_opportunity", 0),
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=keywords_{job_id}.csv"},
    )


@router.post("/generate")
async def generate_sync(request: KeywordRequest):
    """
    Synchronous keyword generation (limited, use /jobs for production).

    Warning: May timeout for large requests.
    """
    job_id = str(uuid.uuid4())

    job_store.create(
        job_id=job_id,
        service_type=ServiceType.KEYWORDS,
        request=request.model_dump(),
    )

    try:
        await run_keyword_pipeline(job_id, request)
        job = job_store.get(job_id)

        if job["status"] == JobStatus.FAILED.value:
            raise HTTPException(status_code=500, detail=job.get("error", "Generation failed"))

        return job["result"]

    except Exception as e:
        logger.error(f"Sync generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def run_keyword_pipeline(job_id: str, request: KeywordRequest):
    """
    Run the keyword generation pipeline.

    Uses the actual 5-stage openkeyword pipeline.
    """
    try:
        job_store.update(job_id, status=JobStatus.RUNNING)
        logger.info(f"[Keywords] Running pipeline for: {request.company_name}")

        # Import and run actual pipeline
        from .pipeline import run_pipeline

        # Always use target_count as sample size to get SERP/content briefs for ALL keywords
        target = request.target_count or 50
        # Force sample_size to target_count to ensure all keywords get SERP/content brief data
        sample_size = target
        
        logger.info(f"[Keywords] SERP sample size set to: {sample_size} (target_count)")
        
        result = await run_pipeline(
            company_url=str(request.company_url) if request.company_url else f"https://{request.company_name.lower().replace(' ', '')}.com",
            company_name=request.company_name,
            target_count=target,
            language=request.language or "en",
            region=request.region or "us",
            enable_research=request.enable_research or False,
            enable_clustering=True,
            min_score=request.min_score or 40,
            min_word_count=2,
            cluster_count=request.cluster_count or 6,
            enable_serp_analysis=request.enable_serp_analysis,
            enable_volume_lookup=request.enable_volume_lookup,
            serp_sample_size=sample_size,
            # Pre-provided company context and instructions
            company_context=request.company_context.model_dump() if request.company_context else None,
            system_instructions=request.system_instructions,
            custom_instructions=request.custom_instructions,
        )

        job_store.update(
            job_id,
            status=JobStatus.COMPLETED,
            result=result,
        )

        logger.info(f"[Keywords] Pipeline completed: {job_id}")

    except Exception as e:
        logger.error(f"[Keywords] Pipeline failed: {e}")
        job_store.update(
            job_id,
            status=JobStatus.FAILED,
            error=str(e),
        )


@router.post("/refresh")
async def refresh_keywords(request: RefreshRequest):
    """
    Refresh/regenerate keywords using existing keywords as seeds.

    Uses the existing keywords to inform the generation of new keywords,
    maintaining relevance while discovering fresh opportunities.
    """
    job_id = str(uuid.uuid4())
    logger.info(f"[Keywords] Refresh mode for: {request.company_name} with {len(request.existing_keywords)} seed keywords")

    try:
        from .pipeline import run_pipeline

        # Run pipeline with research enabled to expand from seed keywords
        result = await run_pipeline(
            company_url=str(request.company_url) if request.company_url else f"https://{request.company_name.lower().replace(' ', '')}.com",
            company_name=request.company_name,
            target_count=request.target_count,
            language=request.language,
            region=request.region,
            enable_research=True,  # Enable research to expand from seeds
            enable_clustering=True,
            min_score=40,
            min_word_count=2,
            cluster_count=6,
        )

        # Add refresh metadata
        result["refresh_mode"] = True
        result["seed_keywords"] = request.existing_keywords
        result["seed_count"] = len(request.existing_keywords)

        return result

    except Exception as e:
        logger.error(f"[Keywords] Refresh failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
