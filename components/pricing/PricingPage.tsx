/**
 * ABOUTME: Pricing page component for hyperniche.ai
 * ABOUTME: Simple usage-based tiers - Free, Pro, Business (supports waitlist mode)
 */

'use client'

import { useState, useEffect } from 'react'
import { Check, Zap, TrendingUp, Building2, Copy, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SUBSCRIPTION_PLANS, type PlanType, mapPlanTypeToPriceId } from '@/lib/stripe/products'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/landing/sections/navbar'
import { FooterSection } from '@/components/landing/sections/footer'
import { createClient } from '@/lib/supabase/client'
import { WaitlistModal } from '@/components/waitlist/WaitlistModal'

const WAITLIST_MODE = process.env.NEXT_PUBLIC_WAITLIST_MODE === 'true'

const PLAN_ICONS: Record<PlanType, typeof Zap> = {
  free: Zap,
  pro: TrendingUp,
  business: Building2,
}

const PLAN_COLORS: Record<PlanType, string> = {
  free: 'border-border',
  pro: 'border-primary ring-2 ring-primary/20',
  business: 'border-purple-500 ring-2 ring-purple-500/20',
}

const SALES_EMAIL = 'fede@scaile.tech'

export default function PricingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState<PlanType | null>(null)
  const [emailCopied, setEmailCopied] = useState(false)
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false)
  const [waitlistSource, setWaitlistSource] = useState('pricing')

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SALES_EMAIL)
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = SALES_EMAIL
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    }
  }

  const handleSubscribe = async (planType: PlanType) => {
    // In waitlist mode, open the modal instead of navigating
    if (WAITLIST_MODE) {
      setWaitlistSource(`pricing-${planType}`)
      setIsWaitlistModalOpen(true)
      return
    }

    if (planType === 'free') {
      router.push('/auth')
      return
    }

    if (planType === 'business') {
      // Open email for business inquiries
      window.location.href = 'mailto:hello@hyperniche.ai?subject=Business%20Plan%20Inquiry'
      return
    }

    setIsLoading(planType)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        const returnUrl = `/pricing?plan=${planType}`
        router.push(`/auth?returnUrl=${encodeURIComponent(returnUrl)}`)
        setIsLoading(null)
        return
      }

      const priceId = mapPlanTypeToPriceId(planType)

      if (!priceId) {
        // Stripe not configured - show helpful message
        const isDev = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost'
        if (isDev) {
          throw new Error(
            'Stripe is not configured. Add STRIPE_PRO_PRICE_ID to your .env.local file. ' +
            'See the README for setup instructions.'
          )
        }
        throw new Error('Subscription is not available yet. Please try again later or contact support.')
      }

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType, priceId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Subscription error:', error)
      alert(error instanceof Error ? error.message : 'Failed to start subscription. Please try again.')
      setIsLoading(null)
    }
  }

  useEffect(() => {
    const checkAuthAndSubscribe = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const planParam = urlParams.get('plan') as PlanType | null

      if (planParam && SUBSCRIPTION_PLANS[planParam]) {
        window.history.replaceState({}, '', '/pricing')

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await handleSubscribe(planParam)
        }
      }
    }

    checkAuthAndSubscribe()
  }, [])

  const plans = (['free', 'pro', 'business'] as PlanType[]).map(
    key => ({ key, ...SUBSCRIPTION_PLANS[key] })
  )

  return (
    <>
      <Navbar />
      {WAITLIST_MODE && (
        <WaitlistModal
          isOpen={isWaitlistModalOpen}
          onClose={() => setIsWaitlistModalOpen(false)}
          source={waitlistSource}
        />
      )}
      <div className="min-h-screen bg-gradient-to-b from-secondary/30 to-background px-4 pt-32 pb-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Unlimited AEO content. <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">$99/month.</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-2">
              No credits to count. No tokens to track.
            </p>
            <p className="text-sm text-muted-foreground">
              Start free with 50 credits. Go unlimited when you&apos;re ready.
            </p>
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {plans.map(({ key: planType, ...plan }) => {
              const Icon = PLAN_ICONS[planType]
              const isPopular = plan.popular
              const isContactUs = plan.contactUs

              return (
                <Card
                  key={planType}
                  className={`relative p-6 flex flex-col ${PLAN_COLORS[planType]} ${
                    isPopular ? 'shadow-xl' : ''
                  }`}
                >
                  {isPopular && (
                    <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                      Most Popular
                    </Badge>
                  )}

                  {/* Icon and name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-secondary rounded-lg">
                      <Icon className="w-5 h-5 text-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">
                      {plan.displayName}
                    </h3>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {isContactUs ? (
                      <div className="text-3xl font-bold text-foreground">
                        Contact us
                      </div>
                    ) : (
                      <div className="text-3xl font-bold text-foreground">
                        {plan.price === 0 ? 'Free' : `$${plan.price}`}
                        {plan.price > 0 && (
                          <span className="text-lg text-muted-foreground font-normal">/month</span>
                        )}
                      </div>
                    )}
                    {plan.maxContexts !== null && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {plan.maxContexts === 1 ? '1 context' : `Up to ${plan.maxContexts} contexts`}
                      </div>
                    )}
                    {plan.maxContexts === null && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Unlimited contexts
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-6">
                    {plan.description}
                  </p>

                  {/* Features */}
                  <ul className="space-y-2 mb-8 flex-grow">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  {planType === 'business' && !WAITLIST_MODE ? (
                    <Button
                      onClick={handleCopyEmail}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      {emailCopied ? (
                        <>
                          <CheckCheck className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Email: {SALES_EMAIL}
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(planType)}
                      disabled={isLoading !== null}
                      variant={isPopular ? 'default' : 'outline'}
                      className="w-full"
                    >
                      {isLoading === planType
                        ? 'Loading...'
                        : WAITLIST_MODE
                        ? 'Join Waitlist'
                        : planType === 'free'
                        ? 'Get Started Free'
                        : 'Subscribe'}
                    </Button>
                  )}
                </Card>
              )
            })}
          </div>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
              Frequently Asked Questions
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  What&apos;s a context?
                </h3>
                <p className="text-muted-foreground text-sm">
                  A context is a company or brand you&apos;re creating content for.
                  Each context stores your company info, tone, and preferences for consistent content generation.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  What happens when I reach my limits?
                </h3>
                <p className="text-muted-foreground text-sm">
                  On the Free plan, you&apos;ll see an upgrade prompt when you hit your monthly limits.
                  Pro and Business plans have no usage limits - generate as much as you need.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  Can I upgrade or downgrade anytime?
                </h3>
                <p className="text-muted-foreground text-sm">
                  Yes! Upgrade instantly to unlock more features. Downgrade anytime from your account settings.
                  Changes take effect at the start of your next billing cycle.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  Is there a free trial for Pro?
                </h3>
                <p className="text-muted-foreground text-sm">
                  The Free plan lets you try all features with limited usage. This way you can fully
                  evaluate HyperNiche before committing to a paid plan.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  What payment methods do you accept?
                </h3>
                <p className="text-muted-foreground text-sm">
                  We accept all major credit cards through Stripe. Business plans can also pay via invoice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <FooterSection />
    </>
  )
}
