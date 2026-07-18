/**
 * ABOUTME: API endpoint for fetching user usage statistics
 * ABOUTME: Returns demo data when Supabase is not configured
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Demo usage data when Supabase not configured
const DEMO_USAGE = {
  batchesToday: 3,
  rowsToday: 250,
  batchesThisMonth: 25,
  rowsThisMonth: 2500,
  totalBatches: 100,
  totalRows: 10000,
  dailyBatchLimit: 999999,
  dailyRowLimit: 999999999,
  planType: 'free'
}

/**
 * GET /api/usage - Get usage statistics for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      // Return demo data when Supabase not configured
      return NextResponse.json(DEMO_USAGE, {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      })
    }

    // Dynamic import to avoid errors when Supabase not configured
    const { authenticateRequest } = await import('@/lib/auth-middleware')
    const { getUserUsage } = await import('@/lib/api-keys')

    const userId = await authenticateRequest(request)

    if (!userId) {
      // Return demo data for unauthenticated users
      return NextResponse.json(DEMO_USAGE, {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      })
    }

    let usage
    try {
      usage = await getUserUsage(userId)
    } catch {
      // Return demo data on error
      usage = DEMO_USAGE
    }

    if (!usage) {
      usage = DEMO_USAGE
    }

    return NextResponse.json(usage, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('Error in /api/usage:', error)
    // Return demo data on any error
    return NextResponse.json(DEMO_USAGE, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    })
  }
}
