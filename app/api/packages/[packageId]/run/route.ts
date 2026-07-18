/**
 * API Route: Run Package
 * POST /api/packages/[packageId]/run - Execute pre-configured package run
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'

export async function POST(
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

    // Return mock success (no database)
    return NextResponse.json({
      package_runs: [],
      message: 'Package execution not available - database not configured',
    })
  } catch (error) {
    console.error('Error in POST /api/packages/[packageId]/run', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
