/**
 * ABOUTME: Centralized pricing configuration for hyperniche.ai
 * ABOUTME: Single source of truth for all pricing - credits, plans, and service costs
 *
 * ============================================================================
 *                    PRICING CONFIG - SINGLE SOURCE OF TRUTH
 * ============================================================================
 *
 * QUICK EDIT GUIDE:
 * -----------------
 * To change CREDIT COSTS per service → Edit CREDIT_COSTS below (line ~22)
 * To change CREDITS PER PLAN        → Edit PLAN_CREDITS below (line ~45)
 * To change CONTEXT LIMITS          → Edit PLAN_LIMITS below (line ~72)
 * To change PRICES & FEATURES       → Edit PLAN_PRICING below (line ~92)
 *
 * CURRENT PRICING SUMMARY:
 * ------------------------
 * Free:     50 credits/month, 1 context
 * Pro:      999,999 credits/month (soft enforcement), 5 contexts, $99/month
 * Business: 999,999 credits/month (soft enforcement), unlimited contexts, contact sales
 *
 * CREDIT COSTS (current):
 * -----------------------
 * Blog Creation:     8 credits per blog
 * Blog Refresh:      4 credits per blog
 * Keywords:          1 credit per 10 keywords (min 1 credit)
 * Company Analysis:  5 credits
 * AEO Health Check:  5 credits
 * AEO Mentions:      5 credits
 *
 * ============================================================================
 */

// ============================================================================
// CREDIT COSTS PER SERVICE
// ============================================================================
// Edit these values to change how many credits each operation costs

export const CREDIT_COSTS = {
  // Content Generation
  BLOG_CREATION: 8,        // per blog
  BLOG_REFRESH: 4,         // per blog
  KEYWORDS_GENERATION: 1,  // per 10 keywords (min 1 credit)

  // Analysis & Insights
  COMPANY_ANALYSIS: 5,
  AEO_HEALTH_CHECK: 5,
  AEO_MENTIONS_CHECK: 5,

  // Free Operations
  EXPORT: 0,
  SCHEDULED_RUN: 0,
} as const

export type ServiceType = keyof typeof CREDIT_COSTS

// ============================================================================
// CREDITS PER PLAN
// ============================================================================
// Edit these values to change credits included with each plan
// Credits are a unified currency - all services deduct from the same pool

export const PLAN_CREDITS = {
  free: {
    credits_per_month: 50, // 50 credits = ~6 blogs or ~16 keyword generations
    credits_per_week: null, // null = not applicable
    credits_per_day: null,
    rollover: false, // Free credits do NOT roll over
  },
  pro: {
    credits_per_month: 999999, // High limit - effectively unlimited but credits still tracked
    credits_per_week: null,
    credits_per_day: null,
    rollover: true,
  },
  business: {
    credits_per_month: 999999, // High limit - effectively unlimited but credits still tracked
    credits_per_week: null,
    credits_per_day: null,
    rollover: true,
  },
} as const

// ============================================================================
// PLAN USAGE LIMITS
// ============================================================================
// Edit these values to change limits per plan
// Note: All services share the same credit pool - no per-service limits

export const PLAN_LIMITS = {
  free: {
    contexts: 1, // Number of company contexts allowed
    enforcement: 'hard' as const, // 'hard' = block when credits exhausted
  },
  pro: {
    contexts: 5,
    enforcement: 'soft' as const, // 'soft' = credits deducted but no blocking (hidden from UI)
  },
  business: {
    contexts: null, // null = unlimited
    enforcement: 'soft' as const, // 'soft' = credits deducted but no blocking (hidden from UI)
  },
} as const

// ============================================================================
// PLAN PRICING & FEATURES
// ============================================================================
// Edit these values to change plan prices and displayed features

export const PLAN_PRICING = {
  free: {
    name: 'free',
    displayName: 'Free',
    description: 'Try HyperNiche',
    price: 0, // Monthly price in USD (0 = free)
    billingPeriod: 'month' as const,
    contactUs: false,
    popular: false,
    features: [
      '50 credits/month',
      '1 company context',
      'All features included',
      'Community support',
    ],
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    description: 'For professionals',
    price: 99,
    billingPeriod: 'month' as const,
    contactUs: false,
    popular: true,
    features: [
      'Unlimited credits',
      'Up to 5 company contexts',
      'All features included',
      'Priority email support',
    ],
  },
  business: {
    name: 'business',
    displayName: 'Business',
    description: 'For teams and agencies',
    price: 0, // Contact us
    billingPeriod: 'month' as const,
    contactUs: true,
    popular: false,
    features: [
      'Unlimited credits',
      'Unlimited contexts',
      'Team access',
      'API access',
      'Dedicated support',
    ],
  },
} as const

export type PlanType = keyof typeof PLAN_PRICING

// ============================================================================
// OPERATION COSTS (for analytics/billing)
// ============================================================================
// Estimated actual cost per operation in USD

export const OPERATION_COSTS_USD = {
  blog: 0.50,
  blog_refresh: 0.25,
  keyword: 0.05,
  analysis: 0.10,
  health_check: 0.02,
  mentions_check: 0.05,
} as const

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the credit cost for a service
 */
export function getCreditCost(serviceType: ServiceType): number {
  return CREDIT_COSTS[serviceType] ?? 0
}

/**
 * Calculate keyword generation credit units based on count
 * 1 credit per 10 keywords, minimum 1 credit
 */
export function getKeywordCreditUnits(keywordCount: number): number {
  return Math.max(1, Math.ceil(keywordCount / 10))
}

/**
 * Get credits per month for a plan
 */
export function getCreditsPerMonth(planType: PlanType): number | null {
  return PLAN_CREDITS[planType]?.credits_per_month ?? null
}

/**
 * Get plan limits
 */
export function getPlanLimits(planType: PlanType) {
  return PLAN_LIMITS[planType] ?? PLAN_LIMITS.free
}

/**
 * Get plan pricing info
 */
export function getPlanPricing(planType: PlanType) {
  return PLAN_PRICING[planType] ?? PLAN_PRICING.free
}

/**
 * Check if a plan has unlimited (or effectively unlimited) credits
 * Plans with 999,999+ credits are considered "unlimited" for display purposes
 */
export function hasUnlimitedCredits(planType: PlanType): boolean {
  const credits = PLAN_CREDITS[planType]?.credits_per_month
  return credits === null || (typeof credits === 'number' && credits >= 999999)
}

/**
 * Get all plans as array (sorted by price)
 */
export function getAllPlans() {
  return Object.entries(PLAN_PRICING)
    .map(([key, plan]) => ({ key: key as PlanType, ...plan }))
    .sort((a, b) => {
      if (a.contactUs && !b.contactUs) return 1
      if (!a.contactUs && b.contactUs) return -1
      return a.price - b.price
    })
}

// ============================================================================
// SERVICE DISPLAY NAMES
// ============================================================================

export const SERVICE_DISPLAY_NAMES: Record<ServiceType, string> = {
  KEYWORDS_GENERATION: 'Keyword Generation',
  BLOG_CREATION: 'Blog Creation',
  BLOG_REFRESH: 'Blog Refresh',
  AEO_HEALTH_CHECK: 'AEO Health Check',
  AEO_MENTIONS_CHECK: 'AEO Mentions Check',
  COMPANY_ANALYSIS: 'Company Analysis',
  EXPORT: 'Export',
  SCHEDULED_RUN: 'Scheduled Run',
}
