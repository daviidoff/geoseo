/**
 * ABOUTME: Apply Context Profile API (localStorage-based auth)
 * ABOUTME: Returns mock data - no database storage
 *
 * POST /api/context-profiles/[id]/apply - Apply profile to current business context
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    getDevModeUser() // Verify auth

    // In local mode, return not found
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  } catch (error) {
    console.error('Error applying context profile:', error)
    return NextResponse.json({ error: 'Failed to apply context profile' }, { status: 500 })
  }
}
