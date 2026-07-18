/**
 * ABOUTME: Ensure user endpoint (localStorage-based auth)
 * ABOUTME: Always returns success - no database storage needed
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'

/**
 * POST /api/auth/ensure-user
 * In localStorage mode, always returns success since user is managed locally
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing userId or email' }, { status: 400 })
    }

    // In local mode, just verify the user ID format and return success
    // No database storage needed
    const localUser = getDevModeUser()
    console.log('[AUTH] ensure-user called in local mode', {
      providedUserId: userId,
      localUserId: localUser.id
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in ensure-user', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

