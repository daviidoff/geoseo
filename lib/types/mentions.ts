/**
 * Mentions Dashboard Types
 *
 * Type definitions for AI mention tracking across platforms.
 * Used by the Analytics dashboard to display visibility metrics.
 */

/** Supported AI platforms for mention tracking */
export type AIPlatform = 'ChatGPT' | 'Perplexity' | 'Claude' | 'Gemini'

/** Query status during processing */
export type QueryStatus = 'pending' | 'processing' | 'completed' | 'failed'

/** Mention quality classification */
export type MentionType = 'primary' | 'contextual' | 'competitive' | 'passing' | 'none'

/** Visibility band classification */
export type VisibilityBand = 'Dominant' | 'Strong' | 'Moderate' | 'Weak' | 'Minimal'

/**
 * Individual query configuration
 * Users can define up to 10 custom queries
 */
export interface MentionQuery {
  id: string
  query: string
  dimension: string
  isActive: boolean
  lastChecked: string | null
  createdAt: string
}

/**
 * Result from a single query check
 */
export interface QueryResult {
  queryId: string
  query: string
  dimension: string
  platform: AIPlatform
  status: QueryStatus
  rawMentions: number
  cappedMentions: number
  qualityScore: number
  mentionType: MentionType
  position: number | null
  sourceUrls: string[]
  competitorMentions: CompetitorMention[]
  responseText: string
  checkedAt: string
}

/**
 * Competitor mention within a query response
 */
export interface CompetitorMention {
  name: string
  count: number
}

/**
 * Aggregated stats for a single AI platform
 */
export interface PlatformStats {
  platform: AIPlatform
  totalMentions: number
  averageQuality: number
  presenceRate: number
  queriesChecked: number
  successfulQueries: number
  failedQueries: number
  tokensUsed: number
  cost: number
}

/**
 * Aggregated stats by query dimension
 */
export interface DimensionStats {
  dimension: string
  totalMentions: number
  averageQuality: number
  queriesCount: number
}

/**
 * Historical data point for trend tracking
 */
export interface VisibilityTrendPoint {
  date: string
  visibility: number
  mentions: number
  qualityScore: number
}

/**
 * Complete dashboard state
 */
export interface MentionsDashboardState {
  companyName: string
  queries: MentionQuery[]
  lastFullCheck: string | null
  isChecking: boolean
  checkProgress: number
}

/**
 * Complete mentions check result from API
 */
export interface MentionsCheckResult {
  companyName: string
  visibility: number
  band: VisibilityBand
  mentions: number
  presenceRate: number
  qualityScore: number
  maxQuality: number
  platformStats: Record<AIPlatform, PlatformStats>
  dimensionStats: Record<string, DimensionStats>
  queryResults: QueryResult[]
  queriesProcessed: number
  executionTimeSeconds: number
  totalCost: number
  totalTokens: number
  mode: 'fast' | 'comprehensive'
  checkedAt: string
}

/**
 * Saved mentions check for historical tracking
 */
export interface SavedMentionsCheck {
  id: string
  userId: string
  companyName: string
  result: MentionsCheckResult
  createdAt: string
}

/**
 * Query management actions
 */
export interface QueryManagementActions {
  addQuery: (query: Omit<MentionQuery, 'id' | 'createdAt' | 'lastChecked'>) => void
  updateQuery: (id: string, updates: Partial<MentionQuery>) => void
  removeQuery: (id: string) => void
  toggleQuery: (id: string) => void
  reorderQueries: (fromIndex: number, toIndex: number) => void
}

/**
 * Dashboard filter options
 */
export interface MentionsFilterOptions {
  platform: AIPlatform | 'all'
  dimension: string | 'all'
  mentionStatus: 'all' | 'mentioned' | 'not-mentioned'
  searchQuery: string
}

/**
 * Dashboard sort options
 */
export interface MentionsSortOptions {
  column: 'query' | 'platform' | 'dimension' | 'mentions' | 'quality'
  direction: 'asc' | 'desc'
}
