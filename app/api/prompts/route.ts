/**
 * ABOUTME: Saved Prompts API (localStorage-based auth)
 * ABOUTME: Returns empty prompts - no database storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'

// In-memory storage for prompts (resets on server restart)
const mockPrompts: Map<string, Record<string, unknown>> = new Map()

export async function GET() {
  try {
    const user = getDevModeUser()

    // Get prompts for this user
    const userPrompts = Array.from(mockPrompts.values())
      .filter(p => p.user_id === user.id)
      .sort((a, b) => {
        const aDate = new Date(a.last_used_at as string || a.created_at as string).getTime()
        const bDate = new Date(b.last_used_at as string || b.created_at as string).getTime()
        return bDate - aDate
      })

    return NextResponse.json(
      { prompts: userPrompts },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    console.error('Error in GET /api/prompts', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getDevModeUser()
    const body = await request.json()
    const { name, prompt, description, tags } = body

    if (!name || !prompt) {
      return NextResponse.json({ error: 'Name and prompt are required' }, { status: 400 })
    }

    const id = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newPrompt = {
      id,
      user_id: user.id,
      name,
      prompt,
      description: description || null,
      tags: tags || [],
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_used_at: null,
    }

    mockPrompts.set(id, newPrompt)

    return NextResponse.json({ prompt: newPrompt })
  } catch (error) {
    console.error('Error saving prompt', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
