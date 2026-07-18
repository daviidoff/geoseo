/**
 * API Route: Package Runs
 * GET /api/packages/runs - Get recent package runs for current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'

export async function GET(request: NextRequest) {
  try {
    // Use dev mode user (no Supabase)
    const user = getDevModeUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Return empty runs list (no database)
    return NextResponse.json({ runs: [] })
  } catch (error) {
    console.error('Error in GET /api/packages/runs', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
