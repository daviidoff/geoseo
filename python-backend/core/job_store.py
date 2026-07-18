"""
Unified Job Store for async job management.
Thread-safe in-memory store (can be replaced with Redis in production).
"""

import threading
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from .config import MAX_JOBS, JOB_TTL_HOURS, ServiceType


class JobStatus(str, Enum):
    """Job status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobStore:
    """
    Thread-safe in-memory job store.

    Usage:
        store = JobStore()
        job = store.create("job-123", ServiceType.KEYWORDS, {"company_name": "Stripe"})
        store.update("job-123", status=JobStatus.RUNNING, progress={"stage": 1})
        result = store.get("job-123")
    """

    def __init__(self, max_jobs: int = MAX_JOBS, ttl_hours: int = JOB_TTL_HOURS):
        self._jobs: Dict[str, dict] = {}
        self._lock = threading.Lock()
        self._max_jobs = max_jobs
        self._ttl_hours = ttl_hours

    def create(
        self,
        job_id: str,
        service_type: ServiceType,
        request: Dict[str, Any],
    ) -> dict:
        """Create a new job."""
        now = datetime.now(timezone.utc).isoformat()
        job = {
            "job_id": job_id,
            "service_type": service_type.value,
            "status": JobStatus.PENDING.value,
            "request": request,
            "progress": None,
            "result": None,
            "error": None,
            "created_at": now,
            "updated_at": now,
        }

        with self._lock:
            # Cleanup old jobs if at capacity
            if len(self._jobs) >= self._max_jobs:
                self._cleanup_old_jobs()
            self._jobs[job_id] = job

        return job

    def get(self, job_id: str) -> Optional[dict]:
        """Get a job by ID."""
        with self._lock:
            return self._jobs.get(job_id)

    def update(self, job_id: str, **kwargs) -> Optional[dict]:
        """Update a job."""
        with self._lock:
            if job_id not in self._jobs:
                return None

            # Convert enums to values
            for key, value in kwargs.items():
                if isinstance(value, Enum):
                    kwargs[key] = value.value

            self._jobs[job_id].update(kwargs)
            self._jobs[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
            return self._jobs[job_id]

    def list_all(
        self,
        service_type: Optional[ServiceType] = None,
        status: Optional[JobStatus] = None,
        limit: int = 50,
    ) -> List[dict]:
        """List jobs with optional filtering."""
        with self._lock:
            jobs = list(self._jobs.values())

        # Filter by service type
        if service_type:
            jobs = [j for j in jobs if j["service_type"] == service_type.value]

        # Filter by status
        if status:
            jobs = [j for j in jobs if j["status"] == status.value]

        # Sort by created_at descending
        jobs.sort(key=lambda x: x["created_at"], reverse=True)

        return jobs[:limit]

    def delete(self, job_id: str) -> bool:
        """Delete a job."""
        with self._lock:
            if job_id in self._jobs:
                del self._jobs[job_id]
                return True
            return False

    def cancel(self, job_id: str) -> Optional[dict]:
        """Cancel a running or pending job."""
        with self._lock:
            if job_id not in self._jobs:
                return None
            
            job = self._jobs[job_id]
            # Only cancel if job is pending or running
            if job["status"] in [JobStatus.PENDING.value, JobStatus.RUNNING.value]:
                job["status"] = JobStatus.CANCELLED.value
                job["updated_at"] = datetime.now(timezone.utc).isoformat()
                return job
            return job  # Return existing job if already completed/failed

    def _cleanup_old_jobs(self) -> int:
        """Remove jobs older than TTL. Returns count of removed jobs."""
        now = datetime.now(timezone.utc)
        removed = 0

        jobs_to_remove = []
        for job_id, job in self._jobs.items():
            try:
                created = datetime.fromisoformat(job["created_at"].replace("Z", "+00:00"))
                age_hours = (now - created).total_seconds() / 3600
                if age_hours > self._ttl_hours:
                    jobs_to_remove.append(job_id)
            except (ValueError, KeyError):
                continue

        for job_id in jobs_to_remove:
            del self._jobs[job_id]
            removed += 1

        return removed

    def stats(self) -> Dict[str, Any]:
        """Get job store statistics."""
        with self._lock:
            jobs = list(self._jobs.values())

        by_status = {}
        by_service = {}

        for job in jobs:
            status = job.get("status", "unknown")
            service = job.get("service_type", "unknown")
            by_status[status] = by_status.get(status, 0) + 1
            by_service[service] = by_service.get(service, 0) + 1

        return {
            "total_jobs": len(jobs),
            "by_status": by_status,
            "by_service": by_service,
            "max_jobs": self._max_jobs,
            "ttl_hours": self._ttl_hours,
        }


# Global job store instance
job_store = JobStore()
