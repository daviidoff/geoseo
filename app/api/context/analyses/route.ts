/**
 * ABOUTME: Context Analyses API (localStorage-based auth)
 * ABOUTME: Returns empty analyses - no database storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'

/**
 * GET /api/context/analyses
 * Get context analyses for current user (optionally filtered by URL)
 * In localStorage mode, returns empty array (no database)
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    getDevModeUser() // Verify auth

    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    // In localStorage mode, there are no stored analyses
    // Return empty results
    return NextResponse.json({
      contextAnalyses: url ? null : []
    })
  } catch (error) {
    console.error('[API:CONTEXT] Request error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
