/**
 * ABOUTME: Creates Stripe Customer Portal session for subscription management
 * ABOUTME: Allows users to manage billing, update payment methods, cancel subscriptions
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get Stripe customer ID from profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe to a plan first.' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${baseUrl}/profile?tab=billing`,
    })

    return NextResponse.json({
      url: session.url
    })

  } catch (error) {
    console.error('Error creating portal session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create billing portal session' },
      { status: 500 }
    )
  }
}
