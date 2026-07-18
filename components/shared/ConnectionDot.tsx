'use client'

import { cn } from '@/lib/utils'

interface ConnectionDotProps {
  connected: boolean
  className?: string
}

export function ConnectionDot({ connected, className }: ConnectionDotProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "w-2 h-2 rounded-full transition-colors",
          connected
            ? "bg-emerald-500 animate-pulse"
            : "bg-muted-foreground/30"
        )}
      />
      <span className="text-xs text-muted-foreground">
        {connected ? 'Live' : 'Disconnected'}
      </span>
    </div>
  )
}
