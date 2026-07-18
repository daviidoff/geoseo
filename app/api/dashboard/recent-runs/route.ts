/**
 * ABOUTME: API Route for dashboard recent runs (localStorage-based auth)
 * ABOUTME: Returns empty runs - no database
 * GET /api/dashboard/recent-runs - Get recent agent runs (batches)
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Return empty runs (no database available)
    return NextResponse.json({
      runs: [],
    })
  } catch (error) {
    console.error('Error in GET /api/dashboard/recent-runs', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

