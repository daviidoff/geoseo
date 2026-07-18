/**
 * ABOUTME: Single Prompt API (localStorage-based auth)
 * ABOUTME: Returns mock data - no database storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    getDevModeUser() // Verify auth

    // In local mode, return not found for any specific prompt lookup
    return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
  } catch (error) {
    console.error('Error updating prompt', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    getDevModeUser() // Verify auth

    // In local mode, always return success
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting prompt', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Increment usage count and update last_used_at
export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    getDevModeUser() // Verify auth

    // In local mode, always return success
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating prompt usage', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
