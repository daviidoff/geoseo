import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { timingSafeEqual } from 'crypto'

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    // Fetch project with client info
    const { data: project, error } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        website_url,
        review_token,
        client:clients(name)
      `)
      .eq('id', projectId)
      .single()

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify token with timing-safe comparison
    if (!project.review_token || !safeCompare(token.toUpperCase(), project.review_token.toUpperCase())) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // client is returned as an array from the join, get first element
    const clientData = Array.isArray(project.client) ? project.client[0] : project.client

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        website_url: project.website_url,
        client_name: clientData?.name || 'Unknown',
      },
    })
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
