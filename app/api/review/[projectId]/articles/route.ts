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

async function verifyToken(supabase: ReturnType<typeof createAdminSupabaseClient>, projectId: string, token: string): Promise<boolean> {
  if (!supabase) return false

  const { data: project } = await supabase
    .from('projects')
    .select('review_token')
    .eq('id', projectId)
    .single()

  if (!project?.review_token) return false
  return safeCompare(token.toUpperCase(), project.review_token.toUpperCase())
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    // Verify token
    const isValid = await verifyToken(supabase, projectId, token)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Fetch articles in review or recently approved
    const { data: articles, error } = await supabase
      .from('blogs')
      .select('id, headline, slug, keyword, quality_score, word_count, status, content, feedback, created_at')
      .eq('project_id', projectId)
      .in('status', ['review', 'approved', 'draft'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Articles fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
    }

    return NextResponse.json({ articles: articles || [] })
  } catch (error) {
    console.error('Articles error:', error)
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}
