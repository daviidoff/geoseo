'use client'

import { cn } from '@/lib/utils'
import { Search, BookOpen, PenTool, FileCheck, Zap } from 'lucide-react'

interface PhaseIndicatorProps {
  phase: string
  className?: string
}

const PHASE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  'initializing': {
    label: 'Initializing',
    icon: <Zap className="h-3.5 w-3.5" />,
    color: 'text-blue-500'
  },
  'research': {
    label: 'Research',
    icon: <Search className="h-3.5 w-3.5" />,
    color: 'text-blue-500'
  },
  'analysis': {
    label: 'Analysis',
    icon: <BookOpen className="h-3.5 w-3.5" />,
    color: 'text-emerald-500'
  },
  'writing': {
    label: 'Writing',
    icon: <PenTool className="h-3.5 w-3.5" />,
    color: 'text-purple-500'
  },
  'compiling': {
    label: 'Compiling',
    icon: <FileCheck className="h-3.5 w-3.5" />,
    color: 'text-amber-500'
  },
  'complete': {
    label: 'Complete',
    icon: <FileCheck className="h-3.5 w-3.5" />,
    color: 'text-emerald-500'
  }
}

export function PhaseIndicator({ phase, className }: PhaseIndicatorProps) {
  const config = PHASE_CONFIG[phase.toLowerCase()] || PHASE_CONFIG['initializing']

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("flex-shrink-0", config.color)}>
        {config.icon}
      </span>
      <span className="text-xs font-medium text-foreground">
        {config.label}
      </span>
    </div>
  )
}
