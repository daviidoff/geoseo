/**
 * ABOUTME: Hook for fetching user usage data
 * ABOUTME: Uses unified credit system - all operations share the same credit pool
 */

'use client'

import { useState, useEffect } from 'react'

interface UsageItem {
  used: number
  limit: number | null
  unlimited: boolean
}

interface UsageData {
  planType: string
  usage: {
    credits: UsageItem
    contexts: UsageItem
  }
  enforcement: 'hard' | 'soft' | 'none'
}

// API response format
interface ApiResponse {
  planType: string
  credits: {
    remaining: number | null
    total: number | null
    used: number
    unlimited: boolean
  }
  contexts: {
    used: number
    limit: number | null
    unlimited: boolean
  }
  enforcement: 'hard' | 'soft' | 'none'
}

export function useUsage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/billing/balance')
      if (response.ok) {
        const json: ApiResponse = await response.json()
        // Transform API response to hook format
        const transformed: UsageData = {
          planType: json.planType,
          usage: {
            credits: {
              used: json.credits.used,
              limit: json.credits.total,
              unlimited: json.credits.unlimited,
            },
            contexts: {
              used: json.contexts.used,
              limit: json.contexts.limit,
              unlimited: json.contexts.unlimited,
            },
          },
          enforcement: json.enforcement,
        }
        setData(transformed)
      } else {
        setError('Failed to fetch usage data')
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err)
      setError('Failed to fetch usage data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [])

  // Helper functions
  const isAtLimit = (type: 'credits' | 'contexts'): boolean => {
    if (!data) return false
    const usage = data.usage[type]
    if (usage.unlimited) return false
    return usage.used >= (usage.limit || 0)
  }

  const getRemaining = (type: 'credits' | 'contexts'): number | null => {
    if (!data) return null
    const usage = data.usage[type]
    if (usage.unlimited) return null
    return Math.max(0, (usage.limit || 0) - usage.used)
  }

  // Credits remaining (for display)
  const creditsRemaining = data?.usage.credits.unlimited
    ? null
    : Math.max(0, (data?.usage.credits.limit || 0) - (data?.usage.credits.used || 0))

  return {
    data,
    isLoading,
    error,
    refetch,
    isAtLimit,
    getRemaining,
    creditsRemaining,
    planType: data?.planType || 'free',
    isPro: data?.planType === 'pro',
    isBusiness: data?.planType === 'business',
  }
}

// Keep old hook for backwards compatibility
export function useCreditBalance() {
  const { data, isLoading, refetch, creditsRemaining } = useUsage()

  // Convert to old format for backwards compatibility (using actual data)
  const totalCredits = data?.usage.credits.limit ?? 50
  const remaining = creditsRemaining ?? 50

  const credits = data
    ? {
        totalCredits,
        remainingCredits: remaining,
        rolledOverCredits: 0,
        planType: data.planType,
        subscriptionStatus: 'active',
      }
    : null

  return {
    credits,
    isLoading,
    refetch,
    isLowCredits: remaining < 10,
    isOutOfCredits: remaining <= 0,
  }
}
