// ABOUTME: Stage 8 - Final HTML cleanup and validation
// ABOUTME: Removes empty tags, fixes formatting issues, validates structure

import { ExecutionContext } from '../core/execution-context'

export class CleanupStage {
  async execute(context: ExecutionContext): Promise<ExecutionContext> {
    console.log('[Stage8] Starting Cleanup stage...')

    try {
      const article = context.structured_data

      if (!article) {
        console.log('[Stage8] No article data found, skipping')
        return context
      }

      // Clean all HTML content fields
      const fieldsToClean = [
        'Intro',
        'Direct_Answer',
        'section_01_content',
        'section_02_content',
        'section_03_content',
        'section_04_content',
        'section_05_content',
        'section_06_content',
        'section_07_content',
        'section_08_content',
        'section_09_content',
        'faq_01_answer',
        'faq_02_answer',
        'faq_03_answer',
        'faq_04_answer',
        'faq_05_answer',
        'faq_06_answer',
        'paa_01_answer',
        'paa_02_answer',
        'paa_03_answer',
        'paa_04_answer',
      ]

      let totalCleanups = 0

      for (const field of fieldsToClean) {
        const original = (article as any)[field]
        if (typeof original === 'string' && original.length > 0) {
          const cleaned = this.cleanHtml(original)
          if (cleaned !== original) {
            ;(article as any)[field] = cleaned
            totalCleanups++
          }
        }
      }

      console.log(`[Stage8] Cleaned ${totalCleanups} fields`)

      // Merge parallel_results into article data (Python parity)
      // Add citations_html and internal_links_html fields
      if (context.parallel_results.citations_html) {
        ;(article as any).citations_html = context.parallel_results.citations_html
        console.log('[Stage8] Added citations_html to article data')
      }

      if (context.parallel_results.internal_links_html) {
        ;(article as any).internal_links_html = context.parallel_results.internal_links_html
        console.log('[Stage8] Added internal_links_html to article data')
      }

      // Final validation
      const validation = this.validateArticleStructure(article)
      context.parallel_results.cleanup_validation = validation

      if (!validation.valid) {
        console.warn('[Stage8] Validation warnings:', validation.warnings)
      }

      console.log('[Stage8] Cleanup stage completed successfully')
      return context
    } catch (error) {
      console.error('[Stage8] Error in Cleanup stage:', error)
      return context
    }
  }

  /**
   * Clean HTML content
   */
  private cleanHtml(html: string): string {
    let cleaned = html

    // 1. Remove empty paragraphs
    cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '')

    // 2. Remove empty divs
    cleaned = cleaned.replace(/<div>\s*<\/div>/gi, '')

    // 3. Remove empty spans
    cleaned = cleaned.replace(/<span>\s*<\/span>/gi, '')

    // 4. Remove empty headings
    cleaned = cleaned.replace(/<h[1-6]>\s*<\/h[1-6]>/gi, '')

    // 5. Remove empty list items
    cleaned = cleaned.replace(/<li>\s*<\/li>/gi, '')

    // 6. Remove empty lists
    cleaned = cleaned.replace(/<ul>\s*<\/ul>/gi, '')
    cleaned = cleaned.replace(/<ol>\s*<\/ol>/gi, '')

    // 7. Fix multiple consecutive spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' ')

    // 8. Fix multiple consecutive line breaks
    cleaned = cleaned.replace(/(\n\s*){3,}/g, '\n\n')

    // 9. Remove leading/trailing whitespace in tags
    cleaned = cleaned.replace(/>(\s+)/g, '>')
    cleaned = cleaned.replace(/(\s+)</g, '<')

    // 10. Fix unclosed tags (basic)
    cleaned = this.fixUnclosedTags(cleaned)

    // 11. Normalize quotes
    cleaned = cleaned.replace(/[""]/g, '"')
    cleaned = cleaned.replace(/['']/g, "'")

    // 12. Remove any remaining control characters
    cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')

    return cleaned.trim()
  }

  /**
   * Fix basic unclosed tag issues
   */
  private fixUnclosedTags(html: string): string {
    // Count opening and closing tags for common elements
    const tags = ['p', 'div', 'span', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4']

    for (const tag of tags) {
      const openCount = (html.match(new RegExp(`<${tag}[^>]*>`, 'gi')) || []).length
      const closeCount = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length

      // If more opens than closes, add closing tags at the end
      if (openCount > closeCount) {
        const diff = openCount - closeCount
        for (let i = 0; i < diff; i++) {
          html += `</${tag}>`
        }
      }
    }

    return html
  }

  /**
   * Validate article structure
   */
  private validateArticleStructure(article: any): {
    valid: boolean
    warnings: string[]
    stats: {
      total_sections: number
      total_faqs: number
      total_paas: number
      has_intro: boolean
      has_direct_answer: boolean
    }
  } {
    const warnings: string[] = []

    // Check required fields
    if (!article.meta_title) {
      warnings.push('Missing meta_title')
    } else if (article.meta_title.length > 55) {
      warnings.push(`Meta title too long: ${article.meta_title.length} chars (max 55)`)
    }

    if (!article.Intro || article.Intro.trim().length === 0) {
      warnings.push('Missing or empty Intro')
    }

    if (!article.Direct_Answer || article.Direct_Answer.trim().length === 0) {
      warnings.push('Missing or empty Direct_Answer')
    }

    // Count sections
    let totalSections = 0
    for (let i = 1; i <= 9; i++) {
      const heading = (article as any)[`section_0${i}_heading`]
      const content = (article as any)[`section_0${i}_content`]
      if (heading && content && content.trim().length > 0) {
        totalSections++
      }
    }

    if (totalSections === 0) {
      warnings.push('No sections with content found')
    }

    // Count FAQs
    let totalFaqs = 0
    for (let i = 1; i <= 6; i++) {
      const question = (article as any)[`faq_0${i}_question`]
      const answer = (article as any)[`faq_0${i}_answer`]
      if (question && answer && answer.trim().length > 0) {
        totalFaqs++
      }
    }

    // Count PAAs
    let totalPaas = 0
    for (let i = 1; i <= 4; i++) {
      const question = (article as any)[`paa_0${i}_question`]
      const answer = (article as any)[`paa_0${i}_answer`]
      if (question && answer && answer.trim().length > 0) {
        totalPaas++
      }
    }

    return {
      valid: warnings.length === 0,
      warnings,
      stats: {
        total_sections: totalSections,
        total_faqs: totalFaqs,
        total_paas: totalPaas,
        has_intro: !!article.Intro,
        has_direct_answer: !!article.Direct_Answer,
      },
    }
  }
}
