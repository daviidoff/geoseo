/**
 * API Route: Package by ID
 * GET /api/packages/[packageId] - Get package details
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'

export async function GET(
  _request: NextRequest,
  { params }: { params: { packageId: string } }
) {
  try {
    // Use dev mode user (no Supabase)
    const user = getDevModeUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Return not found (no database)
    return NextResponse.json(
      { error: 'Package not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Error in GET /api/packages/[packageId]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
