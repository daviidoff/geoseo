// ABOUTME: Stage 5 - Internal Links generation from sitemap URLs
// ABOUTME: Generates "More Reading" / "Related Links" suggestions

import { ExecutionContext } from '../core/execution-context'

interface InternalLink {
  url: string
  title: string
  relevance: number
}

export class InternalLinksStage {
  async execute(context: ExecutionContext): Promise<ExecutionContext> {
    console.log('[Stage5] Starting Internal Links stage...')

    try {
      // 1. Extract topics from article
      const topics = this.extractTopics(context)
      console.log(`[Stage5] Extracted ${topics.length} topics from article`)

      // 2. Get sitemap URLs
      const sitemapUrls = context.sitemap_data?.sitemap_pages || []
      console.log(`[Stage5] Found ${sitemapUrls.length} sitemap URLs`)

      if (sitemapUrls.length === 0) {
        console.log('[Stage5] No sitemap URLs available - skipping internal links')
        context.parallel_results.internal_links_html = ''
        context.parallel_results.internal_links_count = 0
        return context
      }

      // 3. Generate link suggestions (simple keyword matching)
      const links = this.generateLinkSuggestions(topics, sitemapUrls)
      console.log(`[Stage5] Generated ${links.length} link suggestions`)

      // 4. Format as HTML
      const internalLinksHtml = this.formatInternalLinksHTML(links)

      // 5. Store in context
      context.parallel_results.internal_links_html = internalLinksHtml
      context.parallel_results.internal_links_count = links.length

      console.log('[Stage5] Internal Links stage completed successfully')
      return context
    } catch (error) {
      console.error('[Stage5] Error in Internal Links stage:', error)
      // Graceful degradation
      context.parallel_results.internal_links_html = ''
      context.parallel_results.internal_links_count = 0
      return context
    }
  }

  /**
   * Extract topics from article (headline + section titles)
   */
  private extractTopics(context: ExecutionContext): string[] {
    const topics: string[] = []
    const article = context.structured_data

    if (!article) {
      return topics
    }

    // Add headline
    if (article.Headline) {
      topics.push(article.Headline)
    }

    // Add section titles
    for (let i = 1; i <= 9; i++) {
      const key = `section_${String(i).padStart(2, '0')}_title` as keyof typeof article
      const title = article[key]
      if (title && typeof title === 'string' && title.trim()) {
        topics.push(title.trim())
      }
    }

    return topics
  }

  /**
   * Generate link suggestions using simple keyword matching
   */
  private generateLinkSuggestions(
    topics: string[],
    sitemapUrls: Array<{ url: string; title?: string }>
  ): InternalLink[] {
    const links: InternalLink[] = []

    // Extract keywords from topics (lowercase words > 4 chars)
    const keywords = new Set<string>()
    for (const topic of topics) {
      const words = topic.toLowerCase().match(/\b\w{5,}\b/g) || []
      words.forEach(word => keywords.add(word))
    }

    // Score each sitemap URL by keyword overlap
    for (const sitemapItem of sitemapUrls) {
      const url = sitemapItem.url
      const title = sitemapItem.title || this.extractTitleFromUrl(url)

      // Calculate relevance score (keyword matches)
      const urlText = (url + ' ' + title).toLowerCase()
      let matchCount = 0
      for (const keyword of keywords) {
        if (urlText.includes(keyword)) {
          matchCount++
        }
      }

      if (matchCount > 0) {
        links.push({
          url,
          title,
          relevance: matchCount,
        })
      }
    }

    // Sort by relevance and limit to top 10
    return links
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10)
  }

  /**
   * Format internal links as HTML (Python parity)
   *
   * Python format:
   * <div class="more-links">
   *   <h3>More on this topic</h3>
   *   <ul>
   *     <li><a href="...">Title</a></li>
   *   </ul>
   * </div>
   */
  private formatInternalLinksHTML(links: InternalLink[]): string {
    if (links.length === 0) {
      return ''
    }

    const items = links
      .map(link => `  <li><a href="${this.escapeHtml(link.url)}">${this.escapeHtml(link.title)}</a></li>`)
      .join('\n')

    return `<div class="more-links">
  <h3>More on this topic</h3>
  <ul>
${items}
  </ul>
</div>`
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
        const withoutExt = lastPart.replace(/\.(html|htm|php|asp|aspx)$/, '')
        return withoutExt
          .replace(/[-_]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }
      return parsed.hostname.replace(/^www\./, '')
    } catch {
      return 'Related Article'
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
