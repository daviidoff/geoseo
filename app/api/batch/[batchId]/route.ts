/**
 * ABOUTME: API Route for batch operations (localStorage-based auth)
 * ABOUTME: Returns mock data - no database
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const userId = await authenticateRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const batchId = params.batchId

    // No database - return success (nothing to delete)
    console.log(`[BATCH] Mock deletion for batch ${batchId} (local mode - no database)`)

    return NextResponse.json({
      success: true,
      message: 'Batch deleted successfully (local mode)'
    })
  } catch (error) {
    console.error('[ERROR] Unexpected error during batch deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
