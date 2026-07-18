/**
 * ABOUTME: API route for waitlist email submissions
 * ABOUTME: Validates email, stores UTM params, handles duplicates gracefully
 * ABOUTME: Sends confirmation email via Supabase Edge Function (which uses Resend)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role for inserting waitlist entries and calling edge functions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, fullName, source, utmSource, utmMedium, utmCampaign } = body

    // Validate required fields
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Check if Supabase is configured
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase not configured for waitlist')
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Insert into waitlist
    const { error } = await supabase
      .from('waitlist')
      .insert({
        email: normalizedEmail,
        full_name: fullName?.trim() || null,
        source: source || 'landing',
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
      })

    if (error) {
      // Handle duplicate email gracefully
      if (error.code === '23505') {
        return NextResponse.json(
          { success: true, message: "You're already on the list! We'll be in touch soon." },
          { status: 200 }
        )
      }

      console.error('Waitlist insert error:', error)
      return NextResponse.json(
        { error: 'Failed to join waitlist. Please try again.' },
        { status: 500 }
      )
    }

    // Send confirmation email via Supabase Edge Function (non-blocking)
    // The edge function uses the RESEND_API_KEY from Supabase secrets
    supabase.functions.invoke('send-waitlist-email', {
      body: {
        email: normalizedEmail,
        name: fullName?.trim() || undefined,
        source: source || 'landing',
      },
    }).catch((err) => {
      console.error('Failed to send waitlist confirmation email:', err)
    })

    return NextResponse.json(
      { success: true, message: "You're on the list! We'll notify you when we launch." },
      { status: 201 }
    )
  } catch (error) {
    console.error('Waitlist API error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
