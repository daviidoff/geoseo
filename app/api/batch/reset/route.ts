/**
 * ABOUTME: Reset stuck batch state (localStorage-based auth)
 * ABOUTME: Uses mock user - no database
 */

import { NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'
import { releaseBatch } from '@/middleware/rateLimits'

/**
 * POST /api/batch/reset
 * Reset stuck batch state for current user
 * Use this if you get "Please wait for your current batch to complete" error
 */
export async function POST(): Promise<Response> {
  try {
    const user = getDevModeUser()

    // Release the stuck batch from rate limiter
    releaseBatch(user.id)

    return NextResponse.json({
      success: true,
      message: 'Batch state reset successfully. You can now start a new batch.',
    })
  } catch (error) {
    console.error('Batch reset failed', error)
    return NextResponse.json(
      { error: 'Failed to reset batch state' },
      { status: 500 }
    )
  }
}
