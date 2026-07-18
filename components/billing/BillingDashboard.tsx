/**
 * ABOUTME: Billing dashboard component for subscription management
 * ABOUTME: Shows current plan, credit balance, and upgrade options
 */

'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Zap, ExternalLink, Check, Coins, Building2, CreditCard } from 'lucide-react'
import { SUBSCRIPTION_PLANS, type PlanType } from '@/lib/stripe/products'
import { useUsage } from '@/hooks/useUsage'

export default function BillingDashboard() {
  const { data, isLoading, planType: currentPlanType } = useUsage()

  const handleManageBilling = async () => {
    try {
      const response = await fetch('/api/stripe/create-portal-session', { method: 'POST' })
      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else {
        window.location.href = '/pricing'
      }
    } catch {
      window.location.href = '/pricing'
    }
  }

  const handleUpgrade = () => {
    window.location.href = '/pricing'
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-muted/50 rounded animate-pulse" />
        <div className="h-20 bg-muted/50 rounded animate-pulse" />
        <div className="h-20 bg-muted/50 rounded animate-pulse" />
      </div>
    )
  }

  const planType = (['free', 'pro', 'business'].includes(currentPlanType)
    ? currentPlanType
    : 'free') as PlanType
  const currentPlan = SUBSCRIPTION_PLANS[planType] || SUBSCRIPTION_PLANS.free
  const isFree = planType === 'free'
  const isPro = planType === 'pro'
  const isBusiness = planType === 'business'

  const usageItems = data
    ? [
        {
          label: 'Credits Used',
          icon: Coins,
          used: data.usage.credits.used,
          limit: data.usage.credits.limit,
          unlimited: data.usage.credits.unlimited,
        },
        {
          label: 'Contexts',
          icon: Building2,
          used: data.usage.contexts.used,
          limit: data.usage.contexts.limit,
          unlimited: data.usage.contexts.unlimited,
        },
      ]
    : []

  return (
    <div className="space-y-8">
      {/* Current Plan */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Current Plan</h3>
          <Badge variant="outline" className="capitalize font-medium">
            {currentPlan?.displayName || planType}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-lg">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">
              {currentPlan?.displayName || 'Free'}
            </p>
            <p className="text-sm text-muted-foreground">
              {currentPlan?.price === 0
                ? currentPlan?.contactUs
                  ? 'Contact us for pricing'
                  : 'Free'
                : `$${currentPlan?.price}/month`}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {isFree ? (
            <Button onClick={handleUpgrade} size="sm">
              Upgrade to Pro
            </Button>
          ) : (
            <>
              <Button onClick={handleManageBilling} variant="outline" size="sm">
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Billing
              </Button>
              {!isBusiness && (
                <Button onClick={handleUpgrade} variant="ghost" size="sm">
                  Change Plan
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Usage This Month */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Usage This Month</h3>

        <div className="space-y-4">
          {usageItems.map((item) => {
            const Icon = item.icon
            const percentUsed = item.unlimited
              ? 0
              : item.limit
              ? (item.used / item.limit) * 100
              : 0
            const isAtLimit = !item.unlimited && item.used >= (item.limit || 0)

            return (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </div>
                  <span className={isAtLimit ? 'text-red-500 font-semibold' : ''}>
                    {item.used}
                    {item.unlimited ? '' : ` / ${item.limit}`}
                    {item.unlimited && (
                      <span className="text-muted-foreground text-xs ml-1">(unlimited)</span>
                    )}
                  </span>
                </div>
                {!item.unlimited && (
                  <Progress
                    value={Math.min(100, percentUsed)}
                    className={`h-1.5 ${isAtLimit ? '[&>div]:bg-red-500' : ''}`}
                  />
                )}
              </div>
            )
          })}
        </div>

        {isFree && (
          <Button onClick={handleUpgrade} variant="outline" size="sm" className="w-full">
            Upgrade for Unlimited Usage
          </Button>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Plan Features */}
      {currentPlan && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Plan Features</h3>
          <ul className="space-y-2">
            {currentPlan.features.slice(0, 5).map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
          {isFree && (
            <Button variant="link" onClick={handleUpgrade} className="p-0 h-auto text-sm text-primary">
              View all Pro features <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
