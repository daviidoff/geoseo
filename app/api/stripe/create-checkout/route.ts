/**
 * ABOUTME: Stripe checkout session creation for subscription plans
 * ABOUTME: Creates checkout sessions for Pro plan subscriptions
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'
import { mapPlanTypeToPriceId, type PlanType } from '@/lib/stripe/products'

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

    const body = await request.json()
    const { priceId, planType, returnUrl, mode = 'subscription' } = body

    // Determine the price ID
    let finalPriceId = priceId
    if (!finalPriceId && planType) {
      finalPriceId = mapPlanTypeToPriceId(planType as PlanType)
    }

    if (!finalPriceId) {
      return NextResponse.json(
        { error: 'Price ID or valid plan type is required' },
        { status: 400 }
      )
    }

    // Create or get Stripe customer
    let customerId: string

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id
        }
      })

      customerId = customer.id

      // Save customer ID to profile
      await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString()
        })
    }

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = returnUrl || `${baseUrl}/profile?tab=billing&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseUrl}/pricing`

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: mode === 'subscription' ? 'subscription' : 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        plan_type: planType || 'pro',
        type: mode === 'subscription' ? 'subscription' : 'one_time'
      }
    }

    // Add subscription-specific options
    if (mode === 'subscription') {
      sessionParams.subscription_data = {
        metadata: {
          user_id: user.id,
          plan_type: planType
        }
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({
      url: session.url,
      sessionId: session.id
    })

  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
