'use client'

import { useState, useCallback, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Upload,
  FileText,
  Play,
  Pause,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { BlogTone } from '@/lib/types/blogs'

/**
 * Status for individual blog items in batch
 */
type BatchItemStatus = 'pending' | 'generating' | 'completed' | 'failed'

/**
 * Single item in the batch queue
 */
interface BatchItem {
  id: string
  keyword: string
  title?: string
  instructions?: string
  status: BatchItemStatus
  progress: number
  result?: {
    title: string
    content: string
    wordCount: number
    aeoScore: number | null
  }
  error?: string
  startedAt?: string
  completedAt?: string
}

/**
 * Batch processing state
 */
interface BatchState {
  items: BatchItem[]
  isProcessing: boolean
  isPaused: boolean
  currentIndex: number
  startedAt: string | null
  completedAt: string | null
}

/**
 * CSV parsing result
 */
interface CSVParseResult {
  success: boolean
  data: Array<{ keyword: string; title?: string; instructions?: string }>
  errors: string[]
}

/**
 * Tone options for blog generation
 */
const TONE_OPTIONS: { value: BlogTone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'technical', label: 'Technical' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'friendly', label: 'Friendly' },
]

/**
 * Parse CSV content to extract keywords
 */
function parseCSV(content: string): CSVParseResult {
  const lines = content.split('\n').filter((line) => line.trim())
  const errors: string[] = []
  const data: Array<{ keyword: string; title?: string; instructions?: string }> = []

  if (lines.length < 2) {
    return {
      success: false,
      data: [],
      errors: ['CSV must have at least a header row and one data row'],
    }
  }

  // Parse header
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const keywordIndex = headers.findIndex((h) =>
    ['keyword', 'keywords', 'topic', 'topics'].includes(h)
  )
  const titleIndex = headers.findIndex((h) => ['title', 'heading'].includes(h))
  const instructionsIndex = headers.findIndex((h) =>
    ['instructions', 'notes', 'description'].includes(h)
  )

  if (keywordIndex === -1) {
    // Try first column as keyword
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim())
      if (values[0]) {
        data.push({
          keyword: values[0],
          title: values[1] || undefined,
          instructions: values[2] || undefined,
        })
      }
    }
  } else {
    // Use detected columns
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim())
      const keyword = values[keywordIndex]

      if (!keyword) {
        errors.push(`Row ${i + 1}: Missing keyword`)
        continue
      }

      data.push({
        keyword,
        title: titleIndex !== -1 ? values[titleIndex] : undefined,
        instructions: instructionsIndex !== -1 ? values[instructionsIndex] : undefined,
      })
    }
  }

  return {
    success: data.length > 0,
    data,
    errors,
  }
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Format duration in seconds to human readable
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

interface BatchBlogGeneratorProps {
  /** Default tone for all blogs */
  defaultTone?: BlogTone
  /** Default word count */
  defaultWordCount?: number
  /** Language for generation */
  language?: string
  /** Country for generation */
  country?: string
  /** Callback when batch completes */
  onBatchComplete?: (results: BatchItem[]) => void
  /** Additional className */
  className?: string
}

/**
 * BatchBlogGenerator Component
 *
 * Allows users to upload a CSV of keywords and generate multiple
 * blog posts in batch with progress tracking.
 */
export function BatchBlogGenerator({
  defaultTone = 'professional',
  defaultWordCount = 1500,
  language = 'en',
  country = 'US',
  onBatchComplete,
  className,
}: BatchBlogGeneratorProps) {
  // Configuration state
  const [tone, setTone] = useState<BlogTone>(defaultTone)
  const [wordCount, setWordCount] = useState(defaultWordCount)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Batch state
  const [batch, setBatch] = useState<BatchState>({
    items: [],
    isProcessing: false,
    isPaused: false,
    currentIndex: 0,
    startedAt: null,
    completedAt: null,
  })

  // Computed values
  const stats = useMemo(() => {
    const total = batch.items.length
    const completed = batch.items.filter((i) => i.status === 'completed').length
    const failed = batch.items.filter((i) => i.status === 'failed').length
    const pending = batch.items.filter((i) => i.status === 'pending').length
    const generating = batch.items.filter((i) => i.status === 'generating').length
    const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0

    return { total, completed, failed, pending, generating, progress }
  }, [batch.items])

  /**
   * Handle CSV file upload
   */
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      if (!file.name.endsWith('.csv')) {
        toast.error('Please upload a CSV file')
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB')
        return
      }

      setCsvFile(file)

      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        const result = parseCSV(content)

        if (!result.success) {
          toast.error(result.errors[0] || 'Failed to parse CSV')
          return
        }

        if (result.errors.length > 0) {
          toast.warning(`Parsed with ${result.errors.length} warnings`)
        }

        // Create batch items
        const items: BatchItem[] = result.data.map((row) => ({
          id: generateId(),
          keyword: row.keyword,
          title: row.title,
          instructions: row.instructions,
          status: 'pending',
          progress: 0,
        }))

        setBatch({
          items,
          isProcessing: false,
          isPaused: false,
          currentIndex: 0,
          startedAt: null,
          completedAt: null,
        })

        toast.success(`Loaded ${items.length} keywords from CSV`)
      }

      reader.onerror = () => {
        toast.error('Failed to read file')
      }

      reader.readAsText(file)
    },
    []
  )

  /**
   * Process a single blog item
   */
  const processItem = useCallback(
    async (item: BatchItem): Promise<BatchItem> => {
      try {
        const response = await fetch('/api/generate-blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyword: item.keyword,
            title: item.title,
            word_count: wordCount,
            tone,
            language,
            country,
            additional_instructions: item.instructions,
          }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(error.error || `HTTP ${response.status}`)
        }

        const result = await response.json()

        return {
          ...item,
          status: 'completed',
          progress: 100,
          result: {
            title: result.title || item.keyword,
            content: result.content || '',
            wordCount: result.metadata?.word_count || wordCount,
            aeoScore: result.metadata?.aeo_score || null,
          },
          completedAt: new Date().toISOString(),
        }
      } catch (error) {
        return {
          ...item,
          status: 'failed',
          progress: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date().toISOString(),
        }
      }
    },
    [wordCount, tone, language, country]
  )

  /**
   * Start batch processing
   */
  const startBatch = useCallback(async () => {
    if (batch.items.length === 0) {
      toast.error('No items to process')
      return
    }

    setBatch((prev) => ({
      ...prev,
      isProcessing: true,
      isPaused: false,
      startedAt: new Date().toISOString(),
    }))

    toast.info(`Starting batch generation of ${batch.items.length} blogs...`)

    for (let i = batch.currentIndex; i < batch.items.length; i++) {
      // Check if paused
      const currentBatch = batch
      if (currentBatch.isPaused) {
        setBatch((prev) => ({ ...prev, currentIndex: i }))
        return
      }

      // Update current item to generating
      setBatch((prev) => ({
        ...prev,
        currentIndex: i,
        items: prev.items.map((item, idx) =>
          idx === i
            ? { ...item, status: 'generating', startedAt: new Date().toISOString() }
            : item
        ),
      }))

      // Process the item
      const result = await processItem(batch.items[i])

      // Update with result
      setBatch((prev) => ({
        ...prev,
        items: prev.items.map((item, idx) => (idx === i ? result : item)),
      }))

      // Small delay between items to avoid rate limiting
      if (i < batch.items.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    // Batch complete
    setBatch((prev) => ({
      ...prev,
      isProcessing: false,
      completedAt: new Date().toISOString(),
    }))

    const finalStats = batch.items.reduce(
      (acc, item) => {
        if (item.status === 'completed') acc.completed++
        if (item.status === 'failed') acc.failed++
        return acc
      },
      { completed: 0, failed: 0 }
    )

    toast.success(
      `Batch complete: ${finalStats.completed} succeeded, ${finalStats.failed} failed`
    )

    if (onBatchComplete) {
      onBatchComplete(batch.items)
    }
  }, [batch, processItem, onBatchComplete])

  /**
   * Pause batch processing
   */
  const pauseBatch = useCallback(() => {
    setBatch((prev) => ({ ...prev, isPaused: true }))
    toast.info('Batch paused')
  }, [])

  /**
   * Resume batch processing
   */
  const resumeBatch = useCallback(() => {
    setBatch((prev) => ({ ...prev, isPaused: false }))
    startBatch()
  }, [startBatch])

  /**
   * Cancel batch processing
   */
  const cancelBatch = useCallback(() => {
    setBatch((prev) => ({
      ...prev,
      isProcessing: false,
      isPaused: false,
    }))
    toast.info('Batch cancelled')
  }, [])

  /**
   * Reset batch
   */
  const resetBatch = useCallback(() => {
    setBatch({
      items: [],
      isProcessing: false,
      isPaused: false,
      currentIndex: 0,
      startedAt: null,
      completedAt: null,
    })
    setCsvFile(null)
  }, [])

  /**
   * Retry failed items
   */
  const retryFailed = useCallback(() => {
    setBatch((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.status === 'failed'
          ? { ...item, status: 'pending', progress: 0, error: undefined }
          : item
      ),
      currentIndex: prev.items.findIndex((item) => item.status === 'failed'),
    }))
    startBatch()
  }, [startBatch])

  /**
   * Remove item from batch
   */
  const removeItem = useCallback((id: string) => {
    setBatch((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }))
  }, [])

  /**
   * Export results
   */
  const exportResults = useCallback(() => {
    const completed = batch.items.filter((i) => i.status === 'completed' && i.result)
    if (completed.length === 0) {
      toast.error('No completed blogs to export')
      return
    }

    const csvContent = [
      ['Keyword', 'Title', 'Word Count', 'AEO Score', 'Content'].join(','),
      ...completed.map((item) =>
        [
          `"${item.keyword}"`,
          `"${item.result?.title || ''}"`,
          item.result?.wordCount || '',
          item.result?.aeoScore || '',
          `"${(item.result?.content || '').replace(/"/g, '""').substring(0, 500)}..."`,
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-blogs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast.success('Results exported')
  }, [batch.items])

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Batch Blog Generator
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload a CSV with keywords to generate multiple blogs at once
          </p>
        </div>
        {batch.items.length > 0 && !batch.isProcessing && (
          <Button variant="outline" size="sm" onClick={resetBatch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        )}
      </div>

      {/* Upload Section */}
      {batch.items.length === 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            {/* File Upload Zone */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                'hover:border-primary/50 hover:bg-primary/5',
                csvFile && 'border-primary bg-primary/5'
              )}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">
                  {csvFile ? csvFile.name : 'Drop CSV file here or click to upload'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  CSV with columns: keyword (required), title, instructions
                </p>
              </label>
            </div>

            {/* Sample CSV Format */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">CSV Format Example:</h4>
              <code className="text-xs text-muted-foreground block">
                keyword,title,instructions
                <br />
                AI automation 2025,How AI is Changing Business,Focus on SMBs
                <br />
                Machine learning basics,,Include examples
                <br />
                Data analytics trends,Top 10 Trends,
              </code>
            </div>

            {/* Advanced Settings Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full"
            >
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 mr-2" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-2" />
              )}
              Advanced Settings
            </Button>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="tone">Tone</Label>
                  <select
                    id="tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value as BlogTone)}
                    className="w-full h-10 px-3 border border-input rounded-md bg-background"
                  >
                    {TONE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wordCount">Word Count</Label>
                  <Input
                    id="wordCount"
                    type="number"
                    value={wordCount}
                    onChange={(e) => setWordCount(parseInt(e.target.value) || 1500)}
                    min={500}
                    max={5000}
                    step={100}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Batch Queue */}
      {batch.items.length > 0 && (
        <>
          {/* Progress Overview */}
          <Card className="p-4">
            <div className="space-y-4">
              {/* Stats Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.generating}</div>
                    <div className="text-xs text-muted-foreground">Generating</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {!batch.isProcessing && stats.completed === 0 && (
                    <Button onClick={startBatch}>
                      <Play className="h-4 w-4 mr-2" />
                      Start Batch
                    </Button>
                  )}
                  {batch.isProcessing && !batch.isPaused && (
                    <Button variant="outline" onClick={pauseBatch}>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  {batch.isPaused && (
                    <Button onClick={resumeBatch}>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  )}
                  {batch.isProcessing && (
                    <Button variant="destructive" onClick={cancelBatch}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                  {!batch.isProcessing && stats.failed > 0 && (
                    <Button variant="outline" onClick={retryFailed}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Failed ({stats.failed})
                    </Button>
                  )}
                  {!batch.isProcessing && stats.completed > 0 && (
                    <Button variant="outline" onClick={exportResults}>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{stats.progress}%</span>
                </div>
                <Progress value={stats.progress} className="h-2" />
              </div>
            </div>
          </Card>

          {/* Queue Items */}
          <div className="space-y-2">
            {batch.items.map((item, index) => (
              <Card
                key={item.id}
                className={cn(
                  'p-4 transition-all',
                  item.status === 'generating' && 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
                  item.status === 'completed' && 'border-green-500/50',
                  item.status === 'failed' && 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {item.status === 'pending' && (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                      {item.status === 'generating' && (
                        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                      )}
                      {item.status === 'completed' && (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      )}
                      {item.status === 'failed' && (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">#{index + 1}</span>
                        <span className="font-medium truncate">{item.keyword}</span>
                      </div>
                      {item.title && (
                        <p className="text-sm text-muted-foreground truncate">{item.title}</p>
                      )}
                      {item.error && (
                        <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {item.error}
                        </p>
                      )}
                      {item.result && (
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{item.result.wordCount} words</span>
                          {item.result.aeoScore && (
                            <span className="text-green-600">AEO: {item.result.aeoScore}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        item.status === 'pending' && 'bg-muted text-muted-foreground',
                        item.status === 'generating' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                        item.status === 'completed' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                        item.status === 'failed' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {item.status}
                    </Badge>
                    {!batch.isProcessing && item.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress for generating items */}
                {item.status === 'generating' && (
                  <div className="mt-3">
                    <Progress value={item.progress} className="h-1" />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {batch.items.length === 0 && !csvFile && (
        <EmptyState
          icon={FileText}
          title="No Batch Started"
          description="Upload a CSV file with keywords to start generating blogs in bulk"
          size="sm"
        />
      )}
    </div>
  )
}
