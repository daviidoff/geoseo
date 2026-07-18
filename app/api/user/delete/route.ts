/**
 * ABOUTME: API endpoint for account deletion (GDPR compliant)
 * ABOUTME: Deletes user from auth.users (cascade handles all related data)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAuthRateLimit } from '@/lib/api-middleware'

export async function DELETE(request: NextRequest) {
  // Strict rate limiting for account deletion
  const rateLimitResponse = checkAuthRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse
  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // localStorage mode - account deletion handled client-side
    return NextResponse.json({
      success: true,
      message: 'localStorage mode - clear data client-side',
      localStorage: true,
    })
  }

  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'Service role key not configured' },
      { status: 500 }
    )
  }

  try {
    // Create client with anon key to verify user session
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get session from Authorization header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authentication token' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the token and get the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    // Create admin client with service role key for deletion
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Delete the user from auth.users
    // CASCADE constraints will automatically delete:
    // - user_profiles
    // - credit_transactions
    // - scheduled_runs
    // - clients (and their assets, keywords, blogs, analyses)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
