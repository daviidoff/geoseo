/**
 * API Route: Packages (Client View)
 * GET /api/packages - List packages assigned to current user (client)
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

    // Return empty packages list (no database)
    return NextResponse.json({ packages: [] })
  } catch (error) {
    console.error('Error in GET /api/packages', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
