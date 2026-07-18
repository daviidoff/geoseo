/**
 * ABOUTME: API endpoint for fetching user credit balance
 * ABOUTME: Returns unified credit balance and context usage
 */

import { NextRequest, NextResponse } from 'next/server'
import { getContextCount } from '@/lib/services/usage-service'
import { PLAN_LIMITS, hasUnlimitedCredits } from '@/lib/config/usage-limits'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Get authenticated user from Supabase
    const supabase = await createClient()
    let userId: string | null = null

    if (supabase) {
      const { data: userData } = await supabase.auth.getUser()
      userId = userData?.user?.id || null
    }

    if (!userId) {
      // No authenticated user - return free plan defaults
      return NextResponse.json({
        planType: 'free',
        credits: {
          remaining: 50,
          total: 50,
          used: 0,
          unlimited: false,
        },
        contexts: {
          used: 0,
          limit: 1,
          unlimited: false,
        },
        enforcement: 'hard',
      })
    }

    // Get user's plan type from user_profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('plan_type')
      .eq('user_id', userId)
      .single()

    // If no profile found, return defaults
    if (profileError || !profile) {
      console.warn('[Billing] No profile found for user:', userId)
      return NextResponse.json({
        planType: 'free',
        credits: {
          remaining: 50,
          total: 50,
          used: 0,
          unlimited: false,
        },
        contexts: {
          used: 0,
          limit: 1,
          unlimited: false,
        },
        enforcement: 'hard',
      })
    }

    // Get credits from secure user_credits table
    const { data: credits, error: creditsError } = await supabaseAdmin
      .from('user_credits')
      .select('credits_remaining, credits_total')
      .eq('user_id', userId)
      .single()

    if (creditsError) {
      console.warn('[Billing] No credits record found for user:', userId)
    }

    const planType = (profile?.plan_type || 'free') as keyof typeof PLAN_LIMITS
    const limits = PLAN_LIMITS[planType] || PLAN_LIMITS.free
    const isUnlimited = hasUnlimitedCredits(planType)

    // Get context count
    const contextCount = await getContextCount(userId)

    // Credits used = total - remaining (read from user_credits table)
    const creditsTotal = credits?.credits_total ?? limits.credits_per_month ?? 50
    const creditsRemaining = credits?.credits_remaining ?? creditsTotal
    const creditsUsed = Math.max(0, creditsTotal - creditsRemaining)

    return NextResponse.json({
      planType,
      credits: {
        remaining: isUnlimited ? null : creditsRemaining,
        total: isUnlimited ? null : creditsTotal,
        used: isUnlimited ? 0 : creditsUsed,
        unlimited: isUnlimited,
      },
      contexts: {
        used: contextCount,
        limit: limits.contexts,
        unlimited: limits.contexts === null,
      },
      enforcement: limits.enforcement,
    })
  } catch (error) {
    console.error('Error fetching usage balance:', error)
    // Return demo data on error
    return NextResponse.json({
      planType: 'free',
      credits: {
        remaining: 50,
        total: 50,
        used: 0,
        unlimited: false,
      },
      contexts: {
        used: 0,
        limit: 1,
        unlimited: false,
      },
      enforcement: 'hard',
    })
  }
}
