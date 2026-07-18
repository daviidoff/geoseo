// ABOUTME: API route for saving and retrieving blog generation history
// ABOUTME: Stores/loads blog generation results from Supabase

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      // Return empty array when database not available (dev mode)
      console.log('[blog-generations] Database not available, returning empty array')
      return NextResponse.json({ generations: [] })
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user?.id) {
      // Return empty array for unauthenticated users instead of error
      console.log('[blog-generations] User not authenticated, returning empty array')
      return NextResponse.json({ generations: [] })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const clientId = searchParams.get('client_id')
    const type = searchParams.get('type') // 'blog', 'blog_batch', 'refresh'

    let query = supabase
      .from('blog_generations')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    if (type) {
      query = query.eq('type', type)
    }

    const { data: generations, error } = await query

    if (error) {
      console.error('[blog-generations] Failed to fetch:', error)
      return NextResponse.json({ error: 'Failed to fetch blog generations' }, { status: 500 })
    }

    return NextResponse.json({ generations: generations || [] })
  } catch (error) {
    console.error('[blog-generations] Error:', error)
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
      // In dev mode without database, just log and return success
      console.log('[blog-generations] Database not available, skipping save')
      return NextResponse.json({ generation: null, message: 'Skipped - no database' })
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user?.id) {
      // Skip saving for unauthenticated users but don't throw error
      console.log('[blog-generations] User not authenticated, skipping save')
      return NextResponse.json({ generation: null, message: 'Skipped - not authenticated' })
    }

    const body = await request.json()
    const {
      client_id,
      type = 'blog',
      company,
      url,
      language,
      country,
      keyword,
      title,
      content,
      word_count,
      aeo_score,
      generation_time,
      batch_id,
      total,
      successful,
      failed,
      results,
      metadata
    } = body

    if (!company) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    // RLS INSERT policy allows users to insert their own records
    const { data, error } = await supabase
      .from('blog_generations')
      .insert({
        user_id: userData.user.id,
        client_id: client_id || null,
        type,
        company,
        url: url || null,
        language: language || 'en',
        country: country || 'US',
        keyword: keyword || null,
        title: title || null,
        content: content || null,
        word_count: word_count || null,
        aeo_score: aeo_score || null,
        generation_time: generation_time || null,
        batch_id: batch_id || null,
        total: total || null,
        successful: successful || null,
        failed: failed || null,
        results: results || null,
        metadata: metadata || {}
      })
      .select('*')
      .single()

    if (error) {
      console.error('[blog-generations] Failed to save:', error)
      return NextResponse.json({ error: 'Failed to save blog generation' }, { status: 500 })
    }

    return NextResponse.json({ generation: data })
  } catch (error) {
    console.error('[blog-generations] Error:', error)
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
      console.log('[blog-generations] Database not available, skipping delete')
      return NextResponse.json({ success: true, message: 'Skipped - no database' })
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user?.id) {
      console.log('[blog-generations] User not authenticated, skipping delete')
      return NextResponse.json({ success: true, message: 'Skipped - not authenticated' })
    }

    const { searchParams } = new URL(request.url)
    const generationId = searchParams.get('id')
    const clearAll = searchParams.get('clear_all') === 'true'

    if (clearAll) {
      // Delete all blog generations for the user
      const { error } = await supabase
        .from('blog_generations')
        .delete()
        .eq('user_id', userData.user.id)

      if (error) {
        console.error('[blog-generations] Failed to clear all:', error)
        return NextResponse.json({ error: 'Failed to clear blog history' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'All blog history cleared' })
    }

    if (!generationId) {
      return NextResponse.json({ error: 'Generation ID is required' }, { status: 400 })
    }

    // RLS DELETE policy ensures user can only delete their own records
    const { error } = await supabase
      .from('blog_generations')
      .delete()
      .eq('id', generationId)

    if (error) {
      console.error('[blog-generations] Failed to delete:', error)
      return NextResponse.json({ error: 'Failed to delete blog generation' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[blog-generations] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
