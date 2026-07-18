/**
 * ABOUTME: API Route for batch status (localStorage-based auth)
 * ABOUTME: Returns mock status - no database
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'

export const maxDuration = 60

/**
 * GET /api/batch/[batchId]/status
 * Get batch status and progress (mock - no database)
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

    // No database - return not found for any batch lookup
    return NextResponse.json(
      { error: 'Batch not found' },
      { status: 404 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('GET /api/batch/[id]/status error', error)
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




