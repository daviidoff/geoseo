/**
 * ABOUTME: Keywords History component - displays previously generated keywords from Supabase
 * ABOUTME: Allows viewing, exporting (CSV/XLSX), and deleting keyword history entries
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Download,
  Trash2,
  Clock,
  Search,
  X,
  Globe,
  Flag,
  FileSpreadsheet,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { formatRelativeTime } from '@/lib/utils/date'
import { downloadXLSX } from '@/lib/export'

interface KeywordEntry {
  keyword: string
  volume?: number
  difficulty?: number
  intent?: string
  aeo_score?: number
  category?: string
}

interface KeywordsGeneration {
  id: string
  created_at: string
  company: string | null
  url: string | null
  payload: {
    keywords?: KeywordEntry[]
    language?: string
    country?: string
    seed_keyword?: string
  }
}

export function KeywordsHistory() {
  const [history, setHistory] = useState<KeywordsGeneration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history?limit=50&type=keywords')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch history')
      setHistory(data.history || [])
    } catch (error) {
      console.error('[KEYWORDS_HISTORY] Failed to fetch:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to fetch history')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this keyword generation? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setHistory(prev => prev.filter(h => h.id !== id))
      toast.success('Deleted successfully')
    } catch (error) {
      toast.error('Failed to delete entry')
    }
  }

  const handleExportXLSX = (entry: KeywordsGeneration) => {
    const keywords = entry.payload?.keywords || []
    if (keywords.length === 0) {
      toast.error('No keywords to export')
      return
    }

    const data = keywords.map(kw => ({
      Keyword: kw.keyword,
      'Search Volume': kw.volume ?? '',
      Difficulty: kw.difficulty ?? '',
      Intent: kw.intent ?? '',
      'AEO Score': kw.aeo_score ?? '',
      Category: kw.category ?? ''
    }))

    const filename = `keywords-${entry.payload?.seed_keyword || 'export'}-${new Date(entry.created_at).toISOString().split('T')[0]}`
    downloadXLSX(data, filename)
    toast.success('Exported to XLSX')
  }

  const handleExportCSV = (entry: KeywordsGeneration) => {
    const keywords = entry.payload?.keywords || []
    if (keywords.length === 0) {
      toast.error('No keywords to export')
      return
    }

    const data = keywords.map(kw => ({
      Keyword: kw.keyword,
      'Search Volume': kw.volume ?? '',
      Difficulty: kw.difficulty ?? '',
      Intent: kw.intent ?? '',
      'AEO Score': kw.aeo_score ?? '',
      Category: kw.category ?? ''
    }))

    // Generate CSV
    const headers = Object.keys(data[0] || {})
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h as keyof typeof row] ?? ''}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const filename = `keywords-${entry.payload?.seed_keyword || 'export'}-${new Date(entry.created_at).toISOString().split('T')[0]}.csv`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Exported to CSV')
  }

  const filteredHistory = history.filter(entry => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const seedKeyword = entry.payload?.seed_keyword?.toLowerCase() || ''
    const company = entry.company?.toLowerCase() || ''
    return seedKeyword.includes(q) || company.includes(q)
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
        <p className="text-lg font-medium">No keyword history yet</p>
        <p className="text-sm">Generate keywords to see them here</p>
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
            placeholder="Search by keyword or company..."
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
          const keywords = entry.payload?.keywords || []
          const keywordCount = keywords.length
          const isExpanded = expandedId === entry.id

          return (
            <div
              key={entry.id}
              className="border border-border rounded-lg bg-card overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">
                      {entry.payload?.seed_keyword || entry.company || 'Keywords'}
                    </span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {keywordCount} keywords
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(entry.created_at)}
                    </span>
                    {entry.payload?.language && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {entry.payload.language}
                      </span>
                    )}
                    {entry.payload?.country && (
                      <span className="flex items-center gap-1">
                        <Flag className="h-3 w-3" />
                        {entry.payload.country}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="h-8 px-2"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 flex items-center gap-1"
                      >
                        <Download className="h-4 w-4" />
                        Download
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExportXLSX(entry)}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel (.xlsx)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportCSV(entry)}>
                        <FileText className="h-4 w-4 mr-2" />
                        CSV (.csv)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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

              {/* Expanded Content */}
              {isExpanded && keywords.length > 0 && (
                <div className="border-t border-border bg-muted/30 p-4 max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {keywords.slice(0, 30).map((kw, idx) => (
                      <div
                        key={idx}
                        className="text-sm px-2 py-1 bg-background rounded border border-border/50 truncate"
                        title={kw.keyword}
                      >
                        {kw.keyword}
                        {kw.aeo_score && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            AEO: {kw.aeo_score}
                          </span>
                        )}
                      </div>
                    ))}
                    {keywords.length > 30 && (
                      <div className="text-sm text-muted-foreground px-2 py-1">
                        +{keywords.length - 30} more...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default KeywordsHistory
