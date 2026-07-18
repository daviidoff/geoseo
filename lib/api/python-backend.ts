/**
 * Python Backend Client
 *
 * Client for communicating with the Python mono-python-service backend.
 * Handles async job-based architecture with polling.
 */

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000'
const DEFAULT_POLL_INTERVAL = 2000 // 2 seconds
const DEFAULT_TIMEOUT = 600000 // 10 minutes

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Job<T = unknown> {
  job_id: string
  service_type: string
  status: JobStatus
  request: Record<string, unknown>
  progress: Record<string, unknown> | null
  result: T | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface CreateJobResponse {
  job_id: string
  status: string
  message: string
  created_at: string
}

// ============================================================
// SHARED TYPES
// ============================================================

export interface CompanyContextInput {
  company_name?: string
  company_url?: string
  industry?: string
  description?: string
  products?: string[]
  services?: string[]
  target_audience?: string
  tone?: string
  competitors?: string[]
  pain_points?: string[]
  value_propositions?: string[]
  use_cases?: string[]
  content_themes?: string[]
  voice_persona?: Record<string, unknown>
  visual_identity?: Record<string, unknown>
  authors?: Record<string, unknown>[]
  research_files?: Array<{
    name: string
    content?: string
    fullTextContent?: string
    aiLabels?: string[]
    labels?: string[]
    aiAnalysis?: string
    summary?: string
  }>
}

// ============================================================
// KEYWORDS TYPES
// ============================================================

export interface KeywordsJobRequest {
  company_name: string
  company_url: string
  target_count?: number
  language?: string
  region?: string
  enable_research?: boolean
  enable_clustering?: boolean
  enable_serp_analysis?: boolean
  enable_volume_lookup?: boolean
  serp_sample_size?: number
  // Pre-provided company context (enhances keyword generation)
  company_context?: CompanyContextInput
  // Custom instructions for keyword generation
  system_instructions?: string
  custom_instructions?: string
}

export interface KeywordResult {
  keyword: string
  intent: string
  score: number
  source: string
  is_question: boolean
  cluster?: string
  cluster_name?: string
  volume?: number
  difficulty?: number
  aeo_opportunity?: number
  has_featured_snippet?: boolean
  has_paa?: boolean
  serp_analyzed?: boolean
  // SERP data and content brief
  serp_data?: Record<string, unknown>
  content_brief?: string
}

export interface KeywordCluster {
  name: string
  keywords: string[]
  theme: string
}

export interface KeywordsJobResult {
  company: {
    name: string
    url: string
    industry: string
  }
  statistics: {
    total_keywords: number
    total_clusters: number
    avg_score: number
    ai_calls: number
    duration_seconds: number
  }
  keywords: KeywordResult[]
  clusters: KeywordCluster[]
}

// ============================================================
// BLOG TYPES
// ============================================================

export interface KeywordConfig {
  keyword: string
  word_count?: number
  instructions?: string
}

export interface BlogJobRequest {
  keywords: string[]
  company_url: string
  language?: string
  market?: string
  skip_images?: boolean
  max_parallel?: number
  // New fields for content customization
  word_count?: number
  tone?: string
  custom_instructions?: string
  keyword_configs?: KeywordConfig[]
  // Pre-provided company context (skips Stage 1 extraction)
  company_context?: CompanyContextInput
}

export interface BlogArticle {
  keyword: string
  headline: string
  slug: string
  meta_title: string
  meta_description: string
  html_content: string
  word_count: number
  read_time: string
  aeo_score: number
  sources: string
}

export interface BlogJobResult {
  articles: BlogArticle[]
  statistics: {
    total_articles: number
    avg_word_count: number
    avg_aeo_score: number
    duration_seconds: number
  }
}

// ============================================================
// CONTEXT TYPES
// ============================================================

export interface ContextJobRequest {
  url: string
}

export interface ContextJobResult {
  company_name: string
  company_url: string
  industry: string
  description: string
  products: string[]
  services: string[]
  target_audience: string
  target_audiences: string[]
  competitors: string[]
  competitor_categories: string[]
  value_propositions: string[]
  pain_points: string[]
  use_cases: string[]
  content_themes: string[]
  tone: string
  voice_persona?: Record<string, unknown>
  visual_identity?: Record<string, unknown>
  authors?: Array<Record<string, string>>
  gtm_playbook: string
  product_type: string
  ai_called: boolean
  // Regional/locale settings
  primary_region?: string
  primary_country?: string
  primary_language?: string
  // EEAT data
  eeat?: Record<string, unknown>
}

// ============================================================
// MENTIONS TYPES
// ============================================================

export interface MentionsJobRequest {
  company_name: string
  company_url?: string
  industry?: string
  mode?: 'fast' | 'full'
  num_queries?: number
  language?: string
  country?: string
}

export interface MentionResult {
  query: string
  platform: string
  mentioned: boolean
  position: number | null
  context: string
  competitors_mentioned: string[]
}

export interface MentionsJobResult {
  company_name: string
  visibility_score: number
  visibility_band: string
  total_queries: number
  mentions_count: number
  presence_rate: number
  results: MentionResult[]
  platform_breakdown: Record<string, { mentions: number; queries: number }>
}

// ============================================================
// HEALTH CHECK TYPES
// ============================================================

export interface HealthCheckJobRequest {
  url: string
}

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

export interface HealthCheckJobResult {
  success: boolean
  url: string
  final_url?: string
  score: number
  grade: string
  visibility_band: string
  visibility_color: string
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

// ============================================================
// CLIENT CLASS
// ============================================================

export class PythonBackendClient {
  private baseUrl: string
  private pollInterval: number
  private timeout: number

  constructor(options?: {
    baseUrl?: string
    pollInterval?: number
    timeout?: number
  }) {
    this.baseUrl = options?.baseUrl || PYTHON_BACKEND_URL
    this.pollInterval = options?.pollInterval || DEFAULT_POLL_INTERVAL
    this.timeout = options?.timeout || DEFAULT_TIMEOUT
  }

  /**
   * Check if Python backend is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Create a job and wait for completion
   */
  private async createAndWaitForJob<TRequest, TResult>(
    endpoint: string,
    request: TRequest,
    onProgress?: (job: Job<TResult>) => void
  ): Promise<Job<TResult>> {
    // Create the job with timeout
    const createController = new AbortController()
    const createTimeoutId = setTimeout(() => createController.abort(), 30000) // 30s timeout

    let createResponse: Response
    try {
      createResponse = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: createController.signal,
      })
      clearTimeout(createTimeoutId)
    } catch (error) {
      clearTimeout(createTimeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout while creating job')
      }
      throw error
    }

    if (!createResponse.ok) {
      const error = await createResponse.json()
      throw new Error(error.detail || error.message || 'Failed to create job')
    }

    const createResult: CreateJobResponse = await createResponse.json()
    const jobId = createResult.job_id

    // Poll for completion
    const startTime = Date.now()
    while (Date.now() - startTime < this.timeout) {
      const pollController = new AbortController()
      const pollTimeoutId = setTimeout(() => pollController.abort(), 10000) // 10s timeout per poll

      let statusResponse: Response
      try {
        statusResponse = await fetch(`${this.baseUrl}${endpoint}/${jobId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: pollController.signal,
        })
        clearTimeout(pollTimeoutId)
      } catch (error) {
        clearTimeout(pollTimeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request timeout while polling job status')
        }
        throw error
      }

      if (!statusResponse.ok) {
        throw new Error('Failed to get job status')
      }

      const job: Job<TResult> = await statusResponse.json()

      if (onProgress) {
        onProgress(job)
      }

      if (job.status === 'completed') {
        return job
      }

      if (job.status === 'failed') {
        throw new Error(job.error || 'Job failed')
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, this.pollInterval))
    }

    throw new Error('Job timed out')
  }

  // ============================================================
  // KEYWORDS
  // ============================================================

  async generateKeywords(
    request: KeywordsJobRequest,
    onProgress?: (job: Job<KeywordsJobResult>) => void
  ): Promise<KeywordsJobResult> {
    const job = await this.createAndWaitForJob<KeywordsJobRequest, KeywordsJobResult>(
      '/api/v1/keywords/jobs',
      request,
      onProgress
    )

    if (!job.result) {
      throw new Error('No result returned from keywords job')
    }

    return job.result
  }

  // ============================================================
  // BLOG
  // ============================================================

  async generateBlogs(
    request: BlogJobRequest,
    onProgress?: (job: Job<BlogJobResult>) => void
  ): Promise<BlogJobResult> {
    const job = await this.createAndWaitForJob<BlogJobRequest, BlogJobResult>(
      '/api/v1/blog/jobs',
      request,
      onProgress
    )

    if (!job.result) {
      throw new Error('No result returned from blog job')
    }

    return job.result
  }

  async refreshBlog(article: Record<string, unknown>, keyword: string): Promise<{
    article: Record<string, unknown>
    fixes_applied: number
    fixes: Array<{ field: string; old_value: string; new_value: string; reason: string }>
  }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/v1/blog/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article, keyword }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout while refreshing blog')
      }
      throw error
    }

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || error.message || 'Failed to refresh blog')
    }

    return response.json()
  }

  // ============================================================
  // CONTEXT
  // ============================================================

  /**
   * Analyze context using async job (for longer processing)
   */
  async analyzeContextAsync(
    request: ContextJobRequest,
    onProgress?: (job: Job<ContextJobResult>) => void
  ): Promise<ContextJobResult> {
    const job = await this.createAndWaitForJob<ContextJobRequest, ContextJobResult>(
      '/api/v1/context/jobs',
      request,
      onProgress
    )

    if (!job.result) {
      throw new Error('No result returned from context job')
    }

    return job.result
  }

  /**
   * Analyze context using sync endpoint (faster for single URL)
   * @param url - Company website URL to analyze
   * @param additionalContext - Optional user-provided context (instructions, research, assets)
   */
  async analyzeContext(url: string, additionalContext?: {
    system_instructions?: string
    client_knowledge_base?: string
    content_instructions?: string
    research_files?: Array<{ name: string; content: string }>
    assets?: Array<{ name: string; description: string }>
  }): Promise<ContextJobResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/context/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, ...additionalContext }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || error.message || 'Context analysis failed')
    }

    return response.json()
  }

  // ============================================================
  // MENTIONS
  // ============================================================

  async checkMentions(
    request: MentionsJobRequest,
    onProgress?: (job: Job<MentionsJobResult>) => void
  ): Promise<MentionsJobResult> {
    const job = await this.createAndWaitForJob<MentionsJobRequest, MentionsJobResult>(
      '/api/v1/mentions/jobs',
      request,
      onProgress
    )

    if (!job.result) {
      throw new Error('No result returned from mentions job')
    }

    return job.result
  }

  // ============================================================
  // HEALTH CHECK
  // ============================================================

  async checkHealth(url: string): Promise<HealthCheckJobResult> {
    // Use sync endpoint for faster response
    const response = await fetch(`${this.baseUrl}/api/v1/health-check/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || error.message || 'Health check failed')
    }

    return response.json()
  }

  async checkHealthAsync(
    request: HealthCheckJobRequest,
    onProgress?: (job: Job<HealthCheckJobResult>) => void
  ): Promise<HealthCheckJobResult> {
    const job = await this.createAndWaitForJob<HealthCheckJobRequest, HealthCheckJobResult>(
      '/api/v1/health-check/jobs',
      request,
      onProgress
    )

    if (!job.result) {
      throw new Error('No result returned from health check job')
    }

    return job.result
  }
}

// Default singleton instance
export const pythonBackend = new PythonBackendClient()
