/**
 * ABOUTME: Pricing page route for GeoSEO
 * ABOUTME: Public page showing subscription plans
 */

import PricingPage from '@/components/pricing/PricingPage'

export const metadata = {
  title: 'Pricing | GeoSEO',
  description: 'Unlimited AEO content generation. No credits. No limits. Just $99/month.',
}

export default function Page() {
  return <PricingPage />
}
