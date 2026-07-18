/**
 * ABOUTME: API key management service for power-user programmatic access
 * ABOUTME: Mock implementation - stores keys in memory (no database)
 */

import { createHash, randomBytes } from 'crypto'

export interface ApiKey {
  id: string
  name: string
  key?: string // Only returned on creation
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export interface UsageStats {
  batchesToday: number
  rowsToday: number
  batchesThisMonth: number
  rowsThisMonth: number
  totalBatches: number
  totalRows: number
  dailyBatchLimit: number
  dailyRowLimit: number
  planType: string
  // Token usage
  totalInputTokens: number
  totalOutputTokens: number
  inputTokensToday: number
  outputTokensToday: number
  inputTokensThisMonth: number
  outputTokensThisMonth: number
  // Model breakdown
  tokensByModel: { model: string; inputTokens: number; outputTokens: number; count: number }[]
  // Tool usage
  toolUsage: { tool: string; callCount: number }[]
}

// In-memory storage for API keys (resets on server restart)
const mockApiKeys: Map<string, { userId: string; keyData: ApiKey; keyHash: string }> = new Map()

/**
 * Generate a new API key for a user
 * Format: bgpt_<32_random_chars>
 * Key is hashed with SHA-256 before storage
 */
export async function generateApiKey(userId: string, name: string): Promise<ApiKey> {
  // Generate secure random key
  const randomPart = randomBytes(24).toString('base64url') // URL-safe base64
  const key = `bgpt_${randomPart}`
  const prefix = key.slice(0, 12) // bgpt_<first8>
  const hash = createHash('sha256').update(key).digest('hex')

  const id = `key-${randomBytes(8).toString('hex')}`
  const keyData: ApiKey = {
    id,
    name,
    key, // Only time we return the actual key!
    prefix,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null
  }

  // Store in memory
  mockApiKeys.set(id, { userId, keyData: { ...keyData, key: undefined }, keyHash: hash })

  return keyData
}

/**
 * Verify an API key and return the associated user ID
 * Updates last_used_at timestamp if valid
 */
export async function verifyApiKey(key: string): Promise<string | null> {
  if (!key || !key.startsWith('bgpt_')) {
    return null
  }

  const hash = createHash('sha256').update(key).digest('hex')

  // Find key by hash
  for (const [, entry] of mockApiKeys) {
    if (entry.keyHash === hash && !entry.keyData.revokedAt) {
      // Update last used timestamp
      entry.keyData.lastUsedAt = new Date().toISOString()
      return entry.userId
    }
  }

  return null
}

/**
 * List all API keys for a user (excludes revoked by default)
 */
export async function listApiKeys(userId: string, includeRevoked = false): Promise<ApiKey[]> {
  const keys: ApiKey[] = []

  for (const [, entry] of mockApiKeys) {
    if (entry.userId === userId) {
      if (includeRevoked || !entry.keyData.revokedAt) {
        keys.push(entry.keyData)
      }
    }
  }

  // Sort by created date descending
  return keys.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * Revoke an API key (soft delete - sets revoked_at timestamp)
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<void> {
  const entry = mockApiKeys.get(keyId)
  if (entry && entry.userId === userId) {
    entry.keyData.revokedAt = new Date().toISOString()
  }
}

/**
 * Get usage statistics for a user - returns mock data (no database)
 */
export async function getUserUsage(_userId: string): Promise<UsageStats | null> {
  // Return default/mock stats - no database available
  return {
    batchesToday: 0,
    rowsToday: 0,
    batchesThisMonth: 0,
    rowsThisMonth: 0,
    totalBatches: 0,
    totalRows: 0,
    dailyBatchLimit: 999999,
    dailyRowLimit: 999999999,
    planType: 'free',
    totalInputTokens: 0,
    totalOutputTokens: 0,
    inputTokensToday: 0,
    outputTokensToday: 0,
    inputTokensThisMonth: 0,
    outputTokensThisMonth: 0,
    tokensByModel: [],
    toolUsage: []
  }
}

/**
 * Check if user can process a batch (checks usage limits)
 * Mock implementation - always allows in local mode
 */
export async function checkUsageLimits(
  _userId: string,
  _rowCount: number,
  _testMode = false
): Promise<{
  allowed: boolean
  reason?: string
  batchesToday?: number
  dailyBatchLimit?: number
  rowsToday?: number
  dailyRowLimit?: number
  resetTime?: string
}> {
  // In local/dev mode, always allow
  return { allowed: true }
}

// Note: Plan-based limits removed - all plans now have unlimited batches and rows
// Re-add getPlanLimits function here if plan-based limits are needed in the future
