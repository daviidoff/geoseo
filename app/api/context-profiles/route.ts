/**
 * ABOUTME: Context Profiles API (database-backed)
 * ABOUTME: Manages company contexts with usage limit enforcement
 *
 * GET /api/context-profiles - List user's context profiles
 * POST /api/context-profiles - Create new context profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'
import { checkContextLimit } from '@/lib/services/usage-service'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const user = getDevModeUser()

    if (!supabaseAdmin) {
      return NextResponse.json({ profiles: [] })
    }

    // Get profiles from clients table
    const { data: profiles, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching context profiles:', error)
      return NextResponse.json({ error: 'Failed to fetch context profiles' }, { status: 500 })
    }

    // Map to profile format expected by frontend
    const mappedProfiles = (profiles || []).map(client => ({
      id: client.id,
      user_id: client.user_id,
      name: client.name,
      company_name: client.name,
      company_website: client.website,
      industry: client.industry,
      tone: client.brand_voice,
      target_audience: client.target_audience,
      competitors: client.competitors,
      products: client.products,
      notes: client.notes,
      created_at: client.created_at,
      updated_at: client.updated_at,
    }))

    return NextResponse.json({ profiles: mappedProfiles })
  } catch (error) {
    console.error('Error fetching context profiles:', error)
    return NextResponse.json({ error: 'Failed to fetch context profiles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getDevModeUser()
    const body = await request.json()

    // Validate required fields
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Profile name is required' }, { status: 400 })
    }

    if (body.name.trim().length > 100) {
      return NextResponse.json({ error: 'Profile name must be 100 characters or less' }, { status: 400 })
    }

    // Check context limit before creating
    const limitCheck = await checkContextLimit(user.id)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Context limit reached',
          message: limitCheck.message,
          limit: limitCheck.limit,
          used: limitCheck.used,
          upgrade: limitCheck.upgrade,
        },
        { status: 403 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    // Check if profile name already exists for this user
    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', body.name.trim())
      .single()

    if (existing) {
      return NextResponse.json({ error: 'A profile with this name already exists' }, { status: 409 })
    }

    // Insert into clients table
    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        website: body.company_website?.trim() || null,
        industry: body.industry?.trim() || null,
        brand_voice: body.tone?.trim() || null,
        target_audience: body.icp?.trim() || body.target_audience?.trim() || null,
        competitors: body.competitors?.trim() || null,
        products: body.products ? (Array.isArray(body.products) ? body.products.join(', ') : body.products) : null,
        notes: body.description?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating context profile:', error)
      return NextResponse.json({ error: 'Failed to create context profile' }, { status: 500 })
    }

    // Map to profile format expected by frontend
    const profile = {
      id: client.id,
      user_id: client.user_id,
      name: client.name,
      company_name: client.name,
      company_website: client.website,
      industry: client.industry,
      tone: client.brand_voice,
      target_audience: client.target_audience,
      competitors: client.competitors,
      products: client.products,
      notes: client.notes,
      created_at: client.created_at,
      updated_at: client.updated_at,
    }

    return NextResponse.json({ success: true, profile }, { status: 201 })
  } catch (error) {
    console.error('Error creating context profile:', error)
    return NextResponse.json({ error: 'Failed to create context profile' }, { status: 500 })
  }
}
