/**
 * ABOUTME: Stripe Product and Price Definitions for hyperniche.ai
 * ABOUTME: Uses centralized pricing config - edit lib/config/pricing.config.ts for pricing changes
 */

import {
  PLAN_PRICING,
  PLAN_LIMITS,
  PLAN_CREDITS,
  type PlanType as ConfigPlanType,
} from '@/lib/config/pricing.config'

// Re-export PlanType from central config
export type PlanType = ConfigPlanType

export interface PlanFeatures {
  name: string
  displayName: string
  description: string
  price: number // Monthly price in dollars (0 for contact us)
  priceId?: string // Stripe Price ID
  maxContexts: number | null // null = unlimited
  includedCredits: number // Credits included per month (-1 = unlimited)
  features: string[]
  popular?: boolean
  contactUs?: boolean // For business tier
}

/**
 * Subscription plan definitions - derived from centralized pricing config
 */
export const SUBSCRIPTION_PLANS: Record<PlanType, PlanFeatures> = {
  free: {
    name: PLAN_PRICING.free.name,
    displayName: PLAN_PRICING.free.displayName,
    description: PLAN_PRICING.free.description,
    price: PLAN_PRICING.free.price,
    maxContexts: PLAN_LIMITS.free.contexts,
    includedCredits: PLAN_CREDITS.free.credits_per_month ?? 0,
    features: [...PLAN_PRICING.free.features],
    popular: PLAN_PRICING.free.popular,
  },
  pro: {
    name: PLAN_PRICING.pro.name,
    displayName: PLAN_PRICING.pro.displayName,
    description: PLAN_PRICING.pro.description,
    price: PLAN_PRICING.pro.price,
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
    maxContexts: PLAN_LIMITS.pro.contexts,
    includedCredits: PLAN_CREDITS.pro.credits_per_month ?? -1, // -1 = unlimited
    features: [...PLAN_PRICING.pro.features],
    popular: PLAN_PRICING.pro.popular,
  },
  business: {
    name: PLAN_PRICING.business.name,
    displayName: PLAN_PRICING.business.displayName,
    description: PLAN_PRICING.business.description,
    price: PLAN_PRICING.business.price,
    maxContexts: PLAN_LIMITS.business.contexts,
    includedCredits: -1, // -1 = unlimited
    features: [...PLAN_PRICING.business.features],
    contactUs: PLAN_PRICING.business.contactUs,
    popular: PLAN_PRICING.business.popular,
  },
}

/**
 * Get plan by name
 */
export function getPlan(planType: PlanType): PlanFeatures {
  return SUBSCRIPTION_PLANS[planType] || SUBSCRIPTION_PLANS.free
}

/**
 * Get all plans as array (sorted by price)
 */
export function getAllPlans(): PlanFeatures[] {
  return Object.values(SUBSCRIPTION_PLANS).sort((a, b) => {
    // Contact us plans go last
    if (a.contactUs && !b.contactUs) return 1
    if (!a.contactUs && b.contactUs) return -1
    return a.price - b.price
  })
}

/**
 * Get plan by Stripe Price ID
 */
export function getPlanByPriceId(priceId: string): PlanFeatures | null {
  return (
    Object.values(SUBSCRIPTION_PLANS).find((plan) => plan.priceId === priceId) || null
  )
}

/**
 * Stripe Product IDs - Update these after creating products in Stripe Dashboard
 */
export const STRIPE_PRICE_IDS = {
  pro_monthly: process.env.STRIPE_PRO_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
}

/**
 * Map Stripe Price ID to internal plan type
 */
export function mapPriceIdToPlanType(priceId: string): PlanType | null {
  if (priceId === STRIPE_PRICE_IDS.pro_monthly) {
    return 'pro'
  }
  return null
}

/**
 * Map internal plan type to Stripe Price ID
 * Returns null if price ID is not configured (empty string or undefined)
 */
export function mapPlanTypeToPriceId(planType: PlanType): string | null {
  switch (planType) {
    case 'pro':
      return STRIPE_PRICE_IDS.pro_monthly || null
    case 'free':
    case 'business':
      return null // Free doesn't need Stripe, Business is contact us
    default:
      return null
  }
}
