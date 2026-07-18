/**
 * ABOUTME: Shared Gemini client with Google Search grounding for all tabs
 * ABOUTME: Combines best features from openblog's Python client into TypeScript
 *
 * Features:
 * - Google Search grounding (free 1,500/day with URL context)
 * - Response schema enforcement for structured JSON output
 * - Grounding metadata extraction (source URLs and inline link positions)
 * - Retry logic with exponential backoff
 * - Rate limiting (60 req/min)
 * - DataForSEO/Serper fallback (when Google Search quota exhausted)
 */

import { BulkGPTError } from './types'

// Types for grounding metadata
export interface GroundingSource {
  url: string
  proxyUrl?: string
  title: string
  domain?: string
}

export interface GroundingSupport {
  startIndex: number
  endIndex: number
  text: string
  chunkIndices: number[]
}

export interface GenerateOptions {
  prompt: string
  enableGrounding?: boolean // Enable Google Search grounding (default: true)
  responseSchema?: Record<string, unknown> // Schema for structured JSON output
  systemInstruction?: string // High-priority system guidance
  timeout?: number // Per-call timeout in ms (default: 90000)
  temperature?: number // 0-1, lower = more consistent (default: 0.2)
  maxRetries?: number // Max retry attempts (default: 3)
}

export interface GenerateResult {
  text: string
  groundingSources: GroundingSource[]
  groundingSupports: GroundingSupport[]
}

/**
 * SharedGeminiClient - Advanced Gemini client with Google Search grounding
 *
 * Based on openblog's Python implementation, adapted for TypeScript/Next.js.
 */
export class SharedGeminiClient {
  private apiKey: string | null = null
  private model: string = 'gemini-3-flash-preview'
  private requestCount = 0
  private windowStartTime = Date.now()

  // Configuration constants
  private readonly RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
  private readonly RATE_LIMIT_MAX = 60 // requests per minute
  private readonly DEFAULT_TIMEOUT = 90 * 1000 // 90 seconds
  private readonly DEFAULT_TEMPERATURE = 0.2 // Consistency
  private readonly MAX_OUTPUT_TOKENS = 65536 // Full article support
  private readonly INITIAL_RETRY_WAIT = 5000 // 5 seconds
  private readonly RETRY_BACKOFF_MULTIPLIER = 2.0

  // Store grounding metadata from last call
  private _lastGroundingSources: GroundingSource[] = []
  private _lastGroundingSupports: GroundingSupport[] = []

  /**
   * Initialize client with API key
   */
  initialize(apiKey: string, model?: string): void {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new BulkGPTError('INVALID_API_KEY', 'Gemini API key is required')
    }

    this.apiKey = apiKey.trim()
    if (model) {
      this.model = model
    }

    console.log(`[SharedGeminiClient] Initialized with model: ${this.model}`)
  }

  /**
   * Check if client is initialized
   */
  private ensureInitialized(): void {
    if (!this.apiKey) {
      throw new BulkGPTError(
        'NOT_INITIALIZED',
        'SharedGeminiClient not initialized. Call initialize(apiKey) first.'
      )
    }
  }

  /**
   * Check rate limit and update counter
   */
  private checkRateLimit(): boolean {
    const now = Date.now()
    const elapsed = now - this.windowStartTime

    // Reset window if time has passed
    if (elapsed > this.RATE_LIMIT_WINDOW) {
      this.requestCount = 0
      this.windowStartTime = now
    }

    // Check if limit exceeded
    if (this.requestCount >= this.RATE_LIMIT_MAX) {
      return false
    }

    this.requestCount++
    return true
  }

  /**
   * Get remaining rate limit count
   */
  getRemainingRequests(): number {
    const now = Date.now()
    if (now - this.windowStartTime > this.RATE_LIMIT_WINDOW) {
      this.requestCount = 0
      this.windowStartTime = now
    }
    return Math.max(0, this.RATE_LIMIT_MAX - this.requestCount)
  }

  /**
   * Generate content with Google Search grounding
   *
   * @param options Generation options
   * @returns Generated text with grounding metadata
   */
  async generate(options: GenerateOptions): Promise<GenerateResult> {
    this.ensureInitialized()

    if (!this.checkRateLimit()) {
      throw new BulkGPTError(
        'RATE_LIMIT_EXCEEDED',
        'Rate limit exceeded (60 requests/minute)'
      )
    }

    const {
      prompt,
      enableGrounding = true,
      responseSchema,
      systemInstruction,
      timeout = this.DEFAULT_TIMEOUT,
      temperature = this.DEFAULT_TEMPERATURE,
      maxRetries = 3,
    } = options

    console.log(`[SharedGeminiClient] Generating content (grounding: ${enableGrounding})`)

    // Reset grounding metadata
    this._lastGroundingSources = []
    this._lastGroundingSupports = []

    // Call API with retry logic
    const result = await this.callApiWithRetry({
      prompt,
      enableGrounding,
      responseSchema,
      systemInstruction,
      timeout,
      temperature,
      maxRetries,
    })

    return {
      text: result,
      groundingSources: this._lastGroundingSources,
      groundingSupports: this._lastGroundingSupports,
    }
  }

  /**
   * Call Gemini API with exponential backoff retry
   */
  private async callApiWithRetry(options: {
    prompt: string
    enableGrounding: boolean
    responseSchema?: Record<string, unknown>
    systemInstruction?: string
    timeout: number
    temperature: number
    maxRetries: number
  }): Promise<string> {
    const { prompt, enableGrounding, responseSchema, systemInstruction, timeout, temperature, maxRetries } = options

    let lastError: Error | null = null
    let waitTime = this.INITIAL_RETRY_WAIT

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[SharedGeminiClient] API call attempt ${attempt + 1}/${maxRetries}`)

        // Build request body
        const requestBody: Record<string, unknown> = {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature,
            maxOutputTokens: this.MAX_OUTPUT_TOKENS,
          },
        }

        // Add system instruction if provided
        if (systemInstruction) {
          requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }],
          }
        }

        // Add Google Search grounding tool if enabled
        if (enableGrounding) {
          requestBody.tools = [
            {
              googleSearch: {},
            },
          ]
          console.log('[SharedGeminiClient] Google Search grounding enabled')
        }

        // Add response schema if provided (for structured JSON output)
        if (responseSchema) {
          const generationConfig = requestBody.generationConfig as Record<string, unknown>
          generationConfig.responseMimeType = 'application/json'
          generationConfig.responseSchema = responseSchema
          console.log('[SharedGeminiClient] Response schema enforced')
        }

        // Make API call with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
              signal: controller.signal,
            }
          )

          clearTimeout(timeoutId)

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`API error ${response.status}: ${errorText}`)
          }

          const data = await response.json()

          // Extract text from response
          const responseText = this.extractTextFromResponse(data)
          if (!responseText) {
            throw new Error('Empty response from Gemini API')
          }

          // Extract grounding metadata
          this.extractGroundingMetadata(data)

          console.log(`[SharedGeminiClient] ✅ Success (${responseText.length} chars, ${this._lastGroundingSources.length} sources)`)
          return responseText

        } finally {
          clearTimeout(timeoutId)
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          console.error(`[SharedGeminiClient] Non-retryable error: ${lastError.message}`)
          throw lastError
        }

        if (attempt < maxRetries - 1) {
          console.warn(`[SharedGeminiClient] Retryable error, waiting ${waitTime}ms: ${lastError.message}`)
          await this.sleep(waitTime)
          waitTime *= this.RETRY_BACKOFF_MULTIPLIER
        }
      }
    }

    // All retries failed - check if we should try Serper.dev fallback
    if (options.enableGrounding && this.shouldUseSearchFallback(lastError)) {
      console.warn('[SharedGeminiClient] 🚨 Google Search quota exhausted, attempting Serper.dev fallback...')
      const fallbackResult = await this.trySerperFallback(options.prompt, lastError)
      if (fallbackResult) {
        return fallbackResult
      }
      console.error('[SharedGeminiClient] ❌ Serper.dev fallback also failed')
    }

    throw lastError || new BulkGPTError('RETRY_FAILED', 'All retry attempts failed')
  }

  /**
   * Check if error indicates Google Search quota exhaustion
   */
  private shouldUseSearchFallback(error: Error | null): boolean {
    if (!error) return false

    const errorStr = error.message.toLowerCase()

    // Patterns indicating Google Search quota exhaustion
    const quotaPatterns = [
      'resource_exhausted',
      'quota',
      'rate limit',
      '429',
      'too many requests',
      'usage limit',
      'daily limit',
      'search grounding',
      'google search',
    ]

    for (const pattern of quotaPatterns) {
      if (errorStr.includes(pattern)) {
        console.log(`[SharedGeminiClient] Detected quota pattern: ${pattern}`)
        return true
      }
    }

    return false
  }

  /**
   * Try Serper.dev fallback when Google Search grounding fails
   */
  private async trySerperFallback(prompt: string, originalError: Error | null): Promise<string | null> {
    try {
      // Lazy import to avoid circular dependencies
      const { getSerperProvider } = await import('./services/serper-provider')
      const provider = getSerperProvider()

      if (!provider.isConfigured()) {
        console.warn('[SharedGeminiClient] Serper.dev fallback not available - API key not configured')
        return null
      }

      // Extract main query from prompt
      const query = this.extractSearchQueryFromPrompt(prompt)
      if (!query) {
        console.warn('[SharedGeminiClient] Could not extract search query from prompt')
        return null
      }

      console.log(`[SharedGeminiClient] 🔍 Serper.dev fallback search: '${query}'`)

      // Execute fallback search
      const searchResponse = await provider.search(query, { numResults: 10 })

      if (!searchResponse.success) {
        console.warn(`[SharedGeminiClient] Serper.dev search failed: ${searchResponse.error}`)
        return null
      }

      // Format results and inject into prompt
      const searchResults = provider.formatForLLM(searchResponse, 5)
      const enhancedPrompt = this.injectSearchResults(prompt, searchResults)

      console.log('[SharedGeminiClient] 🔄 Retrying content generation with Serper.dev results...')

      // Retry WITHOUT Google Search grounding (we have Serper.dev results now)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT)

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: enhancedPrompt }] }],
              generationConfig: {
                temperature: this.DEFAULT_TEMPERATURE,
                maxOutputTokens: this.MAX_OUTPUT_TOKENS,
              },
              // No tools - we injected search results manually
            }),
            signal: controller.signal,
          }
        )

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[SharedGeminiClient] Serper.dev fallback API error: ${errorText}`)
          return null
        }

        const data = await response.json()
        const responseText = this.extractTextFromResponse(data)

        if (responseText) {
          console.log(`[SharedGeminiClient] ✅ Serper.dev fallback succeeded (${responseText.length} chars)`)
          return responseText
        }

        return null
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      console.error(`[SharedGeminiClient] Serper.dev fallback error: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }

  /**
   * Extract the main search query from a content generation prompt
   */
  private extractSearchQueryFromPrompt(prompt: string): string | null {
    const promptLower = prompt.toLowerCase()

    // Common patterns for keyword/topic in prompts
    const patterns = [
      /primary\s*keyword[:\s]*["']?([^"'\n,]+)["']?/i,
      /target\s*keyword[:\s]*["']?([^"'\n,]+)["']?/i,
      /keyword[:\s]*["']?([^"'\n,]+)["']?/i,
      /topic[:\s]*["']?([^"'\n,]+)["']?/i,
      /write\s+(?:about|on)[:\s]*["']?([^"'\n,]+)["']?/i,
      /article\s+(?:about|on)[:\s]*["']?([^"'\n,]+)["']?/i,
    ]

    for (const pattern of patterns) {
      const match = promptLower.match(pattern)
      if (match) {
        const query = match[1].trim()
        if (query.length >= 3 && query.length <= 100) {
          return query
        }
      }
    }

    // Fallback: use first significant line that looks like a topic
    const lines = prompt.split('\n')
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim()
      if (line.length >= 5 && line.length <= 100 && !line.startsWith('#')) {
        const skipWords = ['write', 'create', 'generate', 'the', 'you', 'please', 'make']
        const firstWord = line.split(/\s+/)[0]?.toLowerCase() || ''
        if (!skipWords.includes(firstWord)) {
          return line
        }
      }
    }

    return null
  }

  /**
   * Inject search results into the prompt
   */
  private injectSearchResults(prompt: string, searchResults: string): string {
    return `${searchResults}

Use these sources to inform your content. Cite specific sources where appropriate.

---

${prompt}`
  }

  /**
   * Extract text from Gemini API response
   */
  private extractTextFromResponse(data: Record<string, unknown>): string | null {
    try {
      const candidates = data.candidates as Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>

      if (candidates && candidates[0]?.content?.parts?.[0]?.text) {
        return candidates[0].content.parts[0].text
      }
    } catch {
      // Fall through to return null
    }
    return null
  }

  /**
   * Extract grounding metadata from Gemini API response
   */
  private extractGroundingMetadata(data: Record<string, unknown>): void {
    try {
      const candidates = data.candidates as Array<{
        groundingMetadata?: {
          searchEntryPoint?: { renderedContent?: string }
          groundingChunks?: Array<{
            web?: { uri?: string; title?: string }
          }>
          groundingSupports?: Array<{
            segment?: { startIndex?: number; endIndex?: number; text?: string }
            groundingChunkIndices?: number[]
          }>
        }
      }>

      const metadata = candidates?.[0]?.groundingMetadata
      if (!metadata) return

      // Extract grounding sources (URLs from Google Search)
      if (metadata.groundingChunks) {
        console.log(`[SharedGeminiClient] 📎 ${metadata.groundingChunks.length} grounding chunks`)

        for (const chunk of metadata.groundingChunks) {
          if (chunk.web?.uri) {
            const proxyUrl = chunk.web.uri
            // Resolve proxy URL if it's a Google redirect
            const realUrl = this.resolveProxyUrl(proxyUrl)

            this._lastGroundingSources.push({
              url: realUrl,
              proxyUrl: proxyUrl !== realUrl ? proxyUrl : undefined,
              title: chunk.web.title || realUrl,
              domain: chunk.web.title,
            })
          }
        }

        if (this._lastGroundingSources.length > 0) {
          console.log(`[SharedGeminiClient] ✅ Extracted ${this._lastGroundingSources.length} grounding URLs`)
        }
      }

      // Extract grounding supports (for precise link insertion)
      if (metadata.groundingSupports) {
        console.log(`[SharedGeminiClient] 📍 ${metadata.groundingSupports.length} grounding supports`)

        for (const support of metadata.groundingSupports) {
          if (support.segment && support.groundingChunkIndices) {
            this._lastGroundingSupports.push({
              startIndex: support.segment.startIndex || 0,
              endIndex: support.segment.endIndex || 0,
              text: support.segment.text || '',
              chunkIndices: support.groundingChunkIndices,
            })
          }
        }
      }
    } catch (error) {
      console.warn('[SharedGeminiClient] Error extracting grounding metadata:', error)
    }
  }

  /**
   * Resolve Gemini grounding proxy URL to real destination URL
   *
   * Gemini returns URLs like:
   * https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQ...
   *
   * These redirect (302) to the actual source URL.
   */
  private resolveProxyUrl(proxyUrl: string): string {
    // For now, return as-is (async resolution would require making HTTP calls)
    // In browser environment, we can't easily follow redirects
    // The proxyUrl still works when clicked
    return proxyUrl
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const errorStr = error.message.toLowerCase()

    // Non-retryable patterns
    const nonRetryablePatterns = [
      'authentication',
      '401',
      '403',
      'forbidden',
      'unauthorized',
      'bad request',
      '400',
      'invalid',
      'malformed',
      'api key',
    ]

    for (const pattern of nonRetryablePatterns) {
      if (errorStr.includes(pattern)) {
        return false
      }
    }

    // Retryable patterns
    const retryablePatterns = [
      'rate limit',
      '429',
      'timeout',
      'connection',
      'service unavailable',
      '503',
      'temporarily unavailable',
      'deadline exceeded',
      'resource exhausted',
      'quota',
      'aborted',
    ]

    for (const pattern of retryablePatterns) {
      if (errorStr.includes(pattern)) {
        return true
      }
    }

    // Default: retry unknown errors
    return true
  }

  /**
   * Get grounding sources from last API call
   */
  getLastGroundingSources(): GroundingSource[] {
    return [...this._lastGroundingSources]
  }

  /**
   * Get grounding supports from last API call
   */
  getLastGroundingSupports(): GroundingSupport[] {
    return [...this._lastGroundingSupports]
  }

  /**
   * Escape HTML special characters to prevent XSS
   */
  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return text.replace(/[&<>"']/g, char => htmlEntities[char] || char)
  }

  /**
   * Validate URL to prevent javascript: and data: URI attacks
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }

  /**
   * Insert inline links into content using grounding supports metadata
   *
   * @param content The text content to add links to
   * @returns Content with HTML links inserted at appropriate positions
   */
  insertInlineLinks(content: string): string {
    if (this._lastGroundingSupports.length === 0 || this._lastGroundingSources.length === 0) {
      return content
    }

    let result = content
    let linksInserted = 0

    // Sort supports by startIndex descending so we can insert from end to start
    // (this preserves the indices as we modify the string)
    const sortedSupports = [...this._lastGroundingSupports].sort(
      (a, b) => b.startIndex - a.startIndex
    )

    for (const support of sortedSupports) {
      const segmentText = support.text.trim()
      if (segmentText.length < 20) continue // Skip very short segments

      // Check if chunkIndices array exists and has elements
      if (!support.chunkIndices || support.chunkIndices.length === 0) continue

      const chunkIndex = support.chunkIndices[0]
      if (chunkIndex >= this._lastGroundingSources.length) continue

      const source = this._lastGroundingSources[chunkIndex]
      const url = source.url
      const title = source.title || source.domain || 'Source'

      // Validate URL to prevent XSS via javascript: or data: URIs
      if (!this.isValidUrl(url)) {
        console.warn(`[SharedGeminiClient] Skipping invalid URL: ${url.substring(0, 50)}...`)
        continue
      }

      // Find the segment in content
      if (result.includes(segmentText)) {
        // Escape HTML to prevent XSS attacks
        const safeUrl = this.escapeHtml(url)
        const safeTitle = this.escapeHtml(title)
        const linkHtml = ` <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="${safeTitle}">[${safeTitle}]</a>`
        result = result.replace(segmentText, segmentText + linkHtml)
        linksInserted++
      }
    }

    if (linksInserted > 0) {
      console.log(`[SharedGeminiClient] ✅ Inserted ${linksInserted} inline source links`)
    }

    return result
  }

  /**
   * Extract JSON from text response
   *
   * Response may contain:
   * - JSON wrapped in ```json ... ```
   * - Plain JSON object
   * - Text before/after JSON
   */
  extractJsonFromResponse<T = Record<string, unknown>>(responseText: string): T {
    // Try code block first
    const codeBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]) as T
    }

    // Try plain JSON object
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T
    }

    throw new Error('No JSON found in response')
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Singleton instance
let sharedGeminiClientInstance: SharedGeminiClient | null = null

/**
 * Get or create shared Gemini client singleton
 *
 * Usage:
 * ```ts
 * const client = getSharedGeminiClient()
 * const result = await client.generate({
 *   prompt: 'Generate keywords for...',
 *   enableGrounding: true,
 * })
 * console.log(result.text)
 * console.log(result.groundingSources) // Source URLs from Google Search
 * ```
 */
export function getSharedGeminiClient(): SharedGeminiClient {
  if (!sharedGeminiClientInstance) {
    sharedGeminiClientInstance = new SharedGeminiClient()

    // Try to initialize from environment
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    const model = process.env.GEMINI_MODEL || process.env.NEXT_PUBLIC_GEMINI_MODEL

    if (apiKey) {
      sharedGeminiClientInstance.initialize(apiKey, model)
    }
  }
  return sharedGeminiClientInstance
}

/**
 * Create a new instance (for testing or custom configuration)
 */
export function createSharedGeminiClient(apiKey: string, model?: string): SharedGeminiClient {
  const client = new SharedGeminiClient()
  client.initialize(apiKey, model)
  return client
}
