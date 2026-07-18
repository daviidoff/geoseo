/**
 * ABOUTME: Batch Processing API (localStorage-based auth)
 * ABOUTME: Processes batches using shared Gemini client - no database storage for results
 */

import { NextRequest, NextResponse } from 'next/server'
import { validatePrompt } from '@/lib/validation'
import { checkRateLimits, releaseBatch } from '@/middleware/rateLimits'
import { logError, logDebug } from '@/lib/utils/logger'
import { checkUsageLimits } from '@/lib/api-keys'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { getGeminiClient } from '@/lib/gemini'

export const maxDuration = 300 // Max 5 minutes (Render allows up to 5 minutes)

// INPUT VALIDATION HELPERS
function validateBatchRows(rows: unknown[]): void {
  const MAX_ROWS = 10000
  if (rows.length > MAX_ROWS) {
    throw new Error(`Maximum ${MAX_ROWS} rows allowed per batch`)
  }

  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`Row ${index} must be an object`)
    }

    const keys = Object.keys(row as object)
    if (keys.length === 0) {
      throw new Error(`Row ${index} cannot be empty`)
    }

    keys.forEach((key) => {
      const value = (row as Record<string, unknown>)[key]
      if (value !== null && value !== undefined && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        throw new Error(`Row ${index} field "${key}" must be a string, number, or boolean`)
      }
    })
  })
}

function validateOutputColumns(cols: unknown[]): void {
  const MAX_COLS = 50
  if (cols.length > MAX_COLS) {
    throw new Error(`Maximum ${MAX_COLS} output columns allowed`)
  }

  cols.forEach((col, index) => {
    let colName: string
    if (typeof col === 'string') {
      colName = col
    } else if (col && typeof col === 'object' && 'name' in col && typeof (col as { name: unknown }).name === 'string') {
      colName = (col as { name: string }).name
    } else {
      throw new Error(`Column ${index} must be a string or object with 'name' property`)
    }

    if (colName.length === 0) {
      throw new Error(`Column ${index} name cannot be empty`)
    }
    if (colName.length > 255) {
      throw new Error(`Column ${index} name cannot exceed 255 characters`)
    }
    if (!/^[a-zA-Z0-9_\s-]+$/.test(colName)) {
      throw new Error(`Column ${index} name contains invalid characters`)
    }
  })
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest): Promise<Response> {
  const userId = 'local-user' // Default user for localStorage auth

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.csvFilename || typeof body.csvFilename !== 'string') {
      return NextResponse.json(
        { error: 'csvFilename is required and must be a string' },
        { status: 400 }
      )
    }

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json(
        { error: 'rows is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    try {
      validatePrompt(body.prompt)
    } catch {
      return NextResponse.json(
        { error: 'prompt is required and cannot be empty' },
        { status: 400 }
      )
    }

    const { csvFilename, rows: originalRows, prompt, context = '', outputColumns = [], tools = [], testMode = false } = body

    // AUTO-TRUNCATE to 1000 rows (beta limit)
    const MAX_ROWS_PER_BATCH = 1000
    const wasTruncated = originalRows.length > MAX_ROWS_PER_BATCH
    const rows = wasTruncated ? originalRows.slice(0, MAX_ROWS_PER_BATCH) : originalRows

    if (wasTruncated) {
      logDebug('[PROCESS] Auto-truncated rows to beta limit', {
        original: originalRows.length,
        truncated: rows.length,
        limit: MAX_ROWS_PER_BATCH
      })
    }

    // Filter out disabled tools
    const enabledTools = isFeatureEnabled('WEB_SEARCH_ENABLED')
      ? tools
      : tools.filter((tool: string) => tool !== 'web-search')

    // Validate batch rows structure
    try {
      validateBatchRows(rows)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid row structure' },
        { status: 400 }
      )
    }

    // Validate output columns if provided
    if (Array.isArray(outputColumns) && outputColumns.length > 0) {
      try {
        validateOutputColumns(outputColumns)
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Invalid output columns' },
          { status: 400 }
        )
      }
    }

    // Check usage limits (mock - always allows in local mode)
    const usageLimitCheck = await checkUsageLimits(userId, rows.length, testMode)
    if (!usageLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: usageLimitCheck.reason,
          testMode
        },
        { status: 429 }
      )
    }

    // Check rate limits
    const rateLimitCheck = await checkRateLimits(userId, rows.length)
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: rateLimitCheck.reason,
          limit: rateLimitCheck.limit,
          current: rateLimitCheck.current,
          beta: true
        },
        { status: 429 }
      )
    }

    // Generate batch ID
    const batchId = `batch_${crypto.randomUUID()}`

    // Process rows in parallel using Gemini API
    console.log(`[BATCH] Processing ${rows.length} rows in parallel...`)

    const batchStartTime = Date.now()

    // Process all rows in parallel
    const results = await Promise.all(
      rows.map(async (row: Record<string, unknown>, index: number) => {
        try {
          const rowStartTime = Date.now()

          // Replace template variables in prompt
          let processedPrompt = prompt
          for (const [key, value] of Object.entries(row)) {
            processedPrompt = processedPrompt.replace(
              new RegExp(`{{${key}}}`, 'g'),
              String(value)
            )
          }

          // Add context if provided
          if (context) {
            processedPrompt = `Context: ${context}\n\n${processedPrompt}`
          }

          // Use shared Gemini client (DRY, uses gemini-3-flash-preview)
          const geminiClient = getGeminiClient()
          if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY not configured')
          }
          // Ensure client is initialized
          try {
            geminiClient.getRemainingRequests()
          } catch {
            geminiClient.initialize(process.env.GEMINI_API_KEY)
          }
          const response = await geminiClient.processRow(processedPrompt, {})

          const rowDuration = Date.now() - rowStartTime

          console.log(`[BATCH] Row ${index + 1}/${rows.length} completed in ${rowDuration}ms`)

          return {
            row_index: index,
            input: row,
            output: { response },
            status: 'completed',
            success: true,
            duration_ms: rowDuration,
          }
        } catch (error) {
          console.error(`[BATCH] Row ${index} failed:`, error)

          return {
            row_index: index,
            input: row,
            output: { error: error instanceof Error ? error.message : 'Unknown error' },
            status: 'failed',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      })
    )

    const totalDuration = Date.now() - batchStartTime
    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    console.log(`[BATCH] Completed in ${totalDuration}ms. Success: ${successCount}, Failed: ${failedCount}`)

    // Release rate limit
    releaseBatch(userId)

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      message: 'Batch processing completed',
      results: results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failedCount,
      },
      duration_ms: totalDuration,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logError('Process API error', error, {
      source: 'api/process/POST',
      userId
    })
    releaseBatch(userId)
    return NextResponse.json(
      {
        error: 'Failed to process batch',
        details: message,
      },
      { status: 500 }
    )
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST /api/process to start a batch' },
    { status: 405 }
  )
}
