// ABOUTME: API route for saving and retrieving keyword generation history
// ABOUTME: Stores/loads generation results with language/country from Supabase

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const clientId = searchParams.get('client_id')

    let query = supabase
      .from('keyword_generations')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data: generations, error } = await query

    if (error) {
      console.error('[keyword-generations] Failed to fetch:', error)
      return NextResponse.json({ error: 'Failed to fetch generations' }, { status: 500 })
    }

    return NextResponse.json({ generations: generations || [] })
  } catch (error) {
    console.error('[keyword-generations] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

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
    const {
      client_id,
      company_name,
      company_url,
      language,
      country,
      keywords,
      generation_time,
      metadata
    } = body

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Keywords array is required' }, { status: 400 })
    }

    if (!company_name) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    // RLS INSERT policy allows users to insert their own records
    const { data, error } = await supabase
      .from('keyword_generations')
      .insert({
        user_id: userData.user.id,
        client_id: client_id || null,
        company_name,
        company_url: company_url || null,
        language: language || 'en',
        country: country || 'US',
        keywords: keywords,
        total_keywords: keywords.length,
        generation_time: generation_time || null,
        metadata: metadata || {}
      })
      .select('*')
      .single()

    if (error) {
      console.error('[keyword-generations] Failed to save:', error)
      return NextResponse.json({ error: 'Failed to save generation' }, { status: 500 })
    }

    return NextResponse.json({ generation: data })
  } catch (error) {
    console.error('[keyword-generations] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const generationId = searchParams.get('id')

    if (!generationId) {
      return NextResponse.json({ error: 'Generation ID is required' }, { status: 400 })
    }

    // RLS DELETE policy ensures user can only delete their own records
    const { error } = await supabase
      .from('keyword_generations')
      .delete()
      .eq('id', generationId)

    if (error) {
      console.error('[keyword-generations] Failed to delete:', error)
      return NextResponse.json({ error: 'Failed to delete generation' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[keyword-generations] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
