/**
 * ABOUTME: Pricing page route for hyperniche.ai
 * ABOUTME: Public page showing subscription plans
 */

import PricingPage from '@/components/pricing/PricingPage'

export const metadata = {
  title: 'Pricing | HyperNiche - Unlimited AEO Content for $99/month',
  description: 'Unlimited AEO content generation. No credits. No limits. Just $99/month.',
}

export default function Page() {
  return <PricingPage />
}
