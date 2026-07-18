/**
 * ABOUTME: Blog Generation Engine - TypeScript port of Python openblog with full pipeline
 * ABOUTME: Uses gemini-3-flash-preview with Stages 0-3 (Data→Prompt→Generation→Quality)
 *
 * Optimized with latest Gemini 3 Flash:
 * - gemini-3-flash-preview (Pro-level intelligence at Flash speed & pricing)
 * - Google Search grounding
 * - All quality stages from Python (Stages 0-3 implemented)
 *
 * Architecture matches openkeyword/ResearchEngine pattern:
 * - Zero external dependencies
 * - Runs 100% in Next.js
 * - TypeScript native
 */

import {
  DataFetchStage,
  PromptBuildStage,
  GeminiCallStage,
  QualityRefinementStage,
  CitationsStage,
  InternalLinksStage,
  ImageStage,
  SimilarityCheckStage,
  CleanupStage,
  OutputStage,
} from '../pipeline/stages'
import { type ExecutionContext, createExecutionContext } from '../pipeline/core/execution-context'
import { type ArticleOutput } from '../pipeline/stages/stage-02-gemini-call'

export interface BlogRequest {
  primary_keyword: string
  company_name: string
  company_url: string
  company_data: {
    description: string
    industry: string
    target_audience?: string[]
    competitors?: string[]
  }
  word_count?: number
  language?: string
  country?: string
  tone?: string
  system_prompts?: string[]
  content_generation_instruction?: string
}

export interface BlogResult {
  success: boolean
  headline: string
  html_content: string
  meta_title: string
  meta_description: string
  word_count: number
  read_time: number
  aeo_score: number
  job_id: string
  slug: string
  processing_time_seconds: number
  grounding_urls?: Array<{ url: string; title?: string; domain?: string }>
  quality_score?: number
  quality_failed?: boolean
}

/**
 * Blog generation engine using Gemini with Google Search grounding.
 *
 * Generates high-quality blog articles with:
 * - Deep research via Google Search
 * - Quality refinement
 * - AEO optimization
 * - HTML output
 *
 * Uses gemini-3-flash-preview for optimal speed and quality.
 *
 * Pipeline (matching Python):
 * - Stage 0: Data Fetch (company context)
 * - Stage 1: Prompt Build (rich prompt generation)
 * - Stage 2: Gemini Call (content generation with Google Search)
 * - Stage 3: Quality Refinement (AI-based fixes)
 * - Stages 4-9: Future (citations, internal links, images, etc.)
 */
export class BlogEngine {
  private apiKey: string
  private modelName: string

  // Pipeline stages (all 10)
  private stage0: DataFetchStage
  private stage1: PromptBuildStage
  private stage2: GeminiCallStage
  private stage3: QualityRefinementStage
  private stage4: CitationsStage
  private stage5: InternalLinksStage
  private stage6: ImageStage
  private stage7: SimilarityCheckStage
  private stage8: CleanupStage
  private stage9: OutputStage

  constructor(options: { apiKey?: string; model?: string } = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('API key required. Set GEMINI_API_KEY env var or pass apiKey option.')
    }

    this.modelName = options.model || 'gemini-3-flash-preview'

    // Initialize all pipeline stages
    this.stage0 = new DataFetchStage()
    this.stage1 = new PromptBuildStage()
    this.stage2 = new GeminiCallStage()
    this.stage3 = new QualityRefinementStage()
    this.stage4 = new CitationsStage()
    this.stage5 = new InternalLinksStage()
    this.stage6 = new ImageStage()
    this.stage7 = new SimilarityCheckStage()
    this.stage8 = new CleanupStage()
    this.stage9 = new OutputStage()

    console.log(`[BlogEngine] Initialized with model: ${this.modelName}`)
    console.log('[BlogEngine] Pipeline: Stage 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 (Full 10-stage pipeline)')
  }

  /**
   * Generate a comprehensive blog article.
   *
   * Follows the same pipeline as Python openblog:
   * 1. Stage 0: Data fetch (company context)
   * 2. Stage 1: Prompt building
   * 3. Stage 2: Gemini generation with Search grounding
   * 4. Stage 3: Quality refinement
   * 5. HTML rendering
   */
  async generateBlog(request: BlogRequest): Promise<BlogResult> {
    const startTime = Date.now()
    console.log(`[BlogEngine] Generating blog for: ${request.primary_keyword}`)

    try {
      // Initialize execution context using helper
      const jobId = Date.now().toString()
      let context: ExecutionContext = createExecutionContext(jobId)

      // Set job config
      context.job_config = {
        primary_keyword: request.primary_keyword,
        company_url: request.company_url, // Stage 0 expects this here
        word_count: request.word_count || 3000,
        language: request.language || 'en',
        country: request.country || 'US',
        tone: request.tone || 'professional',
        content_generation_instruction: request.content_generation_instruction,
      }

      // Set company data
      context.company_data = {
        company_name: request.company_name,
        company_url: request.company_url,
        description: request.company_data.description,
        industry: request.company_data.industry,
        target_audience: request.company_data.target_audience,
        company_competitors: request.company_data.competitors,
      }

      // Set language from config
      context.language = request.language || 'en'

      // Stage 0: Data Fetch
      console.log('[BlogEngine] Stage 0: Data fetch...')
      context = await this.stage0.execute(context)

      // Stage 1: Prompt Build
      console.log('[BlogEngine] Stage 1: Prompt build...')
      context = await this.stage1.execute(context)

      // Stage 2: Gemini Call (content generation)
      console.log('[BlogEngine] Stage 2: Gemini content generation...')
      context = await this.stage2.execute(context)

      // Stage 3: Quality Refinement
      console.log('[BlogEngine] Stage 3: Quality refinement...')
      context = await this.stage3.execute(context)

      // Stage 4: Citations
      console.log('[BlogEngine] Stage 4: Citations...')
      context = await this.stage4.execute(context)

      // Stage 5: Internal Links
      console.log('[BlogEngine] Stage 5: Internal links...')
      context = await this.stage5.execute(context)

      // Stages 6 & 7: Run in parallel (matching Python workflow)
      console.log('[BlogEngine] Stages 6 & 7: Images + Similarity Check (parallel)...')
      const [context6, context7] = await Promise.all([
        this.stage6.execute(context),
        this.stage7.execute(context)
      ])
      // Merge results (both stages update different parts of context)
      context = { ...context, ...context6, ...context7 }

      // Stage 8: Cleanup
      console.log('[BlogEngine] Stage 8: Cleanup...')
      context = await this.stage8.execute(context)

      // Stage 9: Final HTML Output
      console.log('[BlogEngine] Stage 9: Final HTML output...')
      context = await this.stage9.execute(context)

      // Get final HTML and article data AFTER all stages complete
      const htmlContent = context.final_output || ''

      // IMPORTANT: Re-capture articleData AFTER Stage 8 adds citations_html/internal_links_html
      const articleData = context.structured_data as ArticleOutput

      if (!articleData) {
        throw new Error('No structured data after pipeline execution')
      }

      if (!htmlContent) {
        throw new Error('No HTML output generated')
      }

      // Calculate metadata
      const wordCount = this.countWords(htmlContent)
      const readTime = Math.ceil(wordCount / 200)

      const processingTime = (Date.now() - startTime) / 1000

      // Extract quality metrics
      const qualityMetrics = context.parallel_results.content_quality as any
      const qualityScore = qualityMetrics?.score || 0
      const qualityFailed = qualityMetrics?.quality_failed || false

      return {
        // PYTHON PARITY: All article fields from Python schema
        ...articleData,

        // TypeScript-specific metadata (non-conflicting fields)
        success: true,
        html_content: htmlContent,
        word_count: wordCount,
        read_time: readTime,
        aeo_score: qualityScore,
        job_id: Date.now().toString(),
        slug: this.generateSlug(request.primary_keyword),
        processing_time_seconds: processingTime,
        grounding_urls: context.grounding_urls,
        quality_score: qualityScore,
        quality_failed: qualityFailed,
      }
    } catch (error) {
      console.error('[BlogEngine] Generation failed:', error)
      throw error
    }
  }

  /**
   * Build HTML content from structured article data
   */
  private buildHtmlContent(article: ArticleOutput): string {
    const sections = []

    // Add intro
    if (article.Intro) {
      sections.push(article.Intro)
    }

    // Add all 9 sections (only if they exist)
    for (let i = 1; i <= 9; i++) {
      const titleKey = `section_${String(i).padStart(2, '0')}_title` as keyof ArticleOutput
      const contentKey = `section_${String(i).padStart(2, '0')}_content` as keyof ArticleOutput

      const title = article[titleKey]
      const content = article[contentKey]

      if (content && typeof content === 'string') {
        sections.push(`<section>`)
        if (title && typeof title === 'string') {
          sections.push(`<h2>${title}</h2>`)
        }
        sections.push(content)
        sections.push(`</section>`)
      }
    }

    // Add FAQ section if present
    const faqSection = this.buildFaqSection(article)
    if (faqSection) {
      sections.push(faqSection)
    }

    // Add PAA section if present
    const paaSection = this.buildPaaSection(article)
    if (paaSection) {
      sections.push(paaSection)
    }

    return `
      <article>
        <header>
          <h1>${article.Headline}</h1>
          ${article.Subtitle ? `<p class="subtitle">${article.Subtitle}</p>` : ''}
        </header>

        ${article.Teaser ? `<p class="teaser">${article.Teaser}</p>` : ''}

        ${article.Direct_Answer ? `<div class="direct-answer">${article.Direct_Answer}</div>` : ''}

        ${sections.join('\n')}
      </article>
    `.trim()
  }

  /**
   * Build FAQ section if present
   */
  private buildFaqSection(article: ArticleOutput): string {
    const faqItems = []
    for (let i = 1; i <= 6; i++) {
      const qKey = `faq_${String(i).padStart(2, '0')}_question` as keyof ArticleOutput
      const aKey = `faq_${String(i).padStart(2, '0')}_answer` as keyof ArticleOutput

      const q = article[qKey]
      const a = article[aKey]

      if (q && a && typeof q === 'string' && typeof a === 'string') {
        faqItems.push({ question: q, answer: a })
      }
    }

    if (faqItems.length === 0) return ''

    return `
      <section class="faq">
        <h2>Frequently Asked Questions</h2>
        ${faqItems
          .map(
            (faq) => `
          <div class="faq-item">
            <h3>${faq.question}</h3>
            <p>${faq.answer}</p>
          </div>
        `
          )
          .join('')}
      </section>
    `.trim()
  }

  /**
   * Build PAA (People Also Ask) section if present
   */
  private buildPaaSection(article: ArticleOutput): string {
    const paaItems = []
    for (let i = 1; i <= 4; i++) {
      const qKey = `paa_${String(i).padStart(2, '0')}_question` as keyof ArticleOutput
      const aKey = `paa_${String(i).padStart(2, '0')}_answer` as keyof ArticleOutput

      const q = article[qKey]
      const a = article[aKey]

      if (q && a && typeof q === 'string' && typeof a === 'string') {
        paaItems.push({ question: q, answer: a })
      }
    }

    if (paaItems.length === 0) return ''

    return `
      <section class="paa">
        <h2>People Also Ask</h2>
        ${paaItems
          .map(
            (paa) => `
          <div class="paa-item">
            <h3>${paa.question}</h3>
            <p>${paa.answer}</p>
          </div>
        `
          )
          .join('')}
      </section>
    `.trim()
  }

  /**
   * Generate URL-friendly slug from keyword
   */
  private generateSlug(keyword: string): string {
    return keyword
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  /**
   * Count words from HTML content
   */
  private countWords(html: string): number {
    // Strip HTML tags
    const text = html.replace(/<[^>]+>/g, ' ')
    // Replace HTML entities
    const decoded = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
    return decoded.trim().split(/\s+/).length
  }
}
