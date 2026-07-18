// ABOUTME: API route for individual client operations (GET, PATCH, DELETE)
// ABOUTME: Allows updating client context stored in the notes field

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch a single client by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RLS automatically ensures user can only access their own clients
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  return NextResponse.json({ client: data })
}

// PATCH: Update a client's context
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { notes, name, website, ...otherFields } = body

  // Build update object
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (notes !== undefined) updateData.notes = notes
  if (name !== undefined) updateData.name = name
  if (website !== undefined) updateData.website = website

  // Allow updating other fields if provided
  const allowedFields = ['industry', 'brand_voice', 'target_audience', 'competitors', 'products']
  for (const field of allowedFields) {
    if (otherFields[field] !== undefined) {
      updateData[field] = otherFields[field]
    }
  }

  // RLS automatically ensures user can only update their own clients
  const { data, error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[clients/[id]] Failed to update client:', error)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  }

  return NextResponse.json({ client: data })
}

// DELETE: Delete a client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RLS automatically ensures user can only delete their own clients
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[clients/[id]] Failed to delete client:', error)
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
