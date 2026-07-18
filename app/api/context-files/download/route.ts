/**
 * ABOUTME: Context Files Download API (localStorage-based auth)
 * ABOUTME: Mock download - returns error as files are stored client-side
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'

/**
 * GET /api/context-files/download
 * Mock download endpoint - returns not found
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

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { error: 'path parameter is required' },
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

    // Without Supabase storage, files are not stored server-side
    return NextResponse.json(
      { error: 'File storage not configured. Files are stored client-side only.' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Download file error', error)
    return NextResponse.json(
      {
        error: 'Failed to download file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
