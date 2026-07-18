/**
 * API Route: Package Assignments
 * GET /api/packages/assignments - Get assigned packages for current user
 */

import { NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'

export async function GET() {
  try {
    // Use dev mode user (no Supabase)
    const user = getDevModeUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Return empty assignments list (no database)
    return NextResponse.json({ assignments: [] })
  } catch (error) {
    console.error('Error in GET /api/packages/assignments', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
