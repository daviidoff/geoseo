/**
 * ABOUTME: Serper.dev Search Provider for Google Search fallback
 * ABOUTME: Used when Gemini's built-in Google Search grounding quota is exhausted
 *
 * API: https://serper.dev/api/search
 * Provides organic results, featured snippets, People Also Ask, related searches
 */

export interface SerperSearchResult {
  title: string
  link: string
  snippet: string
  position: number
}

export interface SerperResponse {
  success: boolean
  error?: string
  results: SerperSearchResult[]
  organic?: Array<{
    title?: string
    link?: string
    snippet?: string
  }>
  answerBox?: {
    answer?: string
    link?: string
  }
  peopleAlsoAsk?: Array<{ question?: string; snippet?: string }>
  relatedSearches?: Array<{ query?: string }>
}

/**
 * SerperProvider - Serper.dev search provider for Google Search fallback
 */
export class SerperProvider {
  private apiKey: string | null = null
  private readonly API_URL = 'https://google.serper.dev/search'
  public readonly name = 'serper'

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SERPER_API_KEY || null

    if (!this.apiKey) {
      console.warn('[SerperProvider] ⚠️ API key not found - search fallback disabled')
    } else {
      console.log('[SerperProvider] ✅ Initialized')
    }
  }

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey)
  }

  /**
   * Execute search using Serper.dev
   */
  async search(
    query: string,
    options: {
      numResults?: number
      language?: string
      country?: string
      timeout?: number
    } = {}
  ): Promise<SerperResponse> {
    // Input validation
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        success: false,
        error: 'Invalid query: must be a non-empty string',
        results: [],
      }
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Serper.dev not configured',
        results: [],
      }
    }

    const { numResults = 10, language = 'en', country = 'us', timeout = 30000 } = options
    const sanitizedQuery = query.trim().slice(0, 500) // Limit query length

    console.log(`[SerperProvider] 🔍 Searching: '${sanitizedQuery}' (${country}, ${language})`)

    const payload = {
      q: sanitizedQuery,
      num: Math.min(numResults, 100), // Serper max is 100
      gl: country,
      hl: language,
    }

    try {
      // Add timeout via AbortController
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorMsg = `Serper.dev API error: HTTP ${response.status}`
        console.error(`[SerperProvider] ❌ ${errorMsg}`)
        return {
          success: false,
          error: errorMsg,
          results: [],
        }
      }

      const data = await response.json()
      const results = this.parseResults(data)

      console.log(`[SerperProvider] ✅ Search successful: ${results.length} results`)

      return {
        success: true,
        results,
        organic: data.organic || [],
        answerBox: data.answerBox,
        peopleAlsoAsk: data.peopleAlsoAsk || [],
        relatedSearches: data.relatedSearches || [],
      }
    } catch (error) {
      const errorMsg = `Serper.dev search error: ${error instanceof Error ? error.message : String(error)}`
      console.error(`[SerperProvider] ❌ ${errorMsg}`)
      return {
        success: false,
        error: errorMsg,
        results: [],
      }
    }
  }

  /**
   * Parse Serper.dev API response
   */
  private parseResults(data: Record<string, unknown>): SerperSearchResult[] {
    const results: SerperSearchResult[] = []
    const organicResults = (data.organic as Array<Record<string, unknown>>) || []

    for (let idx = 0; idx < organicResults.length; idx++) {
      const item = organicResults[idx]
      results.push({
        title: String(item.title || ''),
        link: String(item.link || ''),
        snippet: String(item.snippet || ''),
        position: idx + 1,
      })
    }

    return results
  }

  /**
   * Format search results for LLM consumption
   */
  formatForLLM(response: SerperResponse, maxResults = 5): string {
    if (!response.success) {
      return `Search failed: ${response.error || 'Unknown error'}`
    }

    const results = response.results.slice(0, maxResults)

    if (results.length === 0) {
      return 'No search results found'
    }

    const formattedLines = ['## Web Research Results (from Serper.dev)\n']

    for (const result of results) {
      formattedLines.push(
        `${result.position}. **${result.title}**\n` +
          `   URL: ${result.link}\n` +
          `   ${result.snippet}\n`
      )
    }

    // Add answer box if available
    if (response.answerBox) {
      formattedLines.push('\n## Featured Answer\n')
      if (response.answerBox.answer) {
        formattedLines.push(`${response.answerBox.answer}\n`)
      }
      if (response.answerBox.link) {
        formattedLines.push(`Source: ${response.answerBox.link}\n`)
      }
    }

    return formattedLines.join('\n')
  }
}

// Singleton instance
let serperProviderInstance: SerperProvider | null = null

/**
 * Get or create Serper provider singleton
 */
export function getSerperProvider(): SerperProvider {
  if (!serperProviderInstance) {
    serperProviderInstance = new SerperProvider()
  }
  return serperProviderInstance
}
