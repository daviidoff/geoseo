/**
 * Blog Types
 *
 * Type definitions for blog generation and management.
 * Used by the Blogs page for content creation and organization.
 */

/** Blog generation status */
export type BlogStatus = 'draft' | 'generating' | 'completed' | 'failed' | 'published'

/** Blog content type */
export type BlogContentType = 'single' | 'batch' | 'refresh'

/** Blog tone options */
export type BlogTone =
  | 'professional'
  | 'casual'
  | 'technical'
  | 'conversational'
  | 'authoritative'
  | 'friendly'

/**
 * Blog metadata from generation
 */
export interface BlogMetadata {
  wordCount: number
  generationTimeSeconds: number
  aeoScore: number | null
  readingTimeMinutes: number
  language: string
  country: string
  tone: BlogTone
  model: string
  tokensUsed: number
}

/**
 * Blog entity
 */
export interface Blog {
  id: string
  userId: string
  title: string
  keyword: string
  content: string
  excerpt: string | null
  status: BlogStatus
  contentType: BlogContentType
  metadata: BlogMetadata
  tags: string[]
  category: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

/**
 * Blog list item (lighter version for lists)
 */
export interface BlogListItem {
  id: string
  title: string
  keyword: string
  excerpt: string | null
  status: BlogStatus
  contentType: BlogContentType
  wordCount: number
  aeoScore: number | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

/**
 * Blog generation request
 */
export interface BlogGenerationRequest {
  keyword: string
  title?: string
  outline?: string
  tone: BlogTone
  wordCount: number
  language: string
  country: string
  additionalInstructions?: string
  useContext: boolean
}

/**
 * Batch blog generation request
 */
export interface BatchBlogRequest {
  keywords: Array<{
    keyword: string
    title?: string
    instructions?: string
  }>
  defaultTone: BlogTone
  defaultWordCount: number
  language: string
  country: string
  useContext: boolean
}

/**
 * Blog refresh request
 */
export interface BlogRefreshRequest {
  blogId: string
  refreshType: 'full' | 'partial'
  sectionsToRefresh?: string[]
  additionalInstructions?: string
}

/**
 * Blog filter options
 */
export interface BlogFilterOptions {
  status: BlogStatus | 'all'
  contentType: BlogContentType | 'all'
  tags: string[]
  searchQuery: string
  dateRange: {
    from: string | null
    to: string | null
  }
}

/**
 * Blog sort options
 */
export interface BlogSortOptions {
  column: 'title' | 'keyword' | 'createdAt' | 'updatedAt' | 'wordCount' | 'aeoScore'
  direction: 'asc' | 'desc'
}

/**
 * Blog library state
 */
export interface BlogLibraryState {
  blogs: BlogListItem[]
  selectedIds: Set<string>
  filters: BlogFilterOptions
  sort: BlogSortOptions
  isLoading: boolean
  totalCount: number
  currentPage: number
  pageSize: number
}

/**
 * Blog export format
 */
export type BlogExportFormat = 'html' | 'markdown' | 'docx' | 'pdf' | 'txt'

/**
 * Blog export request
 */
export interface BlogExportRequest {
  blogIds: string[]
  format: BlogExportFormat
  includeMetadata: boolean
}

/**
 * Blog version for history tracking
 */
export interface BlogVersion {
  id: string
  blogId: string
  version: number
  content: string
  metadata: BlogMetadata
  createdAt: string
  changeReason: string | null
}
