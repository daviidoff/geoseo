/**
 * ABOUTME: Verifies a Stripe checkout session and updates user plan
 * ABOUTME: Fallback for when webhooks are not configured or delayed
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase'
import { mapPriceIdToPlanType, SUBSCRIPTION_PLANS } from '@/lib/stripe/products'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.items.data.price']
    })

    // Verify this session belongs to the current user
    if (session.metadata?.user_id !== user.id) {
      return NextResponse.json({ error: 'Session does not belong to user' }, { status: 403 })
    }

    // Check if session was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ 
        error: 'Payment not completed',
        status: session.payment_status
      }, { status: 400 })
    }

    // Handle subscription
    if (session.mode === 'subscription' && session.subscription) {
      const subscription = typeof session.subscription === 'string' 
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription

      const priceId = subscription.items.data[0]?.price?.id
      const planType = priceId ? mapPriceIdToPlanType(priceId) : null

      if (planType) {
        const plan = SUBSCRIPTION_PLANS[planType]
        
        // Get current credits from secure user_credits table
        const { data: currentCredits } = await supabaseAdmin
          .from('user_credits')
          .select('credits_remaining, credits_total')
          .eq('user_id', user.id)
          .single()

        // Add credits to existing balance (supports rollover from previous plan)
        const currentBalance = currentCredits?.credits_remaining || 0
        const currentTotal = currentCredits?.credits_total || 0
        const newBalance = currentBalance + plan.includedCredits
        const newTotal = currentTotal + plan.includedCredits

        // Update secure user_credits table
        await supabaseAdmin
          .from('user_credits')
          .upsert({
            user_id: user.id,
            credits_remaining: newBalance,
            credits_total: newTotal,
            last_credited_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })

        // Update user_profiles with subscription info (credits synced via service role)
        await supabaseAdmin
          .from('user_profiles')
          .update({
            plan_type: planType,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
            credits_remaining: newBalance,
            credits_total: newTotal,
            current_period_end: new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)

        // Log the transaction
        await supabaseAdmin.from('credit_transactions').insert({
          user_id: user.id,
          amount: plan.includedCredits,
          type: 'subscription',
          description: `${plan.displayName} plan subscription credits`,
          metadata: { 
            session_id: sessionId,
            subscription_id: subscription.id
          },
          balance_after: newBalance,
          created_at: new Date().toISOString(),
        })

        return NextResponse.json({
          success: true,
          planType,
          creditsAdded: plan.includedCredits,
          message: `Successfully subscribed to ${plan.displayName} plan`
        })
      }
    }

    // Handle one-time payment (credit purchase)
    if (session.mode === 'payment' && session.amount_total) {
      const creditAmount = session.amount_total / 100

      // Get current credits from secure user_credits table
      const { data: currentCredits } = await supabaseAdmin
        .from('user_credits')
        .select('credits_remaining, credits_total')
        .eq('user_id', user.id)
        .single()

      const currentBalance = currentCredits?.credits_remaining || 0
      const currentTotal = currentCredits?.credits_total || 0
      const newBalance = currentBalance + creditAmount
      const newTotal = currentTotal + creditAmount

      // Update secure user_credits table
      await supabaseAdmin
        .from('user_credits')
        .upsert({
          user_id: user.id,
          credits_remaining: newBalance,
          credits_total: newTotal,
          last_credited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      // Also update user_profiles for backwards compatibility
      await supabaseAdmin
        .from('user_profiles')
        .update({
          credits_remaining: newBalance,
          credits_total: newTotal,
          stripe_customer_id: session.customer as string,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      // Log the transaction
      await supabaseAdmin.from('credit_transactions').insert({
        user_id: user.id,
        amount: creditAmount,
        type: 'purchase',
        description: 'Credit purchase via Stripe',
        metadata: { session_id: sessionId },
        balance_after: newBalance,
        created_at: new Date().toISOString(),
      })

      return NextResponse.json({
        success: true,
        creditsAdded: creditAmount,
        message: `Successfully added ${creditAmount} credits`
      })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Session verified'
    })

  } catch (error) {
    console.error('Error verifying session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify session' },
      { status: 500 }
    )
  }
}
