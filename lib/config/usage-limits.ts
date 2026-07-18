/**
 * ABOUTME: Usage limits configuration for pricing tiers
 * ABOUTME: Re-exports from centralized pricing config - edit lib/config/pricing.config.ts for changes
 */

import {
  PLAN_LIMITS as CONFIG_PLAN_LIMITS,
  PLAN_CREDITS,
  OPERATION_COSTS_USD,
  CREDIT_COSTS,
  type PlanType,
} from '@/lib/config/pricing.config'

// Re-export types and config from centralized source
export type { PlanType }
export type EnforcementMode = 'hard' | 'soft' | 'none'

export interface UsageLimits {
  /** Maximum number of client contexts (null = unlimited) */
  contexts: number | null
  /** Credits per month (null = unlimited) */
  credits_per_month: number | null
  /**
   * Enforcement mode:
   * - 'hard': Block operations when credits exhausted
   * - 'soft': Allow operations but warn/notify
   * - 'none': No enforcement (unlimited credits)
   */
  enforcement: EnforcementMode
}

/**
 * Plan limits configuration - derived from centralized pricing config
 */
export const PLAN_LIMITS: Record<PlanType, UsageLimits> = {
  free: {
    contexts: CONFIG_PLAN_LIMITS.free.contexts,
    credits_per_month: PLAN_CREDITS.free.credits_per_month,
    enforcement: CONFIG_PLAN_LIMITS.free.enforcement,
  },
  pro: {
    contexts: CONFIG_PLAN_LIMITS.pro.contexts,
    credits_per_month: PLAN_CREDITS.pro.credits_per_month,
    enforcement: CONFIG_PLAN_LIMITS.pro.enforcement,
  },
  business: {
    contexts: CONFIG_PLAN_LIMITS.business.contexts,
    credits_per_month: PLAN_CREDITS.business.credits_per_month,
    enforcement: CONFIG_PLAN_LIMITS.business.enforcement,
  },
}

/**
 * Get limits for a specific plan
 */
export function getPlanLimits(planType: PlanType): UsageLimits {
  return PLAN_LIMITS[planType] || PLAN_LIMITS.free
}

/**
 * Check if a plan has unlimited credits
 */
export function hasUnlimitedCredits(planType: PlanType): boolean {
  return PLAN_LIMITS[planType]?.credits_per_month === null
}

/**
 * Check if a plan has a specific limit
 */
export function hasLimit(planType: PlanType, limitType: keyof Omit<UsageLimits, 'enforcement'>): boolean {
  const limits = getPlanLimits(planType)
  return limits[limitType] !== null
}

/**
 * Operation types that consume credits
 */
export type OperationType = 'blog' | 'blog_refresh' | 'keyword' | 'analysis' | 'health_check' | 'mentions_check'

/**
 * Map operation types to their credit costs
 */
export const OPERATION_CREDIT_COSTS: Record<OperationType, number> = {
  blog: CREDIT_COSTS.BLOG_CREATION,
  blog_refresh: CREDIT_COSTS.BLOG_REFRESH,
  keyword: CREDIT_COSTS.KEYWORDS_GENERATION,
  analysis: CREDIT_COSTS.COMPANY_ANALYSIS,
  health_check: CREDIT_COSTS.AEO_HEALTH_CHECK,
  mentions_check: CREDIT_COSTS.AEO_MENTIONS_CHECK,
}

/**
 * Estimated cost per operation in USD - for analytics only
 */
export const OPERATION_COSTS: Record<OperationType, number> = OPERATION_COSTS_USD
