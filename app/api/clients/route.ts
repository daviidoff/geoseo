import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function parseContext(notes: unknown) {
  if (!notes) return {}
  if (typeof notes === 'object') return notes as Record<string, any>
  if (typeof notes !== 'string') return {}
  try {
    const parsed = JSON.parse(notes)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export async function GET(_request: NextRequest): Promise<Response> {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RLS automatically filters to user's own clients via auth.uid() = user_id policy
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[clients] Failed to fetch clients:', error)
    return NextResponse.json({ clients: [] }, { status: 500 })
  }

  const clients = (data || []).map(client => ({
    ...client,
    context: parseContext(client.notes),
  }))

  return NextResponse.json({ clients })
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RLS automatically ensures user can only delete their own clients
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) {
    console.error('[clients] Failed to delete client:', error)
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
