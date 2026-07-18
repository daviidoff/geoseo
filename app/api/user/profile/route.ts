/**
 * ABOUTME: API Route for user profile management
 * ABOUTME: Returns demo data when Supabase is not configured
 */

import { NextRequest, NextResponse } from 'next/server'

// Demo profile data when Supabase not configured
const DEMO_PROFILE = {
  user_id: 'demo-user',
  email: 'demo@geoseo.local',
  full_name: 'Demo User',
  organization: 'Demo Organization',
  user_type: 'self_service',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export async function GET() {
  try {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      return NextResponse.json({ profile: DEMO_PROFILE })
    }

    // Dynamic import to avoid errors when Supabase not configured
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      // Return demo profile for unauthenticated users
      return NextResponse.json({ profile: DEMO_PROFILE })
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile yet - create default
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            user_type: 'self_service',
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creating user profile:', createError)
          return NextResponse.json({ profile: DEMO_PROFILE })
        }

        return NextResponse.json({ profile: newProfile })
      }

      console.error('Error fetching user profile:', error)
      return NextResponse.json({ profile: DEMO_PROFILE })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Error in GET /api/user/profile:', error)
    return NextResponse.json({ profile: DEMO_PROFILE })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      // Simulate successful update with demo data
      const body = await request.json()
      return NextResponse.json({
        profile: {
          ...DEMO_PROFILE,
          ...body,
          updated_at: new Date().toISOString(),
        }
      })
    }

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      // Simulate successful update for demo
      const body = await request.json()
      return NextResponse.json({
        profile: {
          ...DEMO_PROFILE,
          ...body,
          updated_at: new Date().toISOString(),
        }
      })
    }

    const body = await request.json()
    const { onboarding_link } = body

    const updateData: Record<string, unknown> = {}
    if (onboarding_link !== undefined) {
      updateData.onboarding_link = onboarding_link
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating user profile:', error)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Error in PUT /api/user/profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      // Simulate successful update with demo data
      return NextResponse.json({
        profile: {
          ...DEMO_PROFILE,
          full_name: body.full_name ?? DEMO_PROFILE.full_name,
          organization: body.organization ?? DEMO_PROFILE.organization,
          updated_at: new Date().toISOString(),
        }
      })
    }

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        profile: {
          ...DEMO_PROFILE,
          full_name: body.full_name ?? DEMO_PROFILE.full_name,
          organization: body.organization ?? DEMO_PROFILE.organization,
          updated_at: new Date().toISOString(),
        }
      })
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update({
        full_name: body.full_name,
        organization: body.organization,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating user profile:', error)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      profile: {
        ...profile,
        email: user.email,
      }
    })
  } catch (error) {
    console.error('Error in PATCH /api/user/profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
