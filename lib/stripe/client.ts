/**
 * ABOUTME: Stripe client configuration for payment processing
 * ABOUTME: Handles initialization and common Stripe operations
 */

import Stripe from 'stripe'

// Lazy initialization - only create client when actually used
// This prevents build-time errors when Stripe is not configured
let _stripe: Stripe | null = null

export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    if (!_stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is required')
      }
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-12-15.clover',
        typescript: true,
      })
    }
    return (_stripe as any)[prop]
  }
})

// Stripe product and pricing configuration
// Lazy evaluation to avoid build-time errors
export const STRIPE_CONFIG = {
  get STARTER_PRICE_ID() { return process.env.STRIPE_STARTER_PRICE_ID || '' },
  get PRO_PRICE_ID() { return process.env.STRIPE_PRO_PRICE_ID || '' },
  get ENTERPRISE_PRICE_ID() { return process.env.STRIPE_ENTERPRISE_PRICE_ID || '' },

  // Metered billing for usage
  get METER_ID() { return process.env.STRIPE_METER_ID || '' },
  get METERED_PRICE_ID() { return process.env.STRIPE_METERED_PRICE_ID || '' },
  get METER_EVENT_NAME() { return process.env.STRIPE_METER_EVENT_NAME || 'usage_recorded' },

  // Webhook secret
  get WEBHOOK_SECRET() { return process.env.STRIPE_WEBHOOK_SECRET || '' },
} as const

export type StripeConfig = typeof STRIPE_CONFIG