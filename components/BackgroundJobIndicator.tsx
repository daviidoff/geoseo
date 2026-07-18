/**
 * ABOUTME: Floating indicator showing active background jobs.
 * ABOUTME: Persists across page navigations and shows completion notifications.
 */

'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ChevronUp, 
  ChevronDown,
  X,
  ExternalLink 
} from 'lucide-react'
import { useBackgroundJobsContext } from '@/contexts/BackgroundJobsContext'
import type { BackgroundJob, JobType } from '@/hooks/useBackgroundJobs'
import { cn } from '@/lib/utils'

// Icons for each job type
const JOB_TYPE_ICONS: Record<JobType, string> = {
  blog: '📝',
  context: '🏢',
  keywords: '🔑',
  mentions: '👁️',
  health: '🏥',
}

// Colors for each status
const STATUS_COLORS: Record<BackgroundJob['status'], string> = {
  pending: 'text-amber-500',
  running: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
  cancelled: 'text-gray-500',
}

interface JobItemProps {
  job: BackgroundJob
  onRemove: () => void
  onNavigate: () => void
}

function JobItem({ job, onRemove, onNavigate }: JobItemProps) {
  const isActive = job.status === 'pending' || job.status === 'running'
  const isCompleted = job.status === 'completed'
  const isFailed = job.status === 'failed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="flex items-center gap-3 p-3 bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 shadow-sm"
    >
      {/* Job type icon */}
      <span className="text-lg">{JOB_TYPE_ICONS[job.type]}</span>

      {/* Job info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{job.title}</span>
          {isActive && (
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          )}
          {isCompleted && (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          )}
          {isFailed && (
            <XCircle className="h-3 w-3 text-red-500" />
          )}
        </div>
        
        {/* Progress */}
        {isActive && job.progress && (
          <div className="mt-1">
            {job.progress.message && (
              <p className="text-xs text-muted-foreground truncate">
                {job.progress.message}
              </p>
            )}
            {typeof job.progress.percent === 'number' && (
              <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${job.progress.percent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {isFailed && job.error && (
          <p className="text-xs text-red-500 truncate mt-1">{job.error}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {isCompleted && job.resultPath && (
          <button
            onClick={onNavigate}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="View results"
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        {!isActive && (
          <button
            onClick={onRemove}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

export function BackgroundJobIndicator() {
  const { jobs, activeJobs, removeJob, clearCompletedJobs } = useBackgroundJobsContext()
  const [isExpanded, setIsExpanded] = useState(false)

  // Don't render if no jobs
  if (jobs.length === 0) {
    return null
  }

  const hasActiveJobs = activeJobs.length > 0
  const hasCompletedJobs = jobs.some(j => j.status === 'completed' || j.status === 'failed')

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <AnimatePresence>
        {/* Expanded panel */}
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
              <span className="text-sm font-medium">Background Tasks</span>
              {hasCompletedJobs && (
                <button
                  onClick={clearCompletedJobs}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear completed
                </button>
              )}
            </div>

            {/* Job list */}
            <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {jobs.map((job) => (
                  <JobItem
                    key={job.id}
                    job={job}
                    onRemove={() => removeJob(job.id)}
                    onNavigate={() => {
                      if (job.resultPath) {
                        window.location.href = job.resultPath
                      }
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed indicator button */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-colors',
          'bg-card border border-border hover:bg-muted',
          hasActiveJobs && 'animate-pulse-subtle'
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        title={isExpanded ? 'Collapse' : 'Expand background tasks'}
      >
        {/* Spinning loader or count */}
        {hasActiveJobs ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
        <span className="text-sm font-medium whitespace-nowrap">
          {hasActiveJobs 
            ? `${activeJobs.length} task${activeJobs.length !== 1 ? 's' : ''} running`
            : `${jobs.length} task${jobs.length !== 1 ? 's' : ''}`
          }
        </span>
        
        {/* Expand/collapse icon */}
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </motion.button>
    </div>
  )
}
