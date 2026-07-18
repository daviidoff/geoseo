/**
 * ABOUTME: Parse button with progress indication instead of flickering text
 * ABOUTME: Shows connected pins and loading bar for better UX
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Loader2, Play, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParseButtonWithProgressProps {
  /** Whether parsing is in progress */
  isParsing: boolean
  /** Whether parsing is complete */
  isComplete?: boolean
  /** Click handler for parse button */
  onParse: () => void
  /** Estimated duration for progress bar (ms) */
  estimatedDuration?: number
  /** Current progress (0-100) if known */
  actualProgress?: number
  /** Custom text for button states */
  buttonText?: {
    idle: string
    parsing: string
    complete: string
  }
  /** Whether to show visual pins/connections */
  showPins?: boolean
  /** Disabled state */
  disabled?: boolean
}

export function ParseButtonWithProgress({
  isParsing,
  isComplete = false,
  onParse,
  estimatedDuration = 30000, // 30 seconds default
  actualProgress,
  buttonText = {
    idle: 'Parse',
    parsing: 'Parsing...',
    complete: 'Parsed'
  },
  showPins = true,
  disabled = false
}: ParseButtonWithProgressProps) {
  const [progress, setProgress] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)

  // Handle progress calculation
  useEffect(() => {
    if (!isParsing) {
      setProgress(0)
      setStartTime(null)
      return
    }

    if (!startTime) {
      setStartTime(Date.now())
    }

    // If actual progress is provided, use it
    if (actualProgress !== undefined) {
      setProgress(Math.min(100, Math.max(0, actualProgress)))
      return
    }

    // Otherwise estimate based on time
    const interval = setInterval(() => {
      if (!startTime) return
      
      const elapsed = Date.now() - startTime
      const estimatedProgress = Math.min(90, (elapsed / estimatedDuration) * 100)
      setProgress(estimatedProgress)
    }, 100)

    return () => clearInterval(interval)
  }, [isParsing, actualProgress, estimatedDuration, startTime])

  // Complete the progress when done
  useEffect(() => {
    if (isComplete && progress < 100) {
      setProgress(100)
    }
  }, [isComplete, progress])

  const getButtonContent = () => {
    if (isComplete) {
      return (
        <>
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span>{buttonText.complete}</span>
        </>
      )
    }

    if (isParsing) {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{buttonText.parsing}</span>
        </>
      )
    }

    return (
      <>
        <Play className="w-4 h-4" />
        <span>{buttonText.idle}</span>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      {/* Visual Pins (optional) */}
      {showPins && (
        <div className="flex items-center justify-between relative">
          {/* Input Pin */}
          <div className={cn(
            "w-3 h-3 rounded-full border-2 transition-colors duration-300",
            isParsing ? "bg-blue-500 border-blue-500" : "bg-gray-300 border-gray-300"
          )} />
          
          {/* Connection Line */}
          <div className={cn(
            "flex-1 h-0.5 mx-2 transition-all duration-500",
            isParsing ? "bg-gradient-to-r from-blue-500 to-green-500" : "bg-gray-200"
          )}>
            {isParsing && (
              <div className="h-full bg-white/30 animate-pulse" />
            )}
          </div>
          
          {/* Output Pin */}
          <div className={cn(
            "w-3 h-3 rounded-full border-2 transition-colors duration-300",
            isComplete ? "bg-green-500 border-green-500" : 
            isParsing ? "bg-yellow-400 border-yellow-400" : "bg-gray-300 border-gray-300"
          )} />
        </div>
      )}

      {/* Button */}
      <Button
        onClick={onParse}
        disabled={disabled || isParsing}
        className={cn(
          "flex items-center gap-2 min-h-10 transition-all duration-200",
          isComplete && "bg-green-600 hover:bg-green-700 text-white"
        )}
        variant={isComplete ? "default" : "default"}
      >
        {getButtonContent()}
      </Button>

      {/* Progress Bar */}
      {(isParsing || isComplete) && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(progress)}%</span>
            {estimatedDuration && startTime && !isComplete && (
              <span>
                ~{Math.max(0, Math.round((estimatedDuration - (Date.now() - startTime)) / 1000))}s remaining
              </span>
            )}
            {isComplete && (
              <span className="text-green-600">Complete!</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}