// ABOUTME: Displays running state with real-time progress, elapsed time, and stage breakdown
// ABOUTME: Used during keyword/blog generation to show live progress updates

'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Timer, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface Stage {
  id: string
  name: string
  status: 'pending' | 'running' | 'complete' | 'error'
  duration?: number // actual elapsed seconds for completed stages
  startTime?: number // timestamp when stage started (for running stage)
}

export interface ActivityLogEntry {
  timestamp?: string
  type?: string
  message: string
  icon?: string
  source_data?: any
}

interface RunningStateProps {
  status: 'idle' | 'running' | 'complete' | 'error'
  progress: number // 0-100
  currentStage: string
  estimate?: number // seconds remaining
  stages?: Stage[] // Optional: for detailed view
  logs?: string[] | ActivityLogEntry[] // Optional: last N log lines (backwards compatible)
  onCancel?: () => void
  className?: string
  errorMessage?: string
  successMessage?: string
  showDetails?: boolean // Control external detail visibility
  phase?: string // Optional: current phase for PhaseIndicator
}

// Format time as human-readable string
function formatTime(seconds: number): string {
  if (seconds <= 0) return '0s'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

// Format elapsed time with dynamic updates
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Live timer component for running stages
function StageRunningTimer() {
  const [liveElapsed, setLiveElapsed] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveElapsed(prev => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <span className="text-[10px] text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono animate-pulse">
      {liveElapsed}s
    </span>
  )
}

export function RunningState({
  status,
  progress,
  currentStage,
  estimate,
  stages,
  logs,
  onCancel,
  className,
  errorMessage,
  successMessage,
  showDetails: externalShowDetails,
  phase,
}: RunningStateProps) {
  const [internalShowDetails, setInternalShowDetails] = useState(true) // Default to expanded
  const showDetails = externalShowDetails ?? internalShowDetails
  
  // Real-time elapsed time tracking
  const [elapsedTime, setElapsedTime] = useState(0)
  const startTimeRef = useRef<number>(Date.now())
  
  // Update elapsed time every 100ms for smooth display
  useEffect(() => {
    if (status === 'running') {
      startTimeRef.current = Date.now() - (elapsedTime * 1000)
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        setElapsedTime(elapsed)
      }, 100)
      return () => clearInterval(interval)
    }
  }, [status])
  
  // Reset elapsed time when starting new generation
  useEffect(() => {
    if (status === 'running' && progress < 5) {
      startTimeRef.current = Date.now()
      setElapsedTime(0)
    }
  }, [status, progress])

  // Don't render if idle
  if (status === 'idle') return null

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" />
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'running':
        return 'Generating'
      case 'complete':
        return 'Complete'
      case 'error':
        return 'Failed'
      default:
        return ''
    }
  }

  const hasDetailedInfo = (stages && stages.length > 0) || (logs && logs.length > 0)
  
  // Calculate completed and running stage count
  const completedStages = stages?.filter(s => s.status === 'complete').length || 0
  const totalStages = stages?.length || 0
  const currentRunningStage = stages?.find(s => s.status === 'running')

  return (
    <div className={cn('rounded-xl border border-border/50 bg-gradient-to-b from-card to-card/80 shadow-lg overflow-hidden', className)}>
      {/* Header with glassmorphism effect */}
      <div className="bg-muted/30 backdrop-blur-sm border-b border-border/30 p-4">
        <div className="flex items-center gap-4">
          {getStatusIcon()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-foreground">{getStatusText()}</h3>
              
              {/* Real-time stats badges */}
              {status === 'running' && (
                <div className="flex items-center gap-2">
                  {/* Elapsed time badge */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                    <Timer className="h-3 w-3 text-blue-500" />
                    <span className="text-xs font-mono font-medium text-blue-600 dark:text-blue-400">
                      {formatElapsed(elapsedTime)}
                    </span>
                  </div>
                  
                  {/* Remaining time badge */}
                  {estimate !== undefined && estimate > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                      <Clock className="h-3 w-3 text-orange-500" />
                      <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                        ~{formatTime(estimate)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Stage progress indicator */}
            {status === 'running' && totalStages > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Stage {Math.min(completedStages + 1, totalStages)} of {totalStages}
                {currentRunningStage && (
                  <span className="text-foreground/70"> • {currentRunningStage.name.replace(/^[^\s]+\s/, '')}</span>
                )}
              </p>
            )}
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-3">
            {/* Circular progress or bar */}
            {(status === 'running' || status === 'complete') && (
              <div className="flex items-center gap-2">
                <div className="w-32 bg-muted/50 rounded-full h-2 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300 ease-out',
                      status === 'complete'
                        ? 'bg-green-500'
                        : 'bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 bg-[length:200%_100%] animate-gradient'
                    )}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <span className={cn(
                  'text-sm font-bold min-w-[42px] text-right',
                  status === 'complete' ? 'text-green-500' : 'text-blue-500'
                )}>
                  {Math.round(progress)}%
                </span>
              </div>
            )}

            {hasDetailedInfo && externalShowDetails === undefined && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInternalShowDetails(!internalShowDetails)}
                className="gap-1 h-8 px-2"
              >
                {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Current Stage Description */}
      {(status === 'running' || status === 'complete') && currentStage && (
        <div className="px-4 py-2 bg-muted/20 border-b border-border/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-yellow-500" />
            <span>{currentStage}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {status === 'error' && errorMessage && (
        <div className="m-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* Success Message */}
      {status === 'complete' && successMessage && (
        <div className="m-4 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
          <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      {/* Detailed View (Expandable) */}
      {showDetails && hasDetailedInfo && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 min-h-[400px]">
          {/* LEFT: Stage Breakdown */}
          {stages && stages.length > 0 && (
            <div className="border-r border-border/30 p-4 bg-muted/5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Progress Breakdown
              </h4>
              <div className="space-y-1">
                {stages.map((stage, index) => {
                  const isActive = stage.status === 'running'
                  const isComplete = stage.status === 'complete'
                  const isPending = stage.status === 'pending'
                  
                  return (
                    <div
                      key={stage.id}
                      className={cn(
                        'flex items-center gap-3 text-sm py-2 px-3 rounded-lg transition-all duration-300',
                        isActive && 'bg-blue-500/10 border border-blue-500/30 shadow-sm',
                        isComplete && 'opacity-70',
                        isPending && 'opacity-50'
                      )}
                    >
                      {/* Status indicator */}
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium',
                        isComplete && 'bg-green-500 text-white',
                        isActive && 'bg-blue-500 text-white animate-pulse',
                        isPending && 'bg-muted text-muted-foreground border border-border'
                      )}>
                        {isComplete ? '✓' : index + 1}
                      </div>
                      
                      <span className={cn(
                        'flex-1 text-sm',
                        isComplete && 'line-through text-muted-foreground',
                        isActive && 'font-medium text-foreground',
                        isPending && 'text-muted-foreground'
                      )}>
                        {stage.name}
                      </span>
                      
                      {/* Duration badge - live for running, actual for completed */}
                      {isActive && <StageRunningTimer key={`timer-${stage.id}`} />}
                      {stage.duration !== undefined && isComplete && (
                        <span className="text-[10px] text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">
                          {stage.duration}s
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* RIGHT: Activity Log */}
          {logs && logs.length > 0 && (
            <div className="flex flex-col p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Activity Log
              </h4>
              <div className="flex-1 bg-black/5 dark:bg-black/20 rounded-lg p-3 font-mono text-xs overflow-y-auto max-h-[350px]">
                <div className="space-y-1">
                  {logs.slice(-25).map((log, idx) => {
                    const entry = typeof log === 'string'
                      ? { message: log, timestamp: new Date().toISOString() }
                      : log
                    
                    // Extract timestamp from message if present
                    const timestampMatch = entry.message.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*/)
                    const cleanMessage = timestampMatch ? entry.message.replace(timestampMatch[0], '') : entry.message
                    const displayTime = timestampMatch ? timestampMatch[1] : (entry.timestamp 
                      ? new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })
                      : '')
                    
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 py-1 hover:bg-white/5 rounded px-1 transition-colors"
                      >
                        <span className="text-blue-400/70 flex-shrink-0 w-16">
                          [{displayTime}]
                        </span>
                        <span className="text-foreground/80 flex-1 break-words">
                          {cleanMessage}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancel Button */}
      {status === 'running' && onCancel && (
        <div className="flex justify-center p-4 border-t border-border/30 bg-muted/10">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Cancel Generation
          </Button>
        </div>
      )}
    </div>
  )
}
