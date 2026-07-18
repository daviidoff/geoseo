'use client'

import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'

interface TimeEstimateProps {
  percent: number
  className?: string
}

export function TimeEstimate({ percent, className }: TimeEstimateProps) {
  // Estimate remaining time based on progress
  // Assume total time is ~2-3 minutes for keyword/blog generation
  const estimateRemaining = () => {
    if (percent >= 95) return '< 1 min'
    if (percent >= 80) return '~ 1 min'
    if (percent >= 60) return '~ 2 mins'
    if (percent >= 40) return '~ 3 mins'
    if (percent >= 20) return '~ 4 mins'
    if (percent >= 10) return '~ 5 mins'
    return '~ 5 mins'
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground tabular-nums">
        {estimateRemaining()}
      </span>
    </div>
  )
}
