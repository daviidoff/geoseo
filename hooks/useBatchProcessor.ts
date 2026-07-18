/**
 * Batch Processor Hook (localStorage auth - no Supabase Realtime)
 *
 * Architecture: Submit batch -> Poll for updates -> show results
 * Uses HTTP polling only (no Supabase Realtime WebSocket).
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { trackEvent, ANALYTICS_EVENTS } from '@/lib/analytics'
import type { ParsedCSV } from '@/lib/types'

export interface BatchResult {
  id: string
  input: Record<string, string>
  output: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  retryCount?: number
  input_tokens?: number
  output_tokens?: number
  model?: string
  tools_used?: string[]
}

export interface BatchProgress {
  completed: number
  total: number
  totalResults?: number
  percentage: number
}

export interface StartBatchParams {
  csvData: ParsedCSV
  prompt: string
  context?: string
  outputColumns: (string | { name: string; description?: string })[]
  tools?: string[]
  webhookUrl?: string
  testMode?: boolean
  selectedInputColumns?: string[]
}

export interface QueueInfo {
  position: number
  estimatedWaitSeconds: number
  estimatedWaitMinutes: number
  totalPending: number
  processingCount: number
  totalInQueue: number
}

export interface UseBatchProcessorReturn {
  batchId: string | null
  isProcessing: boolean
  isQueued: boolean
  queueInfo: QueueInfo | null
  results: BatchResult[]
  progress: BatchProgress | null
  error: string | null
  startBatch: (params: StartBatchParams) => Promise<void>
  cancelBatch: () => Promise<boolean>
  clearResults: () => void
  elapsedSeconds: number
}

const BATCH_ID_STORAGE_KEY = 'bulk-gpt-current-batch-id'
const BATCH_START_TIME_KEY = 'bulk-gpt-batch-start-time'
const BATCH_TOTAL_ROWS_KEY = 'bulk-gpt-batch-total-rows'
const MAX_PROCESSING_TIME_MS = 30 * 60 * 1000 // 30 minutes max
const POLL_INTERVAL_MS = 3000 // Poll every 3 seconds

function normalizeStatus(status: string): 'completed' | 'failed' | 'pending' {
  if (status === 'completed' || status === 'success') return 'completed'
  if (status === 'failed' || status === 'error') return 'failed'
  return 'pending'
}

export function useBatchProcessor(): UseBatchProcessorReturn {
  const [batchId, setBatchId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isQueued, setIsQueued] = useState(false)
  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null)
  const [results, setResults] = useState<BatchResult[]>([])
  const [progress, setProgress] = useState<BatchProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const batchTotalRef = useRef<number>(0)
  const batchIdRef = useRef<string | null>(null)
  const startTimeRef = useRef<number>(0)
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Keep ref in sync
  useEffect(() => {
    batchIdRef.current = batchId
  }, [batchId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
      }
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }, [])

  const startBatch = useCallback(async (params: StartBatchParams): Promise<void> => {
    const { csvData, prompt, context = '', outputColumns, webhookUrl, tools, testMode = false, selectedInputColumns } = params

    // Reset state
    stopPolling()
    setBatchId(null)
    batchIdRef.current = null
    setIsProcessing(true)
    setIsQueued(false)
    setQueueInfo(null)
    setError(null)
    setResults([])
    setProgress(null)
    batchTotalRef.current = 0
    startTimeRef.current = Date.now()

    try {
      sessionStorage.removeItem(BATCH_ID_STORAGE_KEY)
      sessionStorage.removeItem(BATCH_START_TIME_KEY)
      sessionStorage.removeItem(BATCH_TOTAL_ROWS_KEY)
    } catch { /* ignore */ }

    try {
      // Filter rows to selected columns
      let filteredRows: Record<string, string>[]
      if (selectedInputColumns && selectedInputColumns.length > 0) {
        filteredRows = csvData.rows.map((row) => {
          const filtered: Record<string, string> = {}
          selectedInputColumns.forEach(col => {
            if (col in row.data) filtered[col] = row.data[col]
          })
          return filtered
        })
      } else {
        filteredRows = csvData.rows.map(r => r.data)
      }

      // Submit batch to /api/process
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvFilename: csvData.filename,
          rows: filteredRows,
          prompt,
          context,
          outputColumns,
          tools: tools || undefined,
          webhookUrl: webhookUrl || undefined,
          testMode: testMode || undefined,
          selectedInputColumns: selectedInputColumns || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Processing failed')
      }

      const data = await response.json()

      // In localStorage mode, /api/process returns results directly
      if (data.results && Array.isArray(data.results)) {
        // Process completed synchronously
        const formattedResults: BatchResult[] = data.results.map((r: Record<string, unknown>, idx: number) => ({
          id: `row-${idx}`,
          input: r.input as Record<string, string> || {},
          output: typeof r.output === 'object' ? JSON.stringify(r.output) : String(r.output || ''),
          status: r.success ? 'completed' : 'failed',
          error: r.error as string | undefined,
        }))

        setResults(formattedResults)
        setIsProcessing(false)
        setProgress({
          completed: formattedResults.length,
          total: formattedResults.length,
          percentage: 100,
        })

        const failedCount = formattedResults.filter(r => r.status === 'failed').length
        if (failedCount > 0) {
          toast.success(`Completed ${formattedResults.length - failedCount} rows`, {
            description: `${failedCount} rows failed`
          })
        } else {
          toast.success(`Completed processing ${formattedResults.length} rows!`)
        }

        trackEvent(ANALYTICS_EVENTS.BATCH_COMPLETED, {
          batchId: data.batch_id,
          totalRows: formattedResults.length,
          hasErrors: failedCount > 0,
        })

        return
      }

      // If batch_id returned, processing is async (fallback mode)
      const newBatchId = data.batchId || data.batch_id
      if (newBatchId) {
        setBatchId(newBatchId)
        batchIdRef.current = newBatchId

        const actualRowCount = data.totalRows || filteredRows.length
        batchTotalRef.current = actualRowCount

        try {
          sessionStorage.setItem(BATCH_ID_STORAGE_KEY, newBatchId)
          sessionStorage.setItem(BATCH_START_TIME_KEY, String(startTimeRef.current))
          sessionStorage.setItem(BATCH_TOTAL_ROWS_KEY, String(actualRowCount))
        } catch { /* ignore */ }

        setProgress({
          completed: 0,
          total: actualRowCount,
          percentage: 0,
        })

        trackEvent(ANALYTICS_EVENTS.BATCH_STARTED, {
          batchId: newBatchId,
          rowCount: actualRowCount,
          testMode,
        })

        // Start polling for completion
        const pollForStatus = async () => {
          if (!batchIdRef.current || batchIdRef.current !== newBatchId) return

          try {
            const statusRes = await fetch(`/api/batch/${newBatchId}/status?limit=10000`)
            if (!statusRes.ok) {
              pollTimeoutRef.current = setTimeout(pollForStatus, POLL_INTERVAL_MS)
              return
            }

            const statusData = await statusRes.json()
            const { status, processedRows, totalRows, results: dbResults } = statusData

            const total = totalRows || actualRowCount
            const completed = processedRows || 0
            setProgress({
              completed,
              total,
              percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            })

            if (status === 'completed' || status === 'completed_with_errors') {
              const formattedResults = dbResults?.map((r: Record<string, unknown>, idx: number) => ({
                id: (r.id as string) || `${newBatchId}-row-${idx}`,
                input: (r.input as Record<string, string>) || {},
                output: (r.output as string) || '',
                status: normalizeStatus(r.status as string),
                error: r.error as string | undefined,
              })) || []

              setResults(formattedResults)
              setIsProcessing(false)
              setProgress({ completed: total, total, percentage: 100 })
              stopPolling()

              try {
                sessionStorage.removeItem(BATCH_ID_STORAGE_KEY)
                sessionStorage.removeItem(BATCH_START_TIME_KEY)
                sessionStorage.removeItem(BATCH_TOTAL_ROWS_KEY)
              } catch { /* ignore */ }

              const failedCount = formattedResults.filter((r: BatchResult) => r.status === 'failed').length
              if (failedCount > 0) {
                toast.success(`Completed ${total - failedCount} rows`, {
                  description: `${failedCount} rows failed`
                })
              } else {
                toast.success(`Completed processing ${total} rows!`)
              }
              return
            }

            if (status === 'failed') {
              setError('Batch processing failed')
              setIsProcessing(false)
              stopPolling()
              toast.error('Batch processing failed')
              return
            }

            // Continue polling
            pollTimeoutRef.current = setTimeout(pollForStatus, POLL_INTERVAL_MS)
          } catch (err) {
            console.error('[Poll] Error:', err)
            pollTimeoutRef.current = setTimeout(pollForStatus, POLL_INTERVAL_MS)
          }
        }

        pollTimeoutRef.current = setTimeout(pollForStatus, POLL_INTERVAL_MS)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Processing failed'
      setError(errorMessage)
      setIsProcessing(false)
      toast.error(errorMessage)

      trackEvent(ANALYTICS_EVENTS.BATCH_FAILED, {
        error: errorMessage,
      })
    }
  }, [stopPolling])

  const cancelBatch = useCallback(async () => {
    stopPolling()
    setIsProcessing(false)
    setIsQueued(false)
    setQueueInfo(null)

    const currentBatchId = batchIdRef.current
    let success = false

    if (currentBatchId) {
      try {
        const response = await fetch(`/api/batch/${currentBatchId}/cancel`, {
          method: 'POST',
        })
        success = response.ok
      } catch {
        // Ignore API errors
      }
    }

    setBatchId(null)
    batchTotalRef.current = 0

    try {
      sessionStorage.removeItem(BATCH_ID_STORAGE_KEY)
      sessionStorage.removeItem(BATCH_START_TIME_KEY)
      sessionStorage.removeItem(BATCH_TOTAL_ROWS_KEY)
    } catch { /* ignore */ }

    toast.info('Batch cancelled')
    return success
  }, [stopPolling])

  const clearResults = useCallback(() => {
    stopPolling()
    setResults([])
    setProgress(null)
    setError(null)
    setBatchId(null)
    setIsProcessing(false)

    try {
      sessionStorage.removeItem(BATCH_ID_STORAGE_KEY)
      sessionStorage.removeItem(BATCH_START_TIME_KEY)
      sessionStorage.removeItem(BATCH_TOTAL_ROWS_KEY)
    } catch { /* ignore */ }
  }, [stopPolling])

  // Calculate elapsed seconds for loading screen
  const elapsedSeconds = startTimeRef.current > 0
    ? Math.floor((Date.now() - startTimeRef.current) / 1000)
    : 0

  return {
    batchId,
    isProcessing,
    isQueued,
    queueInfo,
    results,
    progress,
    error,
    startBatch,
    cancelBatch,
    clearResults,
    elapsedSeconds,
  }
}
