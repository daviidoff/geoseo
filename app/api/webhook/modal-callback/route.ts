/**
 * ABOUTME: Webhook endpoint for Modal batch processing completion (localStorage-based auth)
 * ABOUTME: Mock implementation - no database storage for webhook results
 */

import { NextRequest, NextResponse } from 'next/server'
import { logError, logDebug, logWarning } from '@/lib/utils/logger'
import { devLog } from '@/lib/dev-logger'

export const maxDuration = 300 // 5 minutes to process webhook

/**
 * POST /api/webhook/modal-callback
 *
 * Webhook endpoint for Modal to call when batch processing completes.
 *
 * In localStorage mode, we just log the results without storing them.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now()

  try {
    // SECURITY: Webhook secret validation is REQUIRED in production
    const webhookSecret = process.env.MODAL_WEBHOOK_SECRET
    const isProduction = process.env.NODE_ENV === 'production'

    if (!webhookSecret && isProduction) {
      logError('[WEBHOOK] CRITICAL: MODAL_WEBHOOK_SECRET not configured in production!')
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      )
    }

    if (webhookSecret) {
      const providedSecret = request.headers.get('x-webhook-secret')
      if (!providedSecret || providedSecret !== webhookSecret) {
        logWarning('[WEBHOOK] Invalid or missing webhook secret', {
          hasSecret: !!providedSecret,
        })
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      logDebug('[WEBHOOK] Webhook secret validated')
    } else {
      logWarning('[WEBHOOK] Webhook secret validation skipped (dev mode only)')
    }

    logDebug('\n[WEBHOOK] ========== Modal Callback Received ==========')
    logDebug(`[WEBHOOK] Timestamp: ${new Date().toISOString()}`)

    // Parse webhook payload
    const payload = await request.json()
    logDebug('[WEBHOOK] Payload keys:', Object.keys(payload))

    const { batch_id, results, status, total_rows, successful, failed } = payload

    if (!batch_id) {
      logError('[WEBHOOK] Missing batch_id in payload')
      return NextResponse.json(
        { error: 'Missing batch_id' },
        { status: 400 }
      )
    }

    logDebug(`[WEBHOOK] Batch ID: ${batch_id}`)
    logDebug(`[WEBHOOK] Status: ${status}`)
    logDebug(`[WEBHOOK] Total rows: ${total_rows}`)
    logDebug(`[WEBHOOK] Results count: ${results?.length || 0}`)

    // In localStorage mode, we just log the results
    if (results && Array.isArray(results)) {
      logDebug(`[WEBHOOK] Received ${results.length} results (not stored - localStorage mode)`)
    }

    const duration = Date.now() - startTime

    logDebug(`[WEBHOOK] ========== Webhook Processed Successfully ==========`)
    logDebug(`[WEBHOOK] Duration: ${duration}ms`)

    devLog.log(`Modal webhook received for batch ${batch_id}: ${status}`, {
      totalRows: total_rows,
      successful,
      failed,
      duration
    })

    return NextResponse.json({
      success: true,
      batch_id,
      message: 'Webhook received (localStorage mode - results not persisted)',
      rowsProcessed: total_rows,
      status: status === 'completed' ? 'completed' : 'completed_with_errors'
    })

  } catch (error) {
    const duration = Date.now() - startTime

    logError('Webhook processing failed', error, {
      source: 'api/webhook/modal-callback',
      duration,
      errorType: typeof error,
      errorString: String(error),
    })

    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null
      ? JSON.stringify(error)
      : String(error)

    // SECURITY: Don't leak error details to external callers
    const isProduction = process.env.NODE_ENV === 'production'
    return NextResponse.json(
      {
        error: 'Failed to process webhook',
        ...(isProduction ? {} : { details: errorMessage })
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler - return webhook info
 */
export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      endpoint: '/api/webhook/modal-callback',
      method: 'POST',
      description: 'Webhook endpoint for Modal batch processing completion',
      note: 'Running in localStorage mode - results are not persisted',
      expected_payload: {
        batch_id: 'string',
        status: 'completed | failed',
        total_rows: 'number',
        successful: 'number',
        failed: 'number',
        results: 'array'
      }
    },
    { status: 200 }
  )
}
