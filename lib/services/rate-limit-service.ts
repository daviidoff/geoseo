/**
 * Rate Limit Service
 *
 * Tracks token usage and enforces API rate limits
 * - 20M tokens per minute per user
 * - 20k requests per minute per user
 * - Prevents rate limit violations
 *
 * Note: In localStorage mode, rate limits are not enforced (no database)
 */

import { logError, logDebug } from '@/lib/utils/logger'

interface RateLimitStatus {
  isLimited: boolean
  tokensUsed: number
  tokensLimit: number
  tokensRemaining: number
  requestsMade: number
  requestsLimit: number
  requestsRemaining: number
  percentUsed: number
  resetAt: Date
}

/**
 * Check if user has exceeded rate limits
 * In localStorage mode, always allows (no tracking)
 */
export async function checkRateLimit(userId: string): Promise<RateLimitStatus> {
  // In localStorage mode, allow unlimited requests
  return {
    isLimited: false,
    tokensUsed: 0,
    tokensLimit: 20000000,
    tokensRemaining: 20000000,
    requestsMade: 0,
    requestsLimit: 20000,
    requestsRemaining: 20000,
    percentUsed: 0,
    resetAt: new Date(Date.now() + 60000),
  }
}

/**
 * Record token usage for a user
 * In localStorage mode, this is a no-op
 */
export async function recordTokenUsage(
  userId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  // In localStorage mode, we don't track token usage
  logDebug('Token usage (not recorded - localStorage mode)', { userId, inputTokens, outputTokens })
}

/**
 * Get estimated wait time based on queue position
 */
export async function getEstimatedWaitTime(queuePosition: number): Promise<number> {
  // Estimate: ~2 seconds per row processed in parallel
  // Average batch has ~50 rows
  // So average batch takes ~10-15 seconds
  // Add 5 seconds per queued position before user's batch
  const estimatedSeconds = (queuePosition - 1) * 15

  return estimatedSeconds
}

/**
 * Reset rate limits (for testing or admin purposes)
 * In localStorage mode, this is a no-op
 */
export async function resetRateLimits(userId: string): Promise<void> {
  // In localStorage mode, nothing to reset
  logDebug('Rate limits reset (no-op - localStorage mode)', { userId })
}
