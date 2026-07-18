/**
 * ABOUTME: Individual Context Profile API (localStorage-based auth)
 * ABOUTME: Returns mock data - no database storage
 *
 * GET /api/context-profiles/[id] - Get specific profile
 * PUT /api/context-profiles/[id] - Update profile
 * DELETE /api/context-profiles/[id] - Delete profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    getDevModeUser() // Verify auth

    // In local mode, return not found
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  } catch (error) {
    console.error('Error fetching context profile:', error)
    return NextResponse.json({ error: 'Failed to fetch context profile' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    getDevModeUser() // Verify auth

    // In local mode, return not found
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  } catch (error) {
    console.error('Error updating context profile:', error)
    return NextResponse.json({ error: 'Failed to update context profile' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    getDevModeUser() // Verify auth

    // In local mode, always return success
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting context profile:', error)
    return NextResponse.json({ error: 'Failed to delete context profile' }, { status: 500 })
  }
}
