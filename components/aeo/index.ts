/**
 * AEO (Answer Engine Optimization) Components
 *
 * Export all AEO-related components for easy importing.
 */

export { MentionsDashboard } from './MentionsDashboard'
export { PlatformCard } from './PlatformCard'
export { QueryCard } from './QueryCard'

// Re-export types
export type {
  AIPlatform,
  QueryStatus,
  MentionType,
  VisibilityBand,
  MentionQuery,
  QueryResult,
  CompetitorMention,
  PlatformStats,
  DimensionStats,
  VisibilityTrendPoint,
  MentionsDashboardState,
  MentionsCheckResult,
  SavedMentionsCheck,
  QueryManagementActions,
  MentionsFilterOptions,
  MentionsSortOptions,
} from '@/lib/types/mentions'
