'use client'

import { Coins, AlertCircle, Infinity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useCreditBalance } from '@/hooks/useCreditBalance'
import {
  CREDIT_COSTS,
  SERVICE_DISPLAY_NAMES,
  type ServiceType,
} from '@/lib/config/pricing.config'

interface CreditCostPreviewProps {
  serviceType: ServiceType
  className?: string
  showBalance?: boolean
  compact?: boolean
  quantity?: number
  /** Override the calculated credit cost (useful for dynamic costs like keywords) */
  customCreditCost?: number
}

export function CreditCostPreview({ 
  serviceType, 
  className = '', 
  showBalance = true, 
  compact = false,
  quantity = 1,
  customCreditCost
}: CreditCostPreviewProps) {
  const { credits, isLoading } = useCreditBalance()
  const unitCost = CREDIT_COSTS[serviceType]
  const creditCost = customCreditCost ?? (unitCost * quantity)
  
  if (isLoading) {
    return null
  }

  const isAgencyPlan = credits?.planType === 'agency'
  const hasEnoughCredits = isAgencyPlan || (credits && credits.remainingCredits >= creditCost)
  const willBeOutOfCredits = credits && !isAgencyPlan && (credits.remainingCredits - creditCost <= 0)

  // Use centralized display names from pricing config
  const displayName = SERVICE_DISPLAY_NAMES[serviceType] || serviceType

  return (
    <div className={cn(
      'flex items-center gap-2 text-sm',
      compact ? 'text-xs' : '',
      className
    )}>
      <div className="flex items-center gap-1.5">
        {isAgencyPlan ? (
          <Infinity className="h-3 w-3 text-purple-600" />
        ) : (
          <Coins className="h-3 w-3 text-blue-600" />
        )}
        
        <span className="text-muted-foreground">
          {displayName}:
        </span>
        
        {isAgencyPlan ? (
          <Badge variant="secondary" className={compact ? 'text-xs px-1.5 py-0' : ''}>
            Unlimited
          </Badge>
        ) : (
          <Badge
            variant={hasEnoughCredits ? 'secondary' : 'destructive'}
            className={compact ? 'text-xs px-1.5 py-0' : ''}
          >
            {creditCost} credit{creditCost !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {showBalance && credits && !isAgencyPlan && (
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">•</span>
          
          {!hasEnoughCredits ? (
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <AlertCircle className="h-3 w-3" />
              <span className={compact ? 'text-xs' : 'text-sm'}>
                Insufficient credits
              </span>
            </div>
          ) : (
            <span className={cn(
              'text-muted-foreground',
              willBeOutOfCredits && 'text-amber-600 dark:text-amber-400',
              compact ? 'text-xs' : 'text-sm'
            )}>
              {credits.remainingCredits} remaining
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Re-export SERVICE_DISPLAY_NAMES from centralized config for backward compatibility
export { SERVICE_DISPLAY_NAMES } from '@/lib/config/pricing.config'
