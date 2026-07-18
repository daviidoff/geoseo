/**
 * ABOUTME: Usage display component showing unified credit balance
 * ABOUTME: All operations share the same credit pool
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Coins, Building2, TrendingUp } from 'lucide-react'
import { useUsage } from '@/hooks/useUsage'

interface UsageDisplayProps {
  compact?: boolean
  showCard?: boolean
  showUpgradeButton?: boolean
}

// Keep old name for backwards compatibility
export function CreditBalance({
  compact = false,
  showCard = true,
  showUpgradeButton = true,
}: UsageDisplayProps) {
  const { data, isLoading, planType, isPro, isBusiness, creditsRemaining } = useUsage()

  const handleUpgrade = () => {
    window.location.href = '/pricing'
  }

  if (isLoading) {
    return (
      <div className="h-20 bg-muted/50 rounded animate-pulse" />
    )
  }

  if (!data) {
    return null
  }

  const { usage } = data

  // Compact view for nav
  if (compact) {
    const creditsDisplay = usage.credits.unlimited
      ? '∞'
      : `${creditsRemaining ?? 0}`

    return (
      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          <div className="text-sm">
            <span className="font-semibold">{creditsDisplay}</span>
            <span className="text-muted-foreground"> credits left</span>
          </div>
        </div>
        {showUpgradeButton && !isPro && !isBusiness && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleUpgrade}
            className="h-7 px-2 text-xs"
          >
            Upgrade
          </Button>
        )}
      </div>
    )
  }

  const usageItems = [
    {
      label: 'Credits',
      icon: Coins,
      used: usage.credits.used,
      limit: usage.credits.limit,
      unlimited: usage.credits.unlimited,
    },
    {
      label: 'Contexts',
      icon: Building2,
      used: usage.contexts.used,
      limit: usage.contexts.limit,
      unlimited: usage.contexts.unlimited,
    },
  ]

  const content = (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Usage This Month</CardTitle>
        <Badge variant="outline" className="capitalize">
          {planType}
        </Badge>
      </CardHeader>
      <CardContent>
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
                      <span className="text-muted-foreground ml-1">(unlimited)</span>
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

          {!isPro && !isBusiness && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg mt-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro for unlimited usage
              </p>
            </div>
          )}

          {showUpgradeButton && !isPro && !isBusiness && (
            <Button onClick={handleUpgrade} className="w-full">
              Upgrade to Pro
            </Button>
          )}
        </div>
      </CardContent>
    </>
  )

  if (!showCard) {
    return <div className="space-y-4">{content}</div>
  }

  return <Card>{content}</Card>
}

// Alias for new name
export { CreditBalance as UsageDisplay }
