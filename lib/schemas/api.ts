/**
 * Centralized API Schemas
 * Zod schemas for request validation + TypeScript types for all 5 core endpoints
 */

import { z } from 'zod'

// ============================================================
// 1. GENERATE KEYWORDS
// ============================================================

// Helper to accept string or array and convert to string
const stringOrArray = z.union([
  z.string(),
  z.array(z.string()).transform(arr => arr.join(', ')),
]).optional()

// Keyword-specific research file schema
export const keywordResearchFileSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  content: z.string().optional(),
  fullTextContent: z.string().optional(),
  aiLabels: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  aiAnalysis: z.string().optional(),
  summary: z.string().optional(),
})

// Company context schema for keywords - accepts both camelCase and snake_case
export const keywordCompanyContextSchema = z.object({
  // snake_case (backend format)
  company_name: z.string().optional(),
  company_url: z.string().optional(),
  target_audience: z.string().optional(),
  pain_points: z.array(z.string()).optional(),
  value_propositions: z.array(z.string()).optional(),
  use_cases: z.array(z.string()).optional(),
  content_themes: z.array(z.string()).optional(),
  voice_persona: z.record(z.unknown()).optional(),
  research_files: z.array(keywordResearchFileSchema).optional(),
  // camelCase (frontend format)
  companyName: z.string().optional(),
  companyWebsite: z.string().optional(),
  targetIndustries: z.string().optional(),
  productDescription: z.string().optional(),
  companyDescription: z.string().optional(),
  targetAudience: z.string().optional(),
  brandTone: z.string().optional(),
  painPoints: z.union([z.string(), z.array(z.string())]).optional(),
  valuePropositions: z.union([z.string(), z.array(z.string())]).optional(),
  useCases: z.union([z.string(), z.array(z.string())]).optional(),
  contentThemes: z.union([z.string(), z.array(z.string())]).optional(),
  voicePersona: z.union([z.string(), z.record(z.unknown())]).optional(),
  researchFiles: z.array(keywordResearchFileSchema).optional(),
  // Common fields
  industry: z.string().optional(),
  description: z.string().optional(),
  products: z.union([z.string(), z.array(z.string())]).optional(),
  services: z.union([z.string(), z.array(z.string())]).optional(),
  tone: z.string().optional(),
  competitors: z.union([z.string(), z.array(z.string())]).optional(),
}).passthrough() // Allow additional fields

export const keywordRequestSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  company_url: z.string().url().optional().or(z.literal('')),
  language: z.string().default('en'),
  country: z.string().default('US'),
  num_keywords: z.number().int().min(5).max(100).default(30),
  analyze_first: z.boolean().optional(),
  analyze_company_first: z.boolean().optional(),
  description: stringOrArray,
  industry: stringOrArray,
  products: stringOrArray,
  services: stringOrArray,
  target_audience: stringOrArray,
  competitors: stringOrArray,
  pain_points: stringOrArray,
  value_propositions: stringOrArray,
  use_cases: stringOrArray,
  content_themes: stringOrArray,
  tone: z.string().optional(),
  // Pre-provided company context (full object with research files)
  business_context: keywordCompanyContextSchema.optional(),
  // Custom instructions for keyword generation
  system_instructions: z.string().optional(),
  custom_instructions: z.string().optional(),
})

export type KeywordRequest = z.infer<typeof keywordRequestSchema>

export interface KeywordSerpData {
  organic_results?: Array<{
    position: number
    title: string
    url: string
    snippet: string
  }>
  featured_snippet?: {
    type: string
    content: string
    source_url: string
    source_title: string
  }
  paa_questions?: Array<{
    question: string
    snippet: string
    url: string
  }>
  related_searches?: string[]
}

export interface KeywordContentBrief {
  content_angle?: string
  target_questions?: string[]
  content_gap?: string
  audience_pain_point?: string
  recommended_word_count?: number
}

export interface Keyword {
  keyword: string
  intent: string
  score: number
  is_question: boolean
  source?: string
  cluster_name?: string
  volume?: number
  difficulty?: number
  aeo_opportunity?: string | number
  has_featured_snippet?: boolean
  has_paa?: boolean
  serp_analyzed?: boolean
  serp_data?: KeywordSerpData | Record<string, unknown> | null
  content_brief?: KeywordContentBrief | string | null
}

export interface KeywordMetadata {
  company_name: string
  company_url?: string
  generation_time: number
  total_keywords: number
  research_keywords: number
  serp_analyzed_count: number
  bonus_keywords_count: number
  model: string
  language?: string
  country?: string
  used_context: boolean
  execution_mode: string
  phases: {
    research_duration: number
    serp_analysis_duration: number
    total_research_found: number
    total_bonus_available: number
  }
}

export interface KeywordResponse {
  keywords: Keyword[]
  metadata: KeywordMetadata
}

export interface KeywordErrorResponse {
  error: string
  message?: string
}

// ============================================================
// 2. GENERATE BLOG
// ============================================================

// Research file reference schema
export const researchFileSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  type: z.string().optional(),
  path: z.string().optional(),
  url: z.string().optional(),
  size: z.number().optional(),
  uploadedAt: z.string().optional(),
  content: z.string().optional(),
  fullTextContent: z.string().optional(),
  aiLabels: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  aiAnalysis: z.string().optional(),
  summary: z.string().optional(),
})

export const businessContextSchema = z.object({
  companyName: z.string().nullable().optional(),
  companyWebsite: z.string().nullable().optional(),
  targetIndustries: z.string().nullable().optional(),
  productDescription: z.string().nullable().optional(),
  companyDescription: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  products: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  services: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  targetAudience: z.string().nullable().optional(),
  competitors: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  brandTone: z.string().nullable().optional(),
  tone: z.string().nullable().optional(),
  painPoints: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  valuePropositions: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  useCases: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  contentThemes: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  voicePersona: z.union([z.string(), z.record(z.unknown())]).nullable().optional(),
  visualIdentity: z.record(z.unknown()).nullable().optional(),
  authors: z.array(z.record(z.unknown())).nullable().optional(),
  researchFiles: z.array(researchFileSchema).nullable().optional(),
})

export type BusinessContextInput = z.infer<typeof businessContextSchema>

export const blogRequestSchema = z.object({
  keyword: z.string()
    .min(1, 'Keyword is required')
    .max(200, 'Keyword must be at most 200 characters'),
  word_count: z.number()
    .int('Word count must be an integer')
    .min(500, 'Word count must be at least 500')
    .max(5000, 'Word count must be at most 5000'),
  tone: z.string().optional(),
  system_prompts: z.array(z.string()).optional(),
  additional_instructions: z.string().optional(),
  company_name: z.string().min(1, 'Company name is required'),
  company_url: z.string().url('Company URL must be a valid URL').or(z.literal('')),
  business_context: businessContextSchema.optional(),
  language: z.string().optional(),
  country: z.string().optional(),
  batch_mode: z.boolean().optional(),
  batch_keywords: z.array(z.object({
    keyword: z.string()
      .min(1, 'Batch keyword is required')
      .max(200, 'Batch keyword must be at most 200 characters'),
    word_count: z.number().int().min(500).max(5000).optional(),
    instructions: z.string().optional(),
  })).optional(),
})

export type BlogRequest = z.infer<typeof blogRequestSchema>

export interface BlogMetadata {
  keyword: string
  word_count: number
  generation_time: number
  company_name: string
  company_url: string
  aeo_score?: number
  job_id?: string
  slug?: string
  meta_title?: string
  meta_description?: string
  read_time?: string
}

export interface BlogResponse {
  title: string
  content: string
  metadata: BlogMetadata
}

export interface BlogBatchResult {
  keyword: string
  success: boolean
  title?: string
  content?: string
  metadata?: Omit<BlogMetadata, 'keyword' | 'company_name' | 'company_url' | 'generation_time'>
  error?: string
}

export interface BlogBatchResponse {
  batch_mode: true
  total: number
  successful: number
  failed: number
  generation_time: number
  results: BlogBatchResult[]
  errors?: BlogBatchResult[]
}

export interface BlogErrorResponse {
  error: string
  message?: string
  details?: z.ZodIssue[]
}

// ============================================================
// 3. MENTIONS CHECK
// ============================================================

export const companyInfoSchema = z.object({
  industry: z.string().optional(),
  productCategory: z.string().optional(),
  services: z.array(z.string()).optional(),
  products: z.array(z.string()).optional(),
  pain_points: z.array(z.string()).optional(),
  country_specific_queries: z.array(z.string()).optional(),
  geographic_modifiers: z.array(z.string()).optional(),
  regulatory_requirements: z.array(z.string()).optional(),
  use_cases: z.array(z.string()).optional(),
  description: z.string().optional(),
})

export const companyAnalysisSchema = z.object({
  companyInfo: companyInfoSchema.optional(),
  competitors: z.array(z.object({ name: z.string().min(1) })).optional(),
})

export const mentionsCheckRequestSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  company_analysis: companyAnalysisSchema.optional(),
  company_website: z.string().optional(),
  industry: z.string().optional(),
  language: z.string().default('en'),
  country: z.string().default('us'),
  num_queries: z.number().int().min(5).max(100).default(10),
  mode: z.enum(['fast', 'full']).default('fast'),
})

export type MentionsCheckRequest = z.infer<typeof mentionsCheckRequestSchema>

export interface QueryResult {
  query: string
  dimension: string
  platform: string
  raw_mentions: number
  capped_mentions: number
  quality_score: number
  mention_type: string
  position: number | null
  source_urls: string[]
  competitor_mentions: Array<{ name: string; count: number }>
  response_text: string
}

export interface PlatformStats {
  mentions: number
  quality_score: number
  responses: number
  errors: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost: number
}

export interface DimensionStats {
  mentions: number
  quality_score: number
  queries: number
}

export type VisibilityBand = 'Dominant' | 'Strong' | 'Moderate' | 'Weak' | 'Minimal'

export interface MentionsCheckResponse {
  companyName: string
  visibility: number
  band: VisibilityBand
  mentions: number
  presence_rate: number
  quality_score: number
  max_quality: number
  platform_stats: Record<string, PlatformStats>
  dimension_stats: Record<string, DimensionStats>
  query_results: QueryResult[]
  actualQueriesProcessed: number
  execution_time_seconds: number
  total_cost: number
  total_tokens: number
  mode: 'fast' | 'full'
}

export interface MentionsCheckErrorResponse {
  error: string
  message?: string
}

// ============================================================
// 4. HEALTH CHECK
// ============================================================

export const healthCheckRequestSchema = z.object({
  url: z.string().url('URL must be a valid URL'),
})

export type HealthCheckRequest = z.infer<typeof healthCheckRequestSchema>

export type HealthCheckGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'

export interface HealthCheckIssue {
  check: string
  category: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: string
  impact?: string
  recommendation?: string
}

export interface HealthCheckTierDetails {
  technical: { score: number; total: number }
  structured_data: { score: number; total: number }
  crawler: { score: number; total: number }
  authority: { score: number; total: number }
}

export interface HealthCheckResponse {
  success: boolean
  url: string
  final_url?: string
  overall_score: number
  score: number
  grade: HealthCheckGrade
  visibility_band: VisibilityBand
  visibility_color: string
  checks: HealthCheckIssue[]
  issues: HealthCheckIssue[]
  tier_details: HealthCheckTierDetails
  summary: string
  technical_summary?: string
  structured_data_summary?: string
  crawler_summary?: string
  authority_summary?: string
  metadata?: Record<string, unknown>
  error?: string
}

export interface HealthCheckErrorResponse {
  success: false
  error: string
  message?: string
}

// ============================================================
// 5. BUSINESS CONTEXT
// ============================================================

export const businessContextUpdateSchema = z.object({
  // Context Variables
  tone: z.string().optional(),
  targetCountries: z.string().optional(),
  productDescription: z.string().optional(),
  competitors: z.string().optional(),
  targetIndustries: z.string().optional(),
  complianceFlags: z.string().optional(),
  // Business Context
  icp: z.string().optional(),
  countries: z.array(z.string()).optional(),
  products: z.array(z.string()).optional(),
  valueProposition: z.string().optional(),
  marketingGoals: z.array(z.string()).optional(),
  targetKeywords: z.array(z.string()).optional(),
  competitorKeywords: z.array(z.string()).optional(),
  // GTM Profile (allow empty string which gets treated as null/clearing)
  gtmPlaybook: z.enum(['sales_led', 'plg', 'hybrid', 'channel_led', 'enterprise_infra']).or(z.literal('')).optional().nullable(),
  productType: z.enum(['devtools', 'sales_marketing', 'fintech', 'hr', 'cx', 'security']).or(z.literal('')).optional().nullable(),
  // GTM AI tracking
  gtmPlaybookAISuggestion: z.string().optional(),
  productTypeAISuggestion: z.string().optional(),
  gtmPlaybookConfidence: z.number().min(0).max(1).optional(),
  productTypeConfidence: z.number().min(0).max(1).optional(),
  gtmPlaybookAISuggested: z.boolean().optional(),
  productTypeAISuggested: z.boolean().optional(),
})

export type BusinessContextUpdateRequest = z.infer<typeof businessContextUpdateSchema>

export interface ContextVariables {
  tone?: string
  targetCountries?: string
  productDescription?: string
  competitors?: string
  targetIndustries?: string
  complianceFlags?: string
}

export interface BusinessContext {
  icp?: string
  countries: string[]
  products: string[]
  valueProposition?: string
  marketingGoals: string[]
  targetKeywords: string[]
  competitorKeywords: string[]
}

export interface GTMProfile {
  gtmPlaybook?: string
  productType?: string
  gtmPlaybookAISuggested: boolean
  productTypeAISuggested: boolean
  gtmPlaybookConfidence?: number
  productTypeConfidence?: number
  gtmPlaybookManuallyOverridden: boolean
  productTypeManuallyOverridden: boolean
  gtmPlaybookAISuggestion?: string
  productTypeAISuggestion?: string
}

export interface BusinessContextResponse {
  contextVariables: ContextVariables
  businessContext: BusinessContext
  gtmProfile: GTMProfile
}

export interface BusinessContextUpdateResponse extends BusinessContextResponse {
  success: true
}

export interface BusinessContextErrorResponse {
  error: string
}

// ============================================================
// COMMON ERROR RESPONSE
// ============================================================

export interface APIErrorResponse {
  error: string
  message?: string
  details?: unknown
}
