/**
 * Stage 2: Content Generation with Gemini
 *
 * TypeScript port of Python stage_02_gemini_call.py
 *
 * CRITICAL STAGE for deep research:
 * - Uses SharedGeminiClient with Google Search grounding + Serper.dev fallback
 * - Response format: application/json with response schema
 * - Retry logic: exponential backoff (max 3, 5s initial)
 * - Grounding URL extraction from response metadata
 * - ToC label generation
 * - Metadata calculation (word count, read time)
 *
 * Input:
 *   - ExecutionContext.prompt (from Stage 1)
 *   - ExecutionContext.jobConfig.word_count (optional)
 *
 * Output:
 *   - ExecutionContext.rawArticle (JSON string)
 *   - ExecutionContext.structuredData (parsed ArticleOutput)
 *   - ExecutionContext.groundingUrls (source URLs from Google Search)
 *   - ExecutionContext.parallelResults.toc_dict (ToC labels)
 *   - ExecutionContext.parallelResults.metadata (word count, read time)
 */

import { getSystemInstruction } from '../../system-instruction'
import { ExecutionContext } from '../core/execution-context'
import { createSharedGeminiClient, type SharedGeminiClient } from '../../../gemini-shared'

const logger = console

export interface ArticleOutput {
  headline: string
  subtitle?: string
  teaser: string
  direct_answer: string
  intro: string
  meta_title: string
  meta_description: string

  // 9 sections
  section_01_title: string
  section_01_content: string
  section_02_title?: string
  section_02_content?: string
  section_03_title?: string
  section_03_content?: string
  section_04_title?: string
  section_04_content?: string
  section_05_title?: string
  section_05_content?: string
  section_06_title?: string
  section_06_content?: string
  section_07_title?: string
  section_07_content?: string
  section_08_title?: string
  section_08_content?: string
  section_09_title?: string
  section_09_content?: string

  // FAQ (6 items)
  faq_01_question?: string
  faq_01_answer?: string
  faq_02_question?: string
  faq_02_answer?: string
  faq_03_question?: string
  faq_03_answer?: string
  faq_04_question?: string
  faq_04_answer?: string
  faq_05_question?: string
  faq_05_answer?: string
  faq_06_question?: string
  faq_06_answer?: string

  // PAA (4 items)
  paa_01_question?: string
  paa_01_answer?: string
  paa_02_question?: string
  paa_02_answer?: string
  paa_03_question?: string
  paa_03_answer?: string
  paa_04_question?: string
  paa_04_answer?: string

  // Other fields
  key_takeaway_01?: string
  key_takeaway_02?: string
  key_takeaway_03?: string
  TLDR?: string
  Sources?: string
  Search_Queries?: string
  [key: string]: any
}

export class GeminiCallStage {
  private client: SharedGeminiClient
  private modelName: string

  constructor(options: { apiKey?: string; model?: string } = {}) {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY || ''
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable required')
    }

    this.modelName = options.model || 'gemini-3-flash-preview'
    this.client = createSharedGeminiClient(apiKey, this.modelName)

    logger.log('[Stage2] Initialized with SharedGeminiClient, model:', this.modelName)
  }

  async execute(context: ExecutionContext): Promise<ExecutionContext> {
    logger.log('[Stage2] Content Generation with ToC & Metadata')

    // Validate input
    if (!context.prompt) {
      throw new Error('Prompt is required (from Stage 1)')
    }

    const wordCount = context.job_config?.word_count
    const voicePersona = context.company_data?.voice_persona
    const competitorsRaw = context.company_data?.company_competitors || []

    // Process competitors (can be array of strings or comma-separated strings)
    const competitors: string[] = []
    for (const comp of competitorsRaw) {
      if (comp && typeof comp === 'string') {
        if (comp.includes(',')) {
          competitors.push(...comp.split(',').map(c => c.trim()).filter(Boolean))
        } else {
          competitors.push(comp.trim())
        }
      }
    }

    logger.log(`[Stage2] Prompt length: ${context.prompt.length} characters`)
    if (wordCount) {
      logger.log(`[Stage2] Target word count: ${wordCount} words`)
    }
    if (voicePersona) {
      logger.log('[Stage2] 📣 Voice persona found - will inject into system instruction')
    }

    // Build system instruction (with voice persona and competitors)
    const systemInstruction = getSystemInstruction(wordCount, voicePersona, competitors)
    logger.log(`[Stage2] System instruction length: ${systemInstruction.length} chars`)

    // Call Gemini with retry logic
    logger.log(`[Stage2] Calling Gemini API (${this.modelName}) with Google Search grounding...`)
    const rawResponse = await this.generateContentWithRetry(context, systemInstruction)

    logger.log(`[Stage2] ✅ Gemini API call succeeded`)
    logger.log(`[Stage2]    Response size: ${rawResponse.length} characters`)

    // Store grounding URLs from SharedGeminiClient
    const groundingSources = this.client.getLastGroundingSources()
    if (groundingSources.length > 0) {
      logger.log(`[Stage2] 📎 Storing ${groundingSources.length} grounding URLs`)
      context.grounding_urls = groundingSources.map(s => ({
        url: s.url,
        title: s.title,
        domain: s.domain,
      }))
    } else {
      logger.log(`[Stage2] ⚠️  No grounding URLs extracted`)
      context.grounding_urls = []
    }

    // Validate response
    this.validateResponse(rawResponse)

    // Store raw response
    context.raw_article = rawResponse

    // Parse and validate structured data
    logger.log('[Stage2] Extracting and validating structured data...')
    try {
      // Strip markdown code fences and any trailing content (Gemini 2.0 Flash format)
      let cleanedResponse = rawResponse.trim()

      // Remove markdown code fences if present
      if (cleanedResponse.startsWith('```')) {
        // Remove opening ```json or ```
        cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/, '')
        // Find the closing ``` and remove everything after it
        const closingIndex = cleanedResponse.lastIndexOf('```')
        if (closingIndex !== -1) {
          cleanedResponse = cleanedResponse.substring(0, closingIndex)
        }
        logger.log('[Stage2] 🧹 Stripped markdown code fences from response')
      }

      // Additional cleanup: find JSON boundaries and extract just the JSON object
      // Look for the first { and last }
      const firstBrace = cleanedResponse.indexOf('{')
      const lastBrace = cleanedResponse.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1)
      }

      const jsonData = JSON.parse(cleanedResponse)
      logger.log('[Stage2] ✅ JSON parsing successful')
      const structuredData = this.parseAndValidate(jsonData)
      context.structured_data = structuredData
      logger.log('[Stage2] ✅ Structured data extraction complete')
    } catch (e: any) {
      logger.error(`[Stage2] ❌ Structured data extraction failed: ${e.message}`)
      throw new Error(`Failed to extract structured data: ${e.message}`)
    }

    // Generate ToC labels
    logger.log('[Stage2] 📑 Generating ToC labels...')
    context = this.generateTocLabels(context)

    // Calculate metadata
    logger.log('[Stage2] 📊 Calculating metadata...')
    context = this.calculateMetadata(context)

    return context
  }

  private async generateContentWithRetry(
    context: ExecutionContext,
    systemInstruction: string
  ): Promise<string> {
    // Use SharedGeminiClient which has built-in:
    // - Google Search grounding
    // - Serper.dev fallback when quota exhausted
    // - Retry logic with exponential backoff
    // - Grounding metadata extraction
    const result = await this.client.generate({
      prompt: context.prompt,
      enableGrounding: true,
      systemInstruction,
      timeout: 120000, // 2 minutes for blog generation
      temperature: 0.2,
      maxRetries: 3,
    })

    const text = result.text

    if (!text || text.trim().length < 500) {
      throw new Error(`Response too short (${text.length} chars) - likely incomplete`)
    }

    return text
  }

  private validateResponse(response: string): void {
    if (!response || response.trim().length === 0) {
      throw new Error('Empty response from Gemini API')
    }

    if (response.includes('{') && response.includes('}')) {
      logger.log('[Stage2]   ✓ Contains JSON')
    } else {
      logger.log('[Stage2]   ⚠️  May not contain JSON')
    }

    if (response.length < 1000) {
      logger.log(`[Stage2]   ⚠️  Response very short (${response.length} chars)`)
    }
  }

  private parseAndValidate(jsonData: any): ArticleOutput {
    // Normalize data: ensure all values are strings
    const normalized: any = {}
    for (const [key, value] of Object.entries(jsonData)) {
      if (value === null) {
        normalized[key] = ''
      } else if (typeof value === 'string') {
        normalized[key] = value.trim()
      } else if (Array.isArray(value) || typeof value === 'object') {
        normalized[key] = value
      } else {
        normalized[key] = String(value).trim()
      }
    }

    return normalized as ArticleOutput
  }

  private generateTocLabels(context: ExecutionContext): ExecutionContext {
    if (!context.structured_data) {
      context.parallel_results.toc_dict = {}
      return context
    }

    const tocDict: Record<string, any> = {}
    const sections = [
      [1, context.structured_data.section_01_title || ''],
      [2, context.structured_data.section_02_title || ''],
      [3, context.structured_data.section_03_title || ''],
      [4, context.structured_data.section_04_title || ''],
      [5, context.structured_data.section_05_title || ''],
      [6, context.structured_data.section_06_title || ''],
      [7, context.structured_data.section_07_title || ''],
      [8, context.structured_data.section_08_title || ''],
      [9, context.structured_data.section_09_title || ''],
    ]

    // Stop words to skip
    const stopWords = new Set([
      'a', 'an', 'and', 'as', 'at', 'be', 'by', 'for', 'from', 'if',
      'in', 'is', 'it', 'no', 'of', 'on', 'or', 'the', 'to', 'up',
      'we', 'your', 'you', 'with', 'that', 'this', 'when', 'where',
      'which', 'who', 'how', 'what', 'why', 'can', 'will', 'should',
    ])

    for (const [num, title] of sections) {
      if (title && title.trim()) {
        let cleanTitle = title.trim()

        // Remove common question prefixes
        cleanTitle = cleanTitle.replace(/^What is\s+/i, '')
        cleanTitle = cleanTitle.replace(/^How does\s+/i, '')
        cleanTitle = cleanTitle.replace(/^Why does\s+/i, '')

        const words = cleanTitle.split(' ')
        const meaningfulWords = words.filter(
          w => !stopWords.has(w.toLowerCase()) && w.length > 2
        )

        let shortLabel = meaningfulWords.slice(0, 5).join(' ')
        if (!shortLabel) {
          shortLabel = words.slice(0, 5).join(' ') || 'Section'
        }

        if (shortLabel.length > 60) {
          shortLabel = shortLabel.slice(0, 57) + '...'
        }

        tocDict[`section_${String(num).padStart(2, '0')}`] = {
          title: title.trim(),
          short_label: shortLabel,
        }
      }
    }

    logger.log(`[Stage2] ✅ Generated ${Object.keys(tocDict).length} ToC labels`)
    context.parallel_results.toc_dict = tocDict

    return context
  }

  private calculateMetadata(context: ExecutionContext): ExecutionContext {
    if (!context.structured_data) {
      context.parallel_results.metadata = {
        word_count: 0,
        read_time: 0,
        publication_date: new Date().toISOString(),
      }
      return context
    }

    // Count words
    let wordCount = 0
    const article = context.structured_data

    if (article.headline) wordCount += this.countWords(article.headline)
    if (article.teaser) wordCount += this.countWords(article.teaser)
    if (article.direct_answer) wordCount += this.countWords(article.direct_answer)
    if (article.Intro) wordCount += this.countWordsFromHtml(article.Intro)

    // Count section content
    for (let i = 1; i <= 9; i++) {
      const content = article[`section_${String(i).padStart(2, '0')}_content`]
      if (content) {
        wordCount += this.countWordsFromHtml(content)
      }
    }

    // Calculate read time (200 words per minute)
    const readTime = Math.ceil(wordCount / 200)

    // Generate publication date (random within last 90 days)
    const daysBack = Math.floor(Math.random() * 90)
    const publicationDate = new Date()
    publicationDate.setDate(publicationDate.getDate() - daysBack)

    logger.log(`[Stage2] ✅ Metadata: ${wordCount} words, ${readTime} min read, ${publicationDate.toISOString().split('T')[0]}`)

    context.parallel_results.metadata = {
      word_count: wordCount,
      read_time: readTime,
      publication_date: publicationDate.toISOString(),
    }
    context.parallel_results.word_count = wordCount
    context.parallel_results.read_time = readTime
    context.parallel_results.publication_date = publicationDate.toISOString()

    return context
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).length
  }

  private countWordsFromHtml(html: string): number {
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
    return this.countWords(decoded)
  }
}
