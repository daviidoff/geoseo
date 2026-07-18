/**
 * ExecutionContext - Shared data model for all workflow stages
 *
 * Ported from: openblog/pipeline/core/execution_context.py
 *
 * This is the data structure passed between all 10 stages (0-9).
 * Each stage receives it, modifies it, and passes to the next stage.
 */

export interface SitemapPageList {
  count(): number
  pages: Array<{
    url: string
    label?: string
    is_blog?: boolean
  }>
}

export interface ExecutionContext {
  // ========== STAGE 0: Input ==========
  job_id: string
  job_config: Record<string, any>
  company_data: Record<string, any>
  blog_page: Record<string, any>
  sitemap_pages: SitemapPageList | null
  sitemap_data?: any  // Additional sitemap data
  language: string

  // ========== MARKET PROFILE DATA ==========
  target_market: string
  market_profile: Record<string, any> | null

  // ========== STAGE 1: Prompt ==========
  prompt: string

  // ========== STAGE 2: Raw Content ==========
  raw_article: string
  grounding_urls?: Array<{ url: string; title?: string; domain?: string }>

  // ========== STAGE 3: Quality Refinement Flag ==========
  stage_3_optimized: boolean

  // ========== STAGE 3: Structured Data ==========
  structured_data: any | null

  // ========== STAGES 6-7: Parallel Results ==========
  parallel_results: Record<string, any>

  // ========== STAGE 8: Validated Article ==========
  validated_article: Record<string, any> | null
  quality_report: {
    critical_issues: string[]
    suggestions: string[]
    metrics: {
      aeo_score: number
      readability: number
      keyword_coverage: number
    }
  }

  // ========== STAGE 7: Similarity Check ==========
  similarity_report: any | null
  similarity_recommendations: Record<string, any> | null
  batch_stats: Record<string, any> | null
  regeneration_needed: boolean

  // ========== STAGE 8-9: ArticleOutput ==========
  article_output: any | null

  // ========== STAGE 9: Final Output ==========
  final_article: Record<string, any> | null
  final_output?: string  // HTML output
  storage_result: Record<string, any>

  // ========== Metadata ==========
  created_at: string
  execution_times: Record<string, number>
  errors: Record<string, any>
}

export function createExecutionContext(job_id: string): ExecutionContext {
  return {
    job_id,
    job_config: {},
    company_data: {},
    blog_page: {},
    sitemap_pages: null,
    language: '',
    target_market: '',
    market_profile: null,
    prompt: '',
    raw_article: '',
    stage_3_optimized: false,
    structured_data: null,
    parallel_results: {},
    validated_article: null,
    quality_report: {
      critical_issues: [],
      suggestions: [],
      metrics: {
        aeo_score: 0,
        readability: 0,
        keyword_coverage: 0,
      },
    },
    similarity_report: null,
    similarity_recommendations: null,
    batch_stats: null,
    regeneration_needed: false,
    article_output: null,
    final_article: null,
    storage_result: {},
    created_at: new Date().toISOString(),
    execution_times: {},
    errors: {},
  }
}

export function addExecutionTime(
  context: ExecutionContext,
  stage_name: string,
  duration: number
): void {
  context.execution_times[stage_name] = duration
}

export function addError(
  context: ExecutionContext,
  stage_name: string,
  error: Error,
  additional_context?: Record<string, any>
): void {
  context.errors[stage_name] = {
    type: error.name,
    message: error.message,
    timestamp: new Date().toISOString(),
    stack: error.stack,
    context: additional_context,
  }
}

export function getTotalExecutionTime(context: ExecutionContext): number {
  return Object.values(context.execution_times).reduce((sum, time) => sum + time, 0)
}
