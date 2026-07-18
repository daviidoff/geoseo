/**
 * ABOUTME: Business Context API (localStorage-based auth)
 * ABOUTME: Returns mock/empty business context - no database
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'

// In-memory storage for business context (resets on server restart)
let mockBusinessContext: Record<string, unknown> | null = null

export async function GET() {
  try {
    getDevModeUser() // Verify auth

    // Return mock business context
    return NextResponse.json({ context: mockBusinessContext })
  } catch (error) {
    console.error('Error fetching business context', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getDevModeUser()
    const body = await request.json()

    // Store in memory (mock)
    mockBusinessContext = {
      id: 'mock-context-1',
      user_id: user.id,
      icp: body.icp || null,
      countries: body.countries || [],
      products: body.products || [],
      target_keywords: body.target_keywords || [],
      competitor_keywords: body.competitor_keywords || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({ context: mockBusinessContext })
  } catch (error) {
    console.error('Error updating business context', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
