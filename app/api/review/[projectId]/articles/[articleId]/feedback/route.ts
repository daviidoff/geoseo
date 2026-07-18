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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; articleId: string }> }
) {
  try {
    const { projectId, articleId } = await params
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

    const { action, feedback } = await request.json()

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Verify article belongs to project
    const { data: article, error: fetchError } = await supabase
      .from('blogs')
      .select('id, project_id, status')
      .eq('id', articleId)
      .eq('project_id', projectId)
      .single()

    if (fetchError || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Update article status
    const newStatus = action === 'approve' ? 'approved' : 'draft'
    const updateData: Record<string, unknown> = { status: newStatus }
    if (action === 'reject' && feedback) {
      updateData.feedback = feedback
    }

    const { error: updateError } = await supabase
      .from('blogs')
      .update(updateData)
      .eq('id', articleId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update article' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: action === 'approve' ? 'Article approved' : 'Feedback submitted',
    })
  } catch (error) {
    console.error('Feedback error:', error)
    return NextResponse.json({ error: 'Failed to process feedback' }, { status: 500 })
  }
}
