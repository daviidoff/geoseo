/**
 * ABOUTME: Stripe webhook handler for subscription events
 * ABOUTME: Updates user plan when subscriptions change (free/pro/business)
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, STRIPE_CONFIG } from '@/lib/stripe/client'
import { supabaseAdmin } from '@/lib/supabase'
import { mapPriceIdToPlanType } from '@/lib/stripe/products'

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    console.error('[Stripe Webhook] Missing signature')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const webhookSecret = STRIPE_CONFIG.WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[Stripe Webhook] Webhook secret not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCanceled(subscription)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id
  const planType = session.metadata?.plan_type

  if (!userId) {
    console.error('[Stripe Webhook] No user_id in session metadata')
    return
  }

  console.log(`[Stripe Webhook] Checkout completed for user ${userId}, plan: ${planType}`)

  // For subscription checkouts, the subscription events handle the plan update
  // No credit handling needed in the new usage-based model
  if (session.mode === 'subscription') {
    console.log('[Stripe Webhook] Subscription checkout - plan update handled by subscription events')
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  // Get user by Stripe customer ID
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    console.error(`[Stripe Webhook] No user found for customer ${customerId}`)
    return
  }

  // Get the price ID from the subscription
  const priceId = subscription.items.data[0]?.price?.id
  const planType = priceId ? mapPriceIdToPlanType(priceId) : 'free'

  console.log(`[Stripe Webhook] Subscription ${subscription.status} for user ${profile.user_id}, plan: ${planType}`)

  // Update user's plan
  await supabaseAdmin
    .from('user_profiles')
    .update({
      plan_type: planType || 'free',
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      current_period_end: (subscription as any).current_period_end
        ? new Date((subscription as any).current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', profile.user_id)
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    console.error(`[Stripe Webhook] No user found for customer ${customerId}`)
    return
  }

  console.log(`[Stripe Webhook] Subscription canceled for user ${profile.user_id}`)

  // Downgrade to free plan
  await supabaseAdmin
    .from('user_profiles')
    .update({
      plan_type: 'free',
      subscription_status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', profile.user_id)
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    return
  }

  console.log(`[Stripe Webhook] Invoice paid for user ${profile.user_id}: $${(invoice.amount_paid || 0) / 100}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    return
  }

  console.log(`[Stripe Webhook] Payment failed for user ${profile.user_id}`)

  // Update subscription status
  await supabaseAdmin
    .from('user_profiles')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', profile.user_id)
}
