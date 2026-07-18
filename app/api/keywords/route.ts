/**
 * ABOUTME: API Route for keywords (localStorage-based auth)
 * ABOUTME: Returns empty keywords - no database storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'

/**
 * GET /api/keywords
 * Get all keyword generations for current user
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const userId = await authenticateRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return empty keyword generations (no database available)
    return NextResponse.json({ keywordGenerations: [] })
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
