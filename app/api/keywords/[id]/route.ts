/**
 * ABOUTME: API Route for single keyword (localStorage-based auth)
 * ABOUTME: Returns mock data - no database storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'

/**
 * GET /api/keywords/[id]
 * Get keyword generation task by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = await authenticateRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // No database - return not found
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  } catch (error) {
    console.error('[API:KEYWORDS] Request error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/keywords/[id]
 * Update keyword generation task (mock - not persisted)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = await authenticateRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // No database - return not found
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  } catch (error) {
    console.error('[API:KEYWORDS] Request error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
