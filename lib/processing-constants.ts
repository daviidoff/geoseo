/**
 * ABOUTME: Processing configuration constants for bulk operations
 * ABOUTME: Simplified - global semaphore handles all rate limiting
 */

/**
 * Number of parallel requests for bulk processing
 */
export const PARALLEL_CONCURRENCY = 5

/**
 * Maximum retry attempts per row
 */
export const MAX_RETRY_ATTEMPTS = 3

/**
 * Retry backoff timing (in seconds)
 */
export const RETRY_BACKOFF = {
  initial: 4,
  multiplier: 2,
  max: 16,
} as const
