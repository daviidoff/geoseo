/**
 * ABOUTME: Cancel a running batch (localStorage-based auth)
 * ABOUTME: Returns mock data - no database
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'

export const maxDuration = 30

/**
 * POST /api/batch/[batchId]/cancel
 * Cancel a running batch (mock - no database)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { batchId: string } }
): Promise<Response> {
  try {
    // Authenticate request
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

    // No database - return not found
    return NextResponse.json(
      { error: 'Batch not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Unexpected error during batch cancellation', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



