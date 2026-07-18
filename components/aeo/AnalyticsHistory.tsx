/**
 * ABOUTME: Analytics History component - displays Health Check and Mentions history from Supabase
 * ABOUTME: Shows past health checks and mentions analyses with scores
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Trash2,
  Clock,
  Search,
  X,
  Activity,
  Target
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelativeTime } from '@/lib/utils/date'

interface HealthResult {
  overall_score: number
  category_scores?: {
    technical_seo: number
    structured_data: number
    ai_crawler_readiness: number
    authority_signals: number
  }
  checks?: Array<{
    name: string
    status: 'pass' | 'fail' | 'warning'
    score: number
  }>
}

interface MentionsResult {
  company_name?: string
  total_mentions?: number
  mentions?: number
  platform_results?: Array<{
    platform: string
    found: boolean
    mentions?: Array<{
      query: string
      mentioned: boolean
    }>
  }>
}

interface AnalyticsEntry {
  id: string
  created_at: string
  company: string | null
  url: string | null
  type: 'analytics'
  payload: {
    health_result?: HealthResult
    mentions_result?: MentionsResult
    check_type?: 'health' | 'mentions'
  }
}

export function AnalyticsHistory() {
  const [history, setHistory] = useState<AnalyticsEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history?limit=50&type=analytics')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch history')
      setHistory(data.history || [])
    } catch (error) {
      console.error('[ANALYTICS_HISTORY] Failed to fetch:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to fetch history')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this analytics result? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setHistory(prev => prev.filter(h => h.id !== id))
      toast.success('Deleted successfully')
    } catch (error) {
      toast.error('Failed to delete entry')
    }
  }

  const filteredHistory = history.filter(entry => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const company = entry.company?.toLowerCase() || ''
    const url = entry.url?.toLowerCase() || ''
    return company.includes(q) || url.includes(q)
  })


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Clock className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No analytics history yet</p>
        <p className="text-sm">Run Health Check or Mentions Check to see results here</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredHistory.map((entry) => {
          const healthResult = entry.payload?.health_result
          const mentionsResult = entry.payload?.mentions_result
          const isHealth = !!healthResult
          const isMentions = !!mentionsResult

          return (
            <div
              key={entry.id}
              className="border border-border rounded-lg bg-card overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isHealth && <Activity className="h-4 w-4 text-blue-500" />}
                    {isMentions && <Target className="h-4 w-4 text-purple-500" />}
                    <span className="font-medium truncate">
                      {entry.url || entry.company || 'Analytics'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isHealth ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'
                    }`}>
                      {isHealth ? 'Health Check' : 'Mentions'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(entry.created_at)}
                    </span>
                    {isHealth && healthResult?.overall_score !== undefined && (
                      <span className={`flex items-center gap-1 font-medium ${getScoreColor(healthResult.overall_score)}`}>
                        Score: {healthResult.overall_score.toFixed(1)}/100
                      </span>
                    )}
                    {isMentions && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-foreground">
                          {mentionsResult?.total_mentions ?? mentionsResult?.mentions ?? 0}
                        </span> mentions
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(entry.id)}
                    className="h-8 px-2 text-destructive hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AnalyticsHistory
