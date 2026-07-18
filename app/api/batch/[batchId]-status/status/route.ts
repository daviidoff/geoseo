/**
 * ABOUTME: Batch Status API (localStorage-based auth)
 * ABOUTME: Returns mock batch status - no database storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/utils/logger'
import { authenticateRequest } from '@/lib/auth-middleware'

export const maxDuration = 60

/**
 * GET /api/batch/[id]/status
 * Get batch status and progress
 *
 * In localStorage mode, batches are processed synchronously,
 * so this endpoint returns "not found" for most batch IDs
 * (results are returned directly from /api/process)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
): Promise<Response> {
  try {
    // SECURITY: Authenticate request
    const userId = await authenticateRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in or provide valid Bearer token/API key' },
        { status: 401 }
      )
    }

    const batchId = params.batchId

    if (!batchId) {
      return NextResponse.json(
        { error: 'Batch ID is required' },
        { status: 400 }
      )
    }

    // In localStorage mode, batches are processed synchronously
    // and results are returned directly from /api/process
    // This status endpoint returns "not found" since we don't store batch state
    return NextResponse.json(
      {
        error: 'Batch not found',
        message: 'In localStorage mode, batch results are returned directly from the process endpoint.'
      },
      { status: 404 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logError('GET /api/batch/[id]/status error', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch batch status',
        details: message,
      },
      { status: 500 }
    )
  }
}

/**
 * Handle unsupported methods
 */
export async function POST(): Promise<Response> {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to check batch status' },
    { status: 405 }
  )
}




