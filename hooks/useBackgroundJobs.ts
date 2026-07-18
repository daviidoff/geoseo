/**
 * ABOUTME: Global background job manager with persistence across page navigations.
 * ABOUTME: Continues polling jobs and shows notifications when complete.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { showSuccessToast, showErrorToast } from '@/lib/toast-helpers'

// Job types supported by the system
export type JobType = 'blog' | 'context' | 'keywords' | 'mentions' | 'health'

export interface BackgroundJob {
  id: string
  type: JobType
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  title: string
  description?: string
  progress?: {
    stage?: string
    percent?: number
    message?: string
  }
  result?: unknown
  error?: string
  createdAt: string
  updatedAt: string
  // For navigation after completion
  resultPath?: string
}

interface JobStorageData {
  jobs: BackgroundJob[]
  lastUpdated: string
}

const STORAGE_KEY = 'hyperniche-background-jobs'
const POLL_INTERVAL_MS = 3000
const MAX_JOBS_STORED = 20
const JOB_TTL_HOURS = 24
// Debounce window to prevent duplicate toasts (in ms)
const TOAST_DEBOUNCE_MS = 2000

// API endpoints for each job type
const JOB_ENDPOINTS: Record<JobType, { create: string; status: (id: string) => string }> = {
  blog: {
    create: '/api/blog-job',
    status: (id) => `/api/blog-job/${id}`,
  },
  context: {
    create: '/api/jobs/context',
    status: (id) => `/api/jobs/context/${id}`,
  },
  keywords: {
    create: '/api/jobs/keywords',
    status: (id) => `/api/jobs/keywords/${id}`,
  },
  mentions: {
    create: '/api/jobs/mentions',
    status: (id) => `/api/jobs/mentions/${id}`,
  },
  health: {
    create: '/api/jobs/health',
    status: (id) => `/api/jobs/health/${id}`,
  },
}

// Result paths for navigation after completion
const RESULT_PATHS: Record<JobType, string> = {
  blog: '/blog',
  context: '/context',
  keywords: '/keywords',
  mentions: '/aeo',
  health: '/aeo',
}

/**
 * Load jobs from localStorage
 */
function loadJobsFromStorage(): BackgroundJob[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    
    const data: JobStorageData = JSON.parse(stored)
    
    // Filter out expired jobs
    const now = new Date()
    const validJobs = data.jobs.filter((job) => {
      const createdAt = new Date(job.createdAt)
      const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
      return ageHours < JOB_TTL_HOURS
    })
    
    return validJobs
  } catch {
    return []
  }
}

/**
 * Save jobs to localStorage
 */
function saveJobsToStorage(jobs: BackgroundJob[]): void {
  if (typeof window === 'undefined') return
  
  // Keep only recent jobs
  const recentJobs = jobs.slice(0, MAX_JOBS_STORED)
  
  const data: JobStorageData = {
    jobs: recentJobs,
    lastUpdated: new Date().toISOString(),
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/**
 * Global background jobs hook
 * 
 * Manages background jobs that continue even when user navigates away.
 * Shows notifications when jobs complete.
 */
export function useBackgroundJobs() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([])
  const [isPolling, setIsPolling] = useState(false)
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const shownNotificationsRef = useRef<Set<string>>(new Set())
  // Track last "started" toast time per job type to prevent duplicates
  const lastStartToastRef = useRef<Record<string, number>>({})
  // Ref to track current jobs for polling without stale closures
  const jobsRef = useRef<BackgroundJob[]>([])

  // Load jobs from storage on mount
  useEffect(() => {
    const storedJobs = loadJobsFromStorage()
    // Deduplicate by job ID (keep most recent by updatedAt)
    const jobMap = new Map<string, BackgroundJob>()
    for (const job of storedJobs) {
      const existing = jobMap.get(job.id)
      if (!existing || new Date(job.updatedAt) > new Date(existing.updatedAt)) {
        jobMap.set(job.id, job)
      }
    }
    const deduplicatedJobs = Array.from(jobMap.values())
    setJobs(deduplicatedJobs)
    
    // Start polling if there are active jobs
    const hasActiveJobs = deduplicatedJobs.some(
      (job) => job.status === 'pending' || job.status === 'running'
    )
    if (hasActiveJobs) {
      setIsPolling(true)
    }
  }, [])

  // Keep ref in sync with state (for polling without stale closures)
  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  // Save jobs to storage whenever they change
  useEffect(() => {
    if (jobs.length > 0) {
      // Deduplicate before saving (should already be clean, but safety check)
      const jobMap = new Map<string, BackgroundJob>()
      for (const job of jobs) {
        const existing = jobMap.get(job.id)
        if (!existing || new Date(job.updatedAt) > new Date(existing.updatedAt)) {
          jobMap.set(job.id, job)
        }
      }
      saveJobsToStorage(Array.from(jobMap.values()))
    }
  }, [jobs])

  /**
   * Poll for job status updates
   */
  const pollJobs = useCallback(async () => {
    // Use ref to get current jobs without stale closure
    const currentJobs = jobsRef.current
    const activeJobs = currentJobs.filter(
      (job) => job.status === 'pending' || job.status === 'running'
    )

    if (activeJobs.length === 0) {
      setIsPolling(false)
      return
    }

    // Collect updates to apply atomically
    const updates: Map<string, Partial<BackgroundJob>> = new Map()

    for (const job of activeJobs) {
      try {
        const endpoint = JOB_ENDPOINTS[job.type]
        const response = await fetch(endpoint.status(job.id))
        
        if (!response.ok) {
          // Job not found or error - mark as failed
          updates.set(job.id, {
            status: 'failed',
            error: 'Job not found or server error',
            updatedAt: new Date().toISOString(),
          })
          continue
        }

        const data = await response.json()
        const newStatus = data.status as BackgroundJob['status']
        
        updates.set(job.id, {
          status: newStatus,
          progress: data.progress,
          result: data.result,
          error: data.error,
          updatedAt: new Date().toISOString(),
        })

        // Show notification if job just completed
        const prevStatus = job.status
        if (prevStatus !== newStatus && !shownNotificationsRef.current.has(job.id)) {
          if (newStatus === 'completed') {
            shownNotificationsRef.current.add(job.id)
            showSuccessToast(`${job.title} completed!`, {
              description: job.description || 'Your task is ready.',
              action: job.resultPath ? {
                label: 'View Results',
                onClick: () => {
                  window.location.href = job.resultPath!
                },
              } : undefined,
              duration: 10000,
            })
          } else if (newStatus === 'failed') {
            shownNotificationsRef.current.add(job.id)
            showErrorToast(`${job.title} failed`, {
              description: data.error || 'An error occurred.',
              duration: 8000,
            })
          }
        }
      } catch (error) {
        console.error(`[BackgroundJobs] Failed to poll job ${job.id}:`, error)
      }
    }

    // Apply all updates atomically using functional update
    if (updates.size > 0) {
      setJobs((prevJobs) => {
        // Deduplicate first
        const jobMap = new Map<string, BackgroundJob>()
        for (const job of prevJobs) {
          jobMap.set(job.id, job)
        }
        // Apply updates
        for (const [id, update] of updates) {
          const existing = jobMap.get(id)
          if (existing) {
            jobMap.set(id, { ...existing, ...update })
          }
        }
        return Array.from(jobMap.values())
      })
    }
  }, []) // No dependencies - uses refs

  // Polling effect
  useEffect(() => {
    if (!isPolling) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
      return
    }

    const poll = async () => {
      await pollJobs()
      pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
    }
  }, [isPolling, pollJobs])

  /**
   * Create a new background job
   */
  const createJob = useCallback(
    async (
      type: JobType,
      title: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      request: Record<string, any>,
      options?: { description?: string }
    ): Promise<BackgroundJob | null> => {
      try {
        const endpoint = JOB_ENDPOINTS[type]
        const response = await fetch(endpoint.create, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || error.detail || 'Failed to create job')
        }

        const data = await response.json()
        
        const newJob: BackgroundJob = {
          id: data.job_id,
          type,
          status: data.status || 'pending',
          title,
          description: options?.description,
          progress: data.progress,
          createdAt: data.created_at || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          resultPath: RESULT_PATHS[type],
        }

        setJobs((prev) => {
          // Prevent duplicates - check if job with same ID already exists
          const exists = prev.some((j) => j.id === newJob.id)
          if (exists) {
            console.log(`[BackgroundJobs] Job ${newJob.id} already exists, skipping add`)
            return prev
          }
          console.log(`[BackgroundJobs] Adding job ${newJob.id}, total: ${prev.length + 1}`)
          return [newJob, ...prev]
        })
        setIsPolling(true)

        // Show toast that job started (debounced to prevent duplicates)
        const now = Date.now()
        const lastToastTime = lastStartToastRef.current[type] || 0
        if (now - lastToastTime > TOAST_DEBOUNCE_MS) {
          lastStartToastRef.current[type] = now
          toast.info(`${title} started`, {
            description: 'You can navigate away - we\'ll notify you when it\'s done.',
            duration: 4000,
          })
        }

        return newJob
      } catch (error) {
        console.error(`[BackgroundJobs] Failed to create job:`, error)
        showErrorToast('Failed to start task', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
        return null
      }
    },
    []
  )

  /**
   * Cancel a running job
   */
  const cancelJob = useCallback(async (jobId: string): Promise<boolean> => {
    const job = jobsRef.current.find((j) => j.id === jobId)
    if (!job) return false

    try {
      const endpoint = JOB_ENDPOINTS[job.type]
      const response = await fetch(endpoint.status(jobId), {
        method: 'DELETE',
      })

      if (response.ok) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, status: 'cancelled', updatedAt: new Date().toISOString() }
              : j
          )
        )
        toast.info('Job cancelled')
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  /**
   * Remove a job from the list
   */
  const removeJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
    shownNotificationsRef.current.delete(jobId)
  }, [])

  /**
   * Clear all completed/failed jobs
   */
  const clearCompletedJobs = useCallback(() => {
    setJobs((prev) =>
      prev.filter((j) => j.status === 'pending' || j.status === 'running')
    )
  }, [])

  /**
   * Get active (running/pending) jobs
   */
  const activeJobs = jobs.filter(
    (job) => job.status === 'pending' || job.status === 'running'
  )

  /**
   * Get completed jobs
   */
  const completedJobs = jobs.filter((job) => job.status === 'completed')

  /**
   * Get failed jobs
   */
  const failedJobs = jobs.filter((job) => job.status === 'failed')

  return {
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    isPolling,
    createJob,
    cancelJob,
    removeJob,
    clearCompletedJobs,
  }
}

// Export types for consumers
export type UseBackgroundJobsReturn = ReturnType<typeof useBackgroundJobs>
