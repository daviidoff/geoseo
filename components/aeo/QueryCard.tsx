'use client'

import { memo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QueryResult, MentionType, AIPlatform } from '@/lib/types/mentions'

/**
 * Mention type styling configuration
 */
const MENTION_TYPE_STYLES: Record<MentionType, string> = {
  primary: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  contextual: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  competitive: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  passing: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  none: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

/**
 * Platform badge colors
 */
const PLATFORM_COLORS: Record<AIPlatform, string> = {
  ChatGPT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Perplexity: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Claude: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  Gemini: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

interface QueryCardProps {
  result: QueryResult
  companyName: string
  isExpanded?: boolean
  onToggleExpand?: () => void
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
 * Get status icon component
 */
function StatusIcon({ status }: { status: QueryResult['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-600" />
    case 'processing':
      return <AlertCircle className="h-4 w-4 text-yellow-600 animate-pulse" />
    default:
      return <AlertCircle className="h-4 w-4 text-gray-400" />
  }
}

/**
 * Highlight company name in response text
 */
function highlightCompanyName(text: string, companyName: string): JSX.Element {
  if (!text || !companyName) {
    return <>{text}</>
  }

  const regex = new RegExp(`(${companyName})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === companyName.toLowerCase() ? (
          <mark
            key={index}
            className="bg-yellow-200 dark:bg-yellow-800/50 px-0.5 rounded font-medium"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  )
}

/**
 * QueryCard Component
 *
 * Displays the result of a single query check.
 * Shows platform, mentions, quality score, and expandable response details.
 */
function QueryCardComponent({
  result,
  companyName,
  isExpanded: controlledExpanded,
  onToggleExpand,
}: QueryCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const isExpanded = controlledExpanded ?? internalExpanded
  const toggleExpand = onToggleExpand ?? (() => setInternalExpanded(!internalExpanded))

  const hasMentions = result.cappedMentions > 0
  const hasCompetitors = result.competitorMentions.length > 0

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-200',
        hasMentions ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-gray-300'
      )}
    >
      {/* Header - Always visible */}
      <button
        className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={toggleExpand}
        aria-expanded={isExpanded}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Query info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon status={result.status} />
              <h4 className="font-medium text-sm truncate">{result.query}</h4>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={PLATFORM_COLORS[result.platform]}>
                {result.platform}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {result.dimension}
              </Badge>
              <Badge className={MENTION_TYPE_STYLES[result.mentionType]}>
                {result.mentionType}
              </Badge>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right">
              <div className="text-lg font-bold">
                {result.cappedMentions}
              </div>
              <div className="text-xs text-muted-foreground">
                mention{result.cappedMentions !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="text-right">
              <div className={cn('text-lg font-bold', getQualityColor(result.qualityScore))}>
                {result.qualityScore.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">quality</div>
            </div>
            <div className="text-muted-foreground">
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border/50 space-y-4">
          {/* Response text */}
          {result.responseText && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2">
                AI Response
              </h5>
              <div className="text-sm p-3 bg-muted/50 rounded-md max-h-48 overflow-y-auto">
                {highlightCompanyName(result.responseText, companyName)}
              </div>
            </div>
          )}

          {/* Position info */}
          {result.position && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Position in response:</span>
              <Badge variant="outline">#{result.position}</Badge>
            </div>
          )}

          {/* Competitor mentions */}
          {hasCompetitors && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2">
                Competitors Also Mentioned
              </h5>
              <div className="flex flex-wrap gap-2">
                {result.competitorMentions.map((comp, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="bg-yellow-50 dark:bg-yellow-900/20"
                  >
                    {comp.name} ({comp.count})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Source URLs */}
          {result.sourceUrls.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2">
                Sources ({result.sourceUrls.length})
              </h5>
              <div className="space-y-1">
                {result.sourceUrls.slice(0, 5).map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{url}</span>
                  </a>
                ))}
                {result.sourceUrls.length > 5 && (
                  <span className="text-xs text-muted-foreground">
                    +{result.sourceUrls.length - 5} more sources
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
            Checked: {new Date(result.checkedAt).toLocaleString()}
          </div>
        </div>
      )}
    </Card>
  )
}

export const QueryCard = memo(QueryCardComponent)
