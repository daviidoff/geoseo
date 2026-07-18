/**
 * ABOUTME: OAuth callback route for Supabase auth
 * ABOUTME: Handles Google OAuth and email confirmation redirects
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/context'
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    console.error('[AUTH CALLBACK] OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  // Exchange code for session
  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[AUTH CALLBACK] Code exchange error:', exchangeError)
      return NextResponse.redirect(
        `${origin}/auth?error=${encodeURIComponent(exchangeError.message)}`
      )
    }

    // Successful auth - redirect to intended destination
    return NextResponse.redirect(`${origin}${next}`)
  }

  // No code provided - redirect to auth page
  return NextResponse.redirect(`${origin}/auth`)
}
