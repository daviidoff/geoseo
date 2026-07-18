// ABOUTME: Stage 4 - Citations formatting from grounding URLs
// ABOUTME: Simplified version - uses Google Search grounding URLs, basic HTML formatting

import { ExecutionContext } from '../core/execution-context'

interface GroundingUrl {
  url: string
  title?: string
  domain?: string
}

export class CitationsStage {
  async execute(context: ExecutionContext): Promise<ExecutionContext> {
    console.log('[Stage4] Starting Citations stage...')

    try {
      // 1. Get grounding URLs from Stage 2
      const groundingUrls = context.grounding_urls || []
      console.log(`[Stage4] Found ${groundingUrls.length} grounding URLs`)

      // 2. Extract citations from article Sources field
      const sources = context.structured_data?.Sources || []
      const articleSources = Array.isArray(sources) ? sources : []
      console.log(`[Stage4] Found ${articleSources.length} sources in article`)

      // 3. Combine and deduplicate
      const allCitations = this.mergeCitations(groundingUrls, articleSources)
      console.log(`[Stage4] Total unique citations: ${allCitations.length}`)

      // 4. Format as HTML
      const citationsHtml = this.formatCitationsHTML(allCitations)

      // 5. Store in context
      context.parallel_results.citations_html = citationsHtml
      context.parallel_results.citations_count = allCitations.length

      console.log('[Stage4] Citations stage completed successfully')
      return context
    } catch (error) {
      console.error('[Stage4] Error in Citations stage:', error)
      // Graceful degradation - continue without citations
      context.parallel_results.citations_html = ''
      context.parallel_results.citations_count = 0
      return context
    }
  }

  /**
   * Merge grounding URLs and article sources, removing duplicates
   */
  private mergeCitations(
    groundingUrls: GroundingUrl[],
    articleSources: string[]
  ): GroundingUrl[] {
    const citations = new Map<string, GroundingUrl>()

    // Add grounding URLs first (higher priority)
    for (const item of groundingUrls) {
      if (item.url && this.isValidUrl(item.url)) {
        const normalizedUrl = this.normalizeUrl(item.url)
        citations.set(normalizedUrl, item)
      }
    }

    // Add article sources
    for (const source of articleSources) {
      if (typeof source === 'string' && this.isValidUrl(source)) {
        const normalizedUrl = this.normalizeUrl(source)
        if (!citations.has(normalizedUrl)) {
          citations.set(normalizedUrl, {
            url: source,
            title: this.extractTitleFromUrl(source),
            domain: this.extractDomain(source),
          })
        }
      }
    }

    return Array.from(citations.values())
  }

  /**
   * Format citations as HTML list
   */
  private formatCitationsHTML(citations: GroundingUrl[]): string {
    if (citations.length === 0) {
      return ''
    }

    const items = citations
      .map((citation, index) => {
        const title = citation.title || citation.domain || 'Source'
        const domain = citation.domain || this.extractDomain(citation.url)
        return `  <li>
    <a href="${this.escapeHtml(citation.url)}" target="_blank" rel="noopener noreferrer" class="citation">
      <span class="citation-title">${this.escapeHtml(title)}</span>
      <span class="citation-domain">${this.escapeHtml(domain)}</span>
    </a>
  </li>`
      })
      .join('\n')

    return `<section class="citations">
  <h2>Sources</h2>
  <ol class="citations-list">
${items}
  </ol>
</section>`
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  /**
   * Normalize URL for deduplication
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url)
      // Remove trailing slash, www prefix, convert to lowercase
      let normalized = parsed.href.toLowerCase()
      normalized = normalized.replace(/\/$/, '')
      normalized = normalized.replace(/^(https?:\/\/)(www\.)/, '$1')
      return normalized
    } catch {
      return url.toLowerCase()
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url)
      return parsed.hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  }

  /**
   * Extract title from URL path
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const parsed = new URL(url)
      const pathParts = parsed.pathname.split('/').filter(Boolean)
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1]
        // Remove file extension
        const withoutExt = lastPart.replace(/\.(html|htm|php|asp|aspx)$/, '')
        // Convert hyphens/underscores to spaces and capitalize
        return withoutExt
          .replace(/[-_]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }
      return parsed.hostname.replace(/^www\./, '')
    } catch {
      return 'Source'
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return text.replace(/[&<>"']/g, m => map[m] || m)
  }
}
