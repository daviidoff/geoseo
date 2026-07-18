/**
 * ABOUTME: Context Files Update Tags API (localStorage-based auth)
 * ABOUTME: Mock endpoint - returns success without database
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'

/**
 * PATCH /api/context-files/update-tags
 * Mock update tags - returns success without storing
 */
export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const userId = await authenticateRequest(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { filePath, tags } = body

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { error: 'filePath is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'tags must be an array' },
        { status: 400 }
      )
    }

    // Verify file belongs to user
    if (!filePath.startsWith(`${userId}/`)) {
      return NextResponse.json(
        { error: 'Unauthorized - file does not belong to user' },
        { status: 403 }
      )
    }

    // Return mock success
    return NextResponse.json({ success: true, tags })
  } catch (error) {
    console.error('Update tags error', error)
    return NextResponse.json(
      {
        error: 'Failed to update tags',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
