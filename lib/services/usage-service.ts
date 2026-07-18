/**
 * ABOUTME: Usage tracking and limit enforcement service
 * ABOUTME: Records usage events and checks against plan limits using unified credits
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  type PlanType,
  type OperationType,
  PLAN_LIMITS,
  OPERATION_COSTS,
  OPERATION_CREDIT_COSTS,
} from '@/lib/config/usage-limits'

export interface TrackUsageParams {
  userId: string
  operation: OperationType
  quantity?: number
  costUsd?: number
  tokensInput?: number
  tokensOutput?: number
  model?: string
  clientId?: string
  metadata?: Record<string, unknown>
}

export interface UsageCheckResult {
  allowed: boolean
  message?: string
  limit?: number
  used?: number
  remaining?: number
  upgrade?: boolean
}

export interface UsageSummary {
  operation: string
  total_quantity: number
  total_cost_usd: number
}

/**
 * Track a usage event
 * Always records the event for analytics, regardless of limits
 */
export async function trackUsage(params: TrackUsageParams): Promise<{ success: boolean; error?: string }> {
  const {
    userId,
    operation,
    quantity = 1,
    costUsd,
    tokensInput,
    tokensOutput,
    model,
    clientId,
    metadata = {},
  } = params

  // Calculate cost if not provided
  const estimatedCost = costUsd ?? OPERATION_COSTS[operation] * quantity

  const { error } = await supabaseAdmin.from('usage_events').insert({
    user_id: userId,
    operation,
    quantity,
    estimated_cost_usd: estimatedCost,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    model,
    client_id: clientId,
    metadata,
    created_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[UsageService] Failed to track usage:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Check if a user can perform an operation based on their plan's credit limits
 * Uses unified credit pool - all operations deduct from the same pool
 * Reads credits from secure user_credits table (not user_profiles)
 */
export async function checkUsage(
  userId: string,
  operation: OperationType
): Promise<UsageCheckResult> {
  // Get user's plan type from user_profiles
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('plan_type')
    .eq('user_id', userId)
    .single()

  if (profileError || !profile) {
    // No profile found - user needs to be authenticated or profile needs to be created
    console.warn('[UsageService] No profile found for user:', userId)
    return {
      allowed: false,
      message: 'User profile not found. Please sign in to continue.',
      remaining: 0,
      upgrade: false,
    }
  }

  // Get credits from secure user_credits table
  const { data: credits, error: creditsError } = await supabaseAdmin
    .from('user_credits')
    .select('credits_remaining, credits_total')
    .eq('user_id', userId)
    .single()

  if (creditsError) {
    console.warn('[UsageService] No credits record found for user:', userId)
  }

  const planType = (profile.plan_type as PlanType) || 'free'
  const limits = PLAN_LIMITS[planType]

  // Get credit cost for this operation
  const creditCost = OPERATION_CREDIT_COSTS[operation] ?? 1
  const creditsRemaining = credits?.credits_remaining ?? 0
  const creditsTotal = credits?.credits_total ?? limits.credits_per_month ?? 0

  // For 'soft' enforcement (PRO/Business with high credit limits), always allow
  // Credits will still be deducted but user won't be blocked
  if (limits.enforcement === 'soft') {
    return {
      allowed: true,
      limit: creditsTotal,
      used: creditsTotal - creditsRemaining,
      remaining: creditsRemaining,
    }
  }

  // For 'none' enforcement, always allow (legacy - no deduction)
  if (limits.enforcement === 'none') {
    return { allowed: true }
  }

  // For 'hard' enforcement (Free plan), check credit balance
  if (creditsRemaining < creditCost) {
    return {
      allowed: false,
      message: `Not enough credits. This operation costs ${creditCost} credits, you have ${creditsRemaining}. Upgrade to continue.`,
      limit: creditsTotal,
      used: creditsTotal - creditsRemaining,
      remaining: creditsRemaining,
      upgrade: true,
    }
  }

  return {
    allowed: true,
    limit: creditsTotal,
    used: creditsTotal - creditsRemaining,
    remaining: creditsRemaining,
  }
}

/**
 * Get usage summary for a user over the last N days
 */
export async function getUsageSummary(
  userId: string,
  days: number = 30
): Promise<UsageSummary[]> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabaseAdmin
    .from('usage_events')
    .select('operation, quantity, estimated_cost_usd')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())

  if (error) {
    console.error('[UsageService] Failed to get usage summary:', error)
    return []
  }

  // Aggregate by operation
  const summary: Record<string, { quantity: number; cost: number }> = {}

  for (const row of data || []) {
    const op = row.operation
    if (!summary[op]) {
      summary[op] = { quantity: 0, cost: 0 }
    }
    summary[op].quantity += row.quantity || 0
    summary[op].cost += Number(row.estimated_cost_usd) || 0
  }

  return Object.entries(summary).map(([operation, { quantity, cost }]) => ({
    operation,
    total_quantity: quantity,
    total_cost_usd: cost,
  }))
}

/**
 * Get context (client) count for a user
 */
export async function getContextCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) {
    console.error('[UsageService] Failed to get context count:', error)
    return 0
  }

  return count ?? 0
}

/**
 * Check if user can create a new context based on their plan
 */
export async function checkContextLimit(userId: string): Promise<UsageCheckResult> {
  // Get user's plan type
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('plan_type')
    .eq('user_id', userId)
    .single()

  const planType = (profile?.plan_type as PlanType) || 'free'
  const limits = PLAN_LIMITS[planType]

  // If no limit on contexts, allow
  if (limits.contexts === null) {
    return { allowed: true }
  }

  const currentCount = await getContextCount(userId)

  if (currentCount >= limits.contexts) {
    return {
      allowed: false,
      message: `You've reached your limit of ${limits.contexts} context${limits.contexts > 1 ? 's' : ''}. Upgrade to add more.`,
      limit: limits.contexts,
      used: currentCount,
      remaining: 0,
      upgrade: true,
    }
  }

  return {
    allowed: true,
    limit: limits.contexts,
    used: currentCount,
    remaining: limits.contexts - currentCount,
  }
}

/**
 * Deduct credits from a user's balance
 * Always runs for all plans - PRO/Business just have high credit limits
 * Uses secure user_credits table as source of truth, syncs to user_profiles
 */
export async function deductCredits(
  userId: string,
  operation: OperationType,
  quantity: number = 1
): Promise<{ success: boolean; creditsDeducted: number; creditsRemaining: number; error?: string }> {
  const creditCost = OPERATION_CREDIT_COSTS[operation] ?? 1
  const totalDeduction = creditCost * quantity

  // Get current credits from secure user_credits table
  const { data: credits, error: creditsError } = await supabaseAdmin
    .from('user_credits')
    .select('credits_remaining')
    .eq('user_id', userId)
    .single()

  if (creditsError || !credits) {
    console.error('[UsageService] Failed to get user credits for deduction:', creditsError)
    return { success: false, creditsDeducted: 0, creditsRemaining: 0, error: 'Credits record not found' }
  }

  const currentCredits = credits.credits_remaining ?? 0
  const newCredits = Math.max(0, currentCredits - totalDeduction)

  // Update secure user_credits table
  const { error: updateCreditsError } = await supabaseAdmin
    .from('user_credits')
    .update({
      credits_remaining: newCredits,
      last_deducted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (updateCreditsError) {
    console.error('[UsageService] Failed to deduct credits from user_credits:', updateCreditsError)
    return { success: false, creditsDeducted: 0, creditsRemaining: currentCredits, error: updateCreditsError.message }
  }

  // Also update user_profiles for backwards compatibility
  const { error: updateProfileError } = await supabaseAdmin
    .from('user_profiles')
    .update({
      credits_remaining: newCredits,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (updateProfileError) {
    console.warn('[UsageService] Failed to sync credits to user_profiles:', updateProfileError)
    // Don't fail the operation - user_credits is the source of truth
  }

  // Also track the usage event for analytics
  await trackUsage({
    userId,
    operation,
    quantity,
    metadata: { credits_deducted: totalDeduction },
  })

  return {
    success: true,
    creditsDeducted: totalDeduction,
    creditsRemaining: newCredits,
  }
}

/**
 * Get monthly cost for a user (for soft cap warnings)
 */
export async function getMonthlySpend(userId: string): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data, error } = await supabaseAdmin
    .from('usage_events')
    .select('estimated_cost_usd')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())

  if (error) {
    console.error('[UsageService] Failed to get monthly spend:', error)
    return 0
  }

  return data?.reduce((sum, row) => sum + (Number(row.estimated_cost_usd) || 0), 0) ?? 0
}
