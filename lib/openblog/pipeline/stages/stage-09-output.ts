// ABOUTME: Stage 9 - Final HTML output assembly with complete page structure
// ABOUTME: Generates complete HTML page with meta tags, Schema.org JSON-LD, and full SEO markup

import { ExecutionContext } from '../core/execution-context'

export class OutputStage {
  async execute(context: ExecutionContext): Promise<ExecutionContext> {
    console.log('[Stage9] Starting Output stage...')

    try {
      const article = context.structured_data

      if (!article) {
        throw new Error('No article data found')
      }

      // Assemble complete HTML page (matching Python's HTMLRendererSimple)
      const finalHtml = this.assembleCompleteHTML(context)

      // Store in context
      context.final_output = finalHtml
      context.parallel_results.final_html_length = finalHtml.length

      console.log(`[Stage9] Generated complete HTML page (${finalHtml.length} chars)`)
      console.log('[Stage9] Output stage completed successfully')

      return context
    } catch (error) {
      console.error('[Stage9] Error in Output stage:', error)
      throw error
    }
  }

  /**
   * Assemble complete HTML page with DOCTYPE, meta tags, Schema.org, etc.
   * Matches Python's html_renderer_simple.py implementation
   */
  private assembleCompleteHTML(context: ExecutionContext): string {
    const article = context.structured_data!
    const company = context.company_data || {}

    // Extract article fields
    const headline = this.stripHtml(article.Headline || 'Untitled')
    const teaser = this.stripHtml(article.Teaser || '')
    const intro = article.Intro || ''
    const directAnswer = article.Direct_Answer || ''
    const metaTitle = this.stripHtml(article.Meta_Title || headline)
    const metaDesc = this.stripHtml(article.Meta_Description || teaser)

    // Company info
    const companyName = company.company_name || ''
    const companyUrl = company.company_url || ''
    const authorName = company.author_name || companyName

    // Generate article URL
    const articleUrl = this.generateArticleUrl(headline, companyUrl)

    // Current date
    const now = new Date()
    const publicationDate = now.toISOString()
    const displayDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    // Generate Schema.org JSON-LD markup
    const schemasHtml = this.generateSchemaMarkup(article, company, articleUrl, publicationDate)

    // Render sections
    const sectionsHtml = this.renderSections(article)

    // Render intro
    const introHtml = intro ? `<div class="intro">${intro}</div>` : ''

    // Render citations
    const citationsHtml = this.renderCitations(context)

    // Render FAQ/PAA
    const faqHtml = this.renderFaq(article)
    const paaHtml = this.renderPaa(article)

    // Render TOC
    const tocHtml = this.renderToc(article)

    // Featured image (if available from context)
    const featuredImage = (article as any)._featured_image_url || ''
    const featuredImageHtml = featuredImage
      ? `<img src="${this.escape(featuredImage)}" alt="${this.escape(headline)}" class="featured-image">`
      : ''

    // Build complete HTML page
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${this.escape(metaDesc)}">
    <meta name="robots" content="index, follow">
    <meta name="author" content="${this.escape(companyName)}">
    <title>${this.escape(metaTitle)}</title>

    ${articleUrl ? `<link rel="canonical" href="${this.escape(articleUrl)}">` : ''}

    <!-- Open Graph -->
    <meta property="og:title" content="${this.escape(metaTitle)}">
    <meta property="og:description" content="${this.escape(metaDesc)}">
    <meta property="og:type" content="article">
    ${featuredImage ? `<meta property="og:image" content="${this.escape(featuredImage)}">` : ''}
    ${articleUrl ? `<meta property="og:url" content="${this.escape(articleUrl)}">` : ''}

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${this.escape(metaTitle)}">
    <meta name="twitter:description" content="${this.escape(metaDesc)}">
    ${featuredImage ? `<meta name="twitter:image" content="${this.escape(featuredImage)}">` : ''}

    <!-- Schema.org JSON-LD -->
    ${schemasHtml}

    <style>
        :root {
            --primary: #2563eb;
            --text: #1f2937;
            --text-light: #6b7280;
            --bg: #ffffff;
            --bg-light: #f9fafb;
            --border: #e5e7eb;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.7;
            color: var(--text);
            background: var(--bg);
        }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        header { padding: 40px 0 20px; border-bottom: 1px solid var(--border); margin-bottom: 30px; }
        h1 { font-size: 2.2em; line-height: 1.2; margin-bottom: 15px; }
        .teaser { font-size: 1.2em; color: var(--text-light); margin-bottom: 15px; }
        .meta { font-size: 0.9em; color: var(--text-light); }
        .featured-image { width: 100%; height: auto; border-radius: 8px; margin-bottom: 30px; }
        .intro { font-size: 1.1em; margin-bottom: 30px; padding: 20px; background: var(--bg-light); border-radius: 8px; }
        .intro p { margin-bottom: 15px; }
        .direct-answer { margin: 30px 0; padding: 20px; background: var(--bg-light); border-left: 4px solid var(--primary); border-radius: 4px; }
        .toc { margin: 30px 0; padding: 20px; background: var(--bg-light); border-radius: 8px; }
        .toc h2 { font-size: 1.2em; margin-bottom: 15px; }
        .toc ul { list-style: none; }
        .toc li { margin: 8px 0; }
        .toc a { color: var(--primary); text-decoration: none; }
        article { margin: 40px 0; }
        article h2 { font-size: 1.6em; margin: 40px 0 20px; }
        article h3 { font-size: 1.3em; margin: 30px 0 15px; }
        article p { margin: 15px 0; }
        article ul, article ol { margin: 15px 0 15px 30px; }
        article li { margin: 8px 0; }
        article a { color: var(--primary); }
        .citations { margin: 40px 0; padding: 20px; background: var(--bg-light); border-left: 4px solid var(--primary); }
        .citations h2 { font-size: 1.2em; margin-bottom: 15px; }
        .citations ol { margin: 0 0 0 20px; }
        .citations li { margin: 10px 0; }
        .faq, .paa { margin: 40px 0; }
        .faq h2, .paa h2 { font-size: 1.4em; margin-bottom: 20px; }
        .faq-item, .paa-item { margin: 20px 0; }
        .faq-item h3, .paa-item h3 { font-size: 1.1em; margin-bottom: 10px; color: var(--text); }
        .faq-item p, .paa-item p { color: var(--text-light); }
    </style>
</head>
<body>
    <header class="container">
        <h1>${this.escape(headline)}</h1>
        ${teaser ? `<p class="teaser">${this.escape(teaser)}</p>` : ''}
        <p class="meta">By ${this.escape(authorName)} • ${displayDate}</p>
    </header>

    <main class="container">
        ${featuredImageHtml}

        ${directAnswer ? `<div class="direct-answer">${directAnswer}</div>` : ''}

        ${introHtml}

        ${tocHtml}

        <article>
            ${sectionsHtml}
        </article>

        ${paaHtml}
        ${faqHtml}

        ${citationsHtml}
    </main>
</body>
</html>`
  }

  /**
   * Generate Schema.org JSON-LD markup (Article + FAQPage)
   */
  private generateSchemaMarkup(article: any, company: any, articleUrl: string | null, publicationDate: string): string {
    const companyName = company.company_name || 'Company'
    const companyUrl = company.company_url || ''

    // Clean text for schema (strip HTML, remove citation markers)
    const cleanText = (text: string): string => {
      if (!text) return ''
      let cleaned = this.stripHtml(text)
      // Remove citation markers [1], [2], etc.
      cleaned = cleaned.replace(/\[\d+\]/g, '')
      // Remove em dashes
      cleaned = cleaned.replace(/—/g, ' - ')
      cleaned = cleaned.replace(/–/g, '-')
      // Clean up whitespace
      cleaned = cleaned.replace(/\s+/g, ' ').trim()
      return cleaned
    }

    // Build article body from intro + sections
    let articleBody = cleanText(article.Intro || '')
    for (let i = 1; i <= 9; i++) {
      const content = (article as any)[`section_0${i}_content`]
      if (content) {
        articleBody += ' ' + cleanText(content)
      }
    }

    // Article schema
    const articleSchema: any = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: cleanText(article.Headline || ''),
      datePublished: publicationDate,
      author: {
        '@type': 'Organization',
        name: companyName
      },
      publisher: {
        '@type': 'Organization',
        name: companyName,
        ...(companyUrl && { url: companyUrl })
      },
      articleBody: articleBody.substring(0, 5000) // Limit size
    }

    if (articleUrl) {
      articleSchema.url = articleUrl
    }

    if (article.Subtitle) {
      articleSchema.alternativeHeadline = cleanText(article.Subtitle)
    }

    if (article.Meta_Description) {
      articleSchema.description = cleanText(article.Meta_Description)
    }

    // Add direct answer as acceptedAnswer for AEO
    if (article.Direct_Answer) {
      const directAnswerText = cleanText(article.Direct_Answer)
      if (directAnswerText) {
        articleSchema.acceptedAnswer = {
          '@type': 'Answer',
          text: directAnswerText
        }
      }
    }

    // FAQPage schema
    const faqs = this.collectFaqs(article)
    const faqSchema: any = faqs.length > 0 ? {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: cleanText(faq.question),
        acceptedAnswer: {
          '@type': 'Answer',
          text: cleanText(faq.answer)
        }
      }))
    } : null

    // Combine schemas
    const schemas = [articleSchema]
    if (faqSchema) {
      schemas.push(faqSchema)
    }

    return schemas.map(schema =>
      `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n    </script>`
    ).join('\n    ')
  }

  /**
   * Generate article URL from headline and company URL
   */
  private generateArticleUrl(headline: string, companyUrl: string | null): string | null {
    if (!companyUrl || !headline) return null

    // Create slug from headline
    const cleanHeadline = this.stripHtml(headline)
    let slug = cleanHeadline.toLowerCase()
    slug = slug.replace(/[^\w\s-]/g, '') // Remove special chars
    slug = slug.replace(/[-\s]+/g, '-')   // Replace spaces with hyphens
    slug = slug.replace(/^-+|-+$/g, '')   // Trim hyphens

    const baseUrl = companyUrl.replace(/\/$/, '')
    return `${baseUrl}/blog/${slug}`
  }

  /**
   * Render article sections
   */
  private renderSections(article: any): string {
    const parts: string[] = []

    for (let i = 1; i <= 9; i++) {
      const title = (article as any)[`section_0${i}_title`]
      const content = (article as any)[`section_0${i}_content`]

      if (!content || !content.trim()) continue

      const anchor = `toc_0${i}`

      if (title) {
        const cleanTitle = this.stripHtml(title)
        parts.push(`<h2 id="${anchor}">${this.escape(cleanTitle)}</h2>`)
      }

      if (content && content.trim()) {
        parts.push(content)
      }
    }

    return parts.join('\n')
  }

  /**
   * Render table of contents
   */
  private renderToc(article: any): string {
    const items: string[] = []

    for (let i = 1; i <= 9; i++) {
      const title = (article as any)[`section_0${i}_title`]
      if (title) {
        const anchor = `toc_0${i}`
        const cleanTitle = this.stripHtml(title)
        const shortTitle = this.createShortTocLabel(cleanTitle)
        items.push(`<li><a href="#${anchor}">${this.escape(shortTitle)}</a></li>`)
      }
    }

    if (items.length === 0) return ''

    return `<div class="toc">
            <h2>Table of Contents</h2>
            <ul>
                ${items.join('\n                ')}
            </ul>
        </div>`
  }

  /**
   * Create short TOC label (3-5 words max)
   */
  private createShortTocLabel(title: string, maxWords: number = 5): string {
    // Remove common prefixes
    const prefixes = ['What is ', 'How does ', 'Why does ', 'When should ', 'Where can ']
    let cleaned = title
    for (const prefix of prefixes) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.substring(prefix.length)
        break
      }
    }

    const words = cleaned.split(/\s+/)
    if (words.length <= maxWords) return cleaned

    return words.slice(0, maxWords).join(' ') + '...'
  }

  /**
   * Render citations section
   */
  private renderCitations(context: ExecutionContext): string {
    const citationsHtml = context.parallel_results.citations_html

    if (citationsHtml && typeof citationsHtml === 'string' && citationsHtml.trim()) {
      // If already formatted as HTML section, return as-is
      if (citationsHtml.includes('<section')) {
        return citationsHtml
      }
      // Otherwise wrap it
      return `<section class="citations">
            <h2>Sources</h2>
            ${citationsHtml}
        </section>`
    }

    // Fallback: check grounding URLs
    const groundingUrls = context.grounding_urls || []
    if (groundingUrls.length === 0) return ''

    const citationsList = groundingUrls
      .map((source, i) => {
        const url = typeof source === 'string' ? source : source.url
        const title = typeof source === 'string' ? source : (source.title || source.url)
        return `<li><a href="${this.escape(url)}" class="citation" target="_blank" rel="noopener">${this.escape(title)}</a></li>`
      })
      .join('\n                ')

    return `<section class="citations">
            <h2>Sources</h2>
            <ol>
                ${citationsList}
            </ol>
        </section>`
  }

  /**
   * Render FAQ section
   */
  private renderFaq(article: any): string {
    const faqs = this.collectFaqs(article)
    if (faqs.length === 0) return ''

    const items = faqs.map(faq =>
      `<div class="faq-item">
                <h3>${this.escape(faq.question)}</h3>
                <p>${faq.answer}</p>
            </div>`
    ).join('\n            ')

    return `<section class="faq">
            <h2>Frequently Asked Questions</h2>
            ${items}
        </section>`
  }

  /**
   * Render PAA section
   */
  private renderPaa(article: any): string {
    const paas = this.collectPaas(article)
    if (paas.length === 0) return ''

    const items = paas.map(paa =>
      `<div class="paa-item">
                <h3>${this.escape(paa.question)}</h3>
                <p>${paa.answer}</p>
            </div>`
    ).join('\n            ')

    return `<section class="paa">
            <h2>People Also Ask</h2>
            ${items}
        </section>`
  }

  /**
   * Collect FAQ items
   */
  private collectFaqs(article: any): Array<{ question: string; answer: string }> {
    const faqs: Array<{ question: string; answer: string }> = []

    for (let i = 1; i <= 6; i++) {
      const question = article[`faq_0${i}_question`]
      const answer = article[`faq_0${i}_answer`]

      if (question && answer && answer.trim()) {
        faqs.push({ question, answer })
      }
    }

    return faqs
  }

  /**
   * Collect PAA items
   */
  private collectPaas(article: any): Array<{ question: string; answer: string }> {
    const paas: Array<{ question: string; answer: string }> = []

    for (let i = 1; i <= 4; i++) {
      const question = article[`paa_0${i}_question`]
      const answer = article[`paa_0${i}_answer`]

      if (question && answer && answer.trim()) {
        paas.push({ question, answer })
      }
    }

    return paas
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(text: string): string {
    if (!text) return ''
    // Remove HTML tags
    let cleaned = text.replace(/<[^>]+>/g, '')
    // Decode HTML entities
    cleaned = cleaned
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#x27;/g, "'")
    return cleaned.trim()
  }

  /**
   * Escape HTML special characters
   */
  private escape(text: string): string {
    if (!text) return ''
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
  }
}
