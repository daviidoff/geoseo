/**
 * ABOUTME: Generic process indicator with visual connections instead of flickering text
 * ABOUTME: Shows progress and connected state for any processing operation
 */

'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface ProcessStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'complete' | 'error'
}

interface ProcessIndicatorProps {
  /** Current process status */
  status: 'idle' | 'processing' | 'complete' | 'error'
  /** Main process label */
  label: string
  /** Optional progress percentage (0-100) */
  progress?: number
  /** Estimated duration in seconds */
  estimatedDuration?: number
  /** Optional process steps */
  steps?: ProcessStep[]
  /** Show visual connection pins */
  showConnections?: boolean
  /** Custom className */
  className?: string
}

export function ProcessIndicator({
  status,
  label,
  progress,
  estimatedDuration,
  steps,
  showConnections = true,
  className
}: ProcessIndicatorProps) {
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)

  // Track elapsed time
  useEffect(() => {
    if (status === 'processing') {
      if (!startTime) {
        setStartTime(Date.now())
      }
      
      const interval = setInterval(() => {
        if (startTime) {
          setTimeElapsed(Math.floor((Date.now() - startTime) / 1000))
        }
      }, 1000)
      
      return () => clearInterval(interval)
    } else {
      setStartTime(null)
      setTimeElapsed(0)
    }
  }, [status, startTime])

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-blue-600'
      case 'complete':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getConnectionColor = () => {
    switch (status) {
      case 'processing':
        return 'from-blue-500 to-blue-300'
      case 'complete':
        return 'from-green-500 to-green-300'
      case 'error':
        return 'from-red-500 to-red-300'
      default:
        return 'from-gray-300 to-gray-300'
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main Process Header */}
      <div className="flex items-center gap-3">
        {getStatusIcon()}
        <div className="flex-1">
          <div className={cn("font-medium", getStatusColor())}>
            {status === 'processing' ? `${label}...` : label}
          </div>
          {status === 'processing' && estimatedDuration && (
            <div className="text-sm text-muted-foreground">
              {timeElapsed}s elapsed
              {estimatedDuration && timeElapsed < estimatedDuration && (
                <span> • ~{estimatedDuration - timeElapsed}s remaining</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Visual Connections */}
      {showConnections && (
        <div className="flex items-center gap-2">
          {/* Input Pin */}
          <div className={cn(
            "w-2 h-2 rounded-full transition-colors duration-300",
            status === 'idle' ? "bg-gray-300" :
            status === 'processing' ? "bg-blue-500" :
            status === 'complete' ? "bg-green-500" :
            "bg-red-500"
          )} />
          
          {/* Connection Lines */}
          <div className="flex-1 flex items-center">
            <div className={cn(
              "h-0.5 flex-1 transition-all duration-500",
              status === 'idle' ? "bg-gray-200" : `bg-gradient-to-r ${getConnectionColor()}`
            )}>
              {status === 'processing' && (
                <div className="h-full bg-white/30 animate-pulse rounded" />
              )}
            </div>
          </div>
          
          {/* Output Pin */}
          <div className={cn(
            "w-2 h-2 rounded-full transition-colors duration-300",
            status === 'complete' ? "bg-green-500" :
            status === 'error' ? "bg-red-500" :
            status === 'processing' ? "bg-yellow-400" :
            "bg-gray-300"
          )} />
        </div>
      )}

      {/* Progress Bar */}
      {(status === 'processing' || status === 'complete') && (
        <div className="space-y-1">
          <Progress 
            value={
              progress ?? 
              (status === 'complete' ? 100 : 
               estimatedDuration ? Math.min(90, (timeElapsed / estimatedDuration) * 100) : 
               undefined)
            }
            className="h-1.5"
          />
          {progress !== undefined && (
            <div className="text-xs text-muted-foreground text-right">
              {Math.round(progress)}%
            </div>
          )}
        </div>
      )}

      {/* Process Steps */}
      {steps && steps.length > 0 && (
        <div className="pl-6 space-y-2 border-l-2 border-gray-100">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-2 text-sm">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                step.status === 'complete' ? "bg-green-500" :
                step.status === 'active' ? "bg-blue-500 animate-pulse" :
                step.status === 'error' ? "bg-red-500" :
                "bg-gray-300"
              )} />
              <span className={cn(
                "transition-colors",
                step.status === 'complete' ? "text-green-600" :
                step.status === 'active' ? "text-blue-600" :
                step.status === 'error' ? "text-red-600" :
                "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}