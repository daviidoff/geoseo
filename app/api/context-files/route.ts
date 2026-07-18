/**
 * ABOUTME: Context Files API (localStorage-based auth)
 * ABOUTME: Returns empty files list - no database storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'

/**
 * GET /api/context-files
 * Lists all context files for the authenticated user
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const userId = await authenticateRequest(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    // Return empty file list (no database/storage available)
    return NextResponse.json(
      { files: [] },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    console.error('List files error', error)
    return NextResponse.json(
      {
        error: 'Failed to list files',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/context-files
 * Deletes a context file (mock - no storage)
 */
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const userId = await authenticateRequest(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    // In local mode, always return success
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete file error', error)
    return NextResponse.json(
      {
        error: 'Failed to delete file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
