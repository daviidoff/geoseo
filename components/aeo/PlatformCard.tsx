'use client'

import { memo } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { AIPlatform, PlatformStats } from '@/lib/types/mentions'

/**
 * Platform icons and colors configuration
 */
const PLATFORM_CONFIG: Record<AIPlatform, { icon: string; color: string; bgColor: string }> = {
  ChatGPT: {
    icon: '🤖',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
  },
  Perplexity: {
    icon: '🔍',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
  },
  Claude: {
    icon: '🧠',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
  },
  Gemini: {
    icon: '✨',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
  },
}

interface PlatformCardProps {
  platform: AIPlatform
  stats: PlatformStats
  isSelected?: boolean
  onClick?: () => void
}

/**
 * Get quality score color based on value
 */
function getQualityColor(score: number): string {
  if (score >= 8) return 'text-green-600 dark:text-green-400'
  if (score >= 6) return 'text-blue-600 dark:text-blue-400'
  if (score >= 4) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

/**
 * PlatformCard Component
 *
 * Displays aggregated stats for a single AI platform.
 * Used in the Mentions Dashboard to show performance across platforms.
 */
function PlatformCardComponent({
  platform,
  stats,
  isSelected = false,
  onClick,
}: PlatformCardProps) {
  const config = PLATFORM_CONFIG[platform]
  const successRate = stats.queriesChecked > 0
    ? Math.round((stats.successfulQueries / stats.queriesChecked) * 100)
    : 0

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all duration-200 hover:shadow-md',
        config.bgColor,
        isSelected && 'ring-2 ring-primary ring-offset-2',
        onClick && 'hover:scale-[1.02]'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl" role="img" aria-label={platform}>
            {config.icon}
          </span>
          <h4 className={cn('font-semibold', config.color)}>{platform}</h4>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{stats.totalMentions}</div>
          <div className="text-xs text-muted-foreground">mentions</div>
        </div>
      </div>

      {/* Quality Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">Quality Score</span>
          <span className={cn('font-semibold', getQualityColor(stats.averageQuality))}>
            {stats.averageQuality.toFixed(1)}/10
          </span>
        </div>
        <Progress
          value={stats.averageQuality * 10}
          className="h-2"
        />
      </div>

      {/* Presence Rate */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">Presence Rate</span>
          <span className="font-semibold">{stats.presenceRate}%</span>
        </div>
        <Progress
          value={stats.presenceRate}
          className="h-2"
        />
      </div>

      {/* Footer Stats */}
      <div className="pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Queries: </span>
          <span className="font-medium">{stats.queriesChecked}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Success: </span>
          <span className="font-medium">{successRate}%</span>
        </div>
        {stats.cost > 0 && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Cost: </span>
            <span className="font-medium">${stats.cost.toFixed(4)}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

export const PlatformCard = memo(PlatformCardComponent)
