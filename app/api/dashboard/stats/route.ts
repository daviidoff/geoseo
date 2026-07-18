/**
 * ABOUTME: API Route for dashboard stats (localStorage-based auth)
 * ABOUTME: Returns mock stats - no database
 * GET /api/dashboard/stats - Get aggregated dashboard statistics
 */

import { createSuccessResponse } from '@/lib/api-response'
import { getDevModeUser } from '@/lib/dev-mode-helper'

// Cache the response for 15 seconds
export const revalidate = 15

export async function GET() {
  try {
    // Get user (always returns mock user in local mode)
    getDevModeUser()

    // Return empty/mock stats (no database available)
    return createSuccessResponse({
      totalBatches: 0,
      completedBatches: 0,
      totalRowsProcessed: 0,
      successRate: 0,
      averageProcessingTime: 0,
      totalTokens: 0,
      rowsPerSecond: 0,
      resourceCounts: {
        leads: 0,
        keywords: 0,
        content: 0,
        campaigns: 0,
      },
      recentBatches: [],
    })
  } catch (error) {
    console.error('Error in GET /api/dashboard/stats:', error)
    return createSuccessResponse({
      totalBatches: 0,
      completedBatches: 0,
      totalRowsProcessed: 0,
      successRate: 0,
      averageProcessingTime: 0,
      totalTokens: 0,
      rowsPerSecond: 0,
      resourceCounts: {
        leads: 0,
        keywords: 0,
        content: 0,
        campaigns: 0,
      },
      recentBatches: [],
    })
  }
}

