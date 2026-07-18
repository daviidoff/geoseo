// ABOUTME: API route for getting/setting the user's selected client/company
// ABOUTME: Stores selection in Supabase user_profiles for persistence across devices

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Retrieve the user's currently selected client
export async function GET() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RLS automatically filters to user's own profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('selected_client_id')
      .single()

    if (error) {
      console.error('[selected-client] Failed to fetch:', error)
      return NextResponse.json({ selected_client_id: null })
    }

    return NextResponse.json({ selected_client_id: profile?.selected_client_id || null })
  } catch (error) {
    console.error('[selected-client] Error:', error)
    return NextResponse.json({ selected_client_id: null })
  }
}

// POST: Set the user's selected client
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { client_id } = body

    // Verify the client belongs to the user (RLS ensures this)
    if (client_id) {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .single()

      if (clientError || !client) {
        return NextResponse.json({ error: 'Client not found or unauthorized' }, { status: 404 })
      }
    }

    // Update the user's selected client (RLS ensures user can only update their own profile)
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ selected_client_id: client_id || null })
      .eq('user_id', userData.user.id)

    if (updateError) {
      console.error('[selected-client] Failed to update:', updateError)
      return NextResponse.json({ error: 'Failed to update selection' }, { status: 500 })
    }

    return NextResponse.json({ success: true, selected_client_id: client_id })
  } catch (error) {
    console.error('[selected-client] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
