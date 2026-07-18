/**
 * Technical SEO Checks - 16 core checks for SEO/AEO health
 *
 * These are the foundational SEO hygiene checks that form the base of the health score.
 * Includes sitemap detection, response time scoring, meta robots indexing detection,
 * and hreflang tags for international SEO.
 */

import * as cheerio from 'cheerio'

export interface CheckResult {
  check: string
  category: string
  passed: boolean
  severity: 'pass' | 'notice' | 'warning' | 'error'
  message: string
  recommendation: string
  score_impact: number
}

export interface TechnicalCheckOptions {
  $: cheerio.CheerioAPI
  finalUrl: string
  sitemapFound?: boolean
  responseTimeMs?: number
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '').toLowerCase().replace('http://', 'https://')
}

function isInternalLink(href: string, domain: string): boolean {
  if (!href) return false

  // Skip non-navigational links
  if (href.startsWith('javascript:') || href.startsWith('mailto:') ||
      href.startsWith('tel:') || href.startsWith('data:')) {
    return false
  }

  // Anchor links are internal
  if (href.startsWith('#')) return true

  // Relative paths are internal
  if (href.startsWith('/') && !href.startsWith('//')) return true

  // Check if absolute URL matches domain
  try {
    const url = new URL(href, `https://${domain}`)
    return domain.includes(url.hostname) || url.hostname.includes(domain)
  } catch {
    return true // Likely relative
  }
}

export function runTechnicalChecks(options: TechnicalCheckOptions): CheckResult[] {
  const { $, finalUrl, sitemapFound = false, responseTimeMs = 0 } = options
  const issues: CheckResult[] = []

  // === 1. TITLE TAG ===
  const titleText = $('title').text().trim()
  const titleLength = titleText.length

  if (!titleText) {
    issues.push({
      check: 'title_tag',
      category: 'technical',
      passed: false,
      severity: 'error',
      message: 'Missing title tag',
      recommendation: 'Add a descriptive title tag (30-65 characters)',
      score_impact: 10
    })
  } else if (titleLength < 30) {
    issues.push({
      check: 'title_tag',
      category: 'technical',
      passed: false,
      severity: 'warning',
      message: `Title too short (${titleLength} chars)`,
      recommendation: 'Expand title to 30-65 characters for better visibility',
      score_impact: 10
    })
  } else if (titleLength > 65) {
    issues.push({
      check: 'title_tag',
      category: 'technical',
      passed: false,
      severity: 'warning',
      message: `Title too long (${titleLength} chars)`,
      recommendation: 'Shorten title to 30-65 characters to avoid truncation',
      score_impact: 10
    })
  } else {
    issues.push({
      check: 'title_tag',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: `Good title length (${titleLength} chars)`,
      recommendation: '',
      score_impact: 10
    })
  }

  // === 2. META DESCRIPTION ===
  const metaText = $('meta[name="description"]').attr('content')?.trim() || ''
  const metaLength = metaText.length

  if (!metaText) {
    issues.push({
      check: 'meta_description',
      category: 'technical',
      passed: false,
      severity: 'error',
      message: 'Missing meta description',
      recommendation: 'Add a meta description (120-160 characters)',
      score_impact: 10
    })
  } else if (metaLength < 120) {
    issues.push({
      check: 'meta_description',
      category: 'technical',
      passed: false,
      severity: 'warning',
      message: `Meta description too short (${metaLength} chars)`,
      recommendation: 'Expand to 120-160 characters for better SERP display',
      score_impact: 10
    })
  } else if (metaLength > 160) {
    issues.push({
      check: 'meta_description',
      category: 'technical',
      passed: false,
      severity: 'warning',
      message: `Meta description too long (${metaLength} chars)`,
      recommendation: 'Shorten to 120-160 characters to avoid truncation',
      score_impact: 10
    })
  } else {
    issues.push({
      check: 'meta_description',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: `Good meta description (${metaLength} chars)`,
      recommendation: '',
      score_impact: 10
    })
  }

  // === 3. H1 TAG ===
  const h1Tags = $('h1')
  const h1Count = h1Tags.length

  if (h1Count === 0) {
    issues.push({
      check: 'h1_tag',
      category: 'technical',
      passed: false,
      severity: 'error',
      message: 'No H1 tag found',
      recommendation: 'Add exactly one H1 tag to clearly define page topic',
      score_impact: 10
    })
  } else if (h1Count > 1) {
    issues.push({
      check: 'h1_tag',
      category: 'technical',
      passed: false,
      severity: 'warning',
      message: `Multiple H1 tags (${h1Count})`,
      recommendation: 'Use only one H1 tag per page for clarity',
      score_impact: 10
    })
  } else {
    const h1Text = h1Tags.first().text().trim().slice(0, 50)
    issues.push({
      check: 'h1_tag',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: `Single H1 tag: "${h1Text}..."`,
      recommendation: '',
      score_impact: 10
    })
  }

  // === 4. HEADING STRUCTURE ===
  const h2Count = $('h2').length
  const h3Count = $('h3').length
  const h4Count = $('h4').length

  if (h2Count === 0) {
    issues.push({
      check: 'heading_structure',
      category: 'technical',
      passed: false,
      severity: 'warning',
      message: 'No H2 tags found',
      recommendation: 'Add H2 tags to structure your content',
      score_impact: 5
    })
  } else {
    issues.push({
      check: 'heading_structure',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: `Good structure: ${h1Count} H1, ${h2Count} H2, ${h3Count} H3, ${h4Count} H4`,
      recommendation: '',
      score_impact: 5
    })
  }

  // === 5. IMAGE ALT TEXT ===
  const images = $('img')
  const totalImages = images.length
  const imagesWithAltAttr = images.filter((_, img) => $(img).attr('alt') !== undefined).length
  const imagesWithDescriptiveAlt = images.filter((_, img) => {
    const alt = $(img).attr('alt')
    return alt && alt.trim().length > 0
  }).length
  const imagesWithoutAlt = totalImages - imagesWithAltAttr

  if (totalImages === 0) {
    issues.push({
      check: 'image_alt_text',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: 'No images on page',
      recommendation: '',
      score_impact: 10
    })
  } else if (imagesWithoutAlt > 0) {
    const altPercentage = Math.round((imagesWithAltAttr / totalImages) * 100)
    issues.push({
      check: 'image_alt_text',
      category: 'technical',
      passed: false,
      severity: 'error',
      message: `${imagesWithoutAlt}/${totalImages} images missing alt attribute (${altPercentage}% have alt)`,
      recommendation: `Add alt attribute to all ${imagesWithoutAlt} images`,
      score_impact: 10
    })
  } else if (imagesWithDescriptiveAlt === 0) {
    issues.push({
      check: 'image_alt_text',
      category: 'technical',
      passed: false,
      severity: 'warning',
      message: `All ${totalImages} images have empty alt="" (no descriptive text)`,
      recommendation: 'Add descriptive alt text to content images (empty alt is only valid for decorative images)',
      score_impact: 10
    })
  } else if (imagesWithDescriptiveAlt < totalImages * 0.5) {
    const descPercentage = Math.round((imagesWithDescriptiveAlt / totalImages) * 100)
    issues.push({
      check: 'image_alt_text',
      category: 'technical',
      passed: false,
      severity: 'notice',
      message: `Only ${imagesWithDescriptiveAlt}/${totalImages} images have descriptive alt text (${descPercentage}%)`,
      recommendation: 'Add descriptive alt text to more images for better accessibility and SEO',
      score_impact: 10
    })
  } else {
    const descPercentage = Math.round((imagesWithDescriptiveAlt / totalImages) * 100)
    issues.push({
      check: 'image_alt_text',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: `${imagesWithDescriptiveAlt}/${totalImages} images have descriptive alt text (${descPercentage}%)`,
      recommendation: '',
      score_impact: 10
    })
  }

  // === 6. MOBILE VIEWPORT ===
  const viewport = $('meta[name="viewport"]')

  if (viewport.length === 0) {
    issues.push({
      check: 'mobile_viewport',
      category: 'technical',
      passed: false,
      severity: 'error',
      message: 'No viewport meta tag',
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
      score_impact: 10
    })
  } else {
    const viewportContent = viewport.attr('content') || ''
    if (viewportContent.includes('width=device-width')) {
      issues.push({
        check: 'mobile_viewport',
        category: 'technical',
        passed: true,
        severity: 'pass',
        message: 'Viewport configured correctly',
        recommendation: '',
        score_impact: 10
      })
    } else {
      issues.push({
        check: 'mobile_viewport',
        category: 'technical',
        passed: false,
        severity: 'warning',
        message: 'Viewport tag present but not optimal',
        recommendation: 'Update viewport to include width=device-width',
        score_impact: 10
      })
    }
  }

  // === 7. STRUCTURED DATA PRESENCE ===
  const schemaScripts = $('script[type="application/ld+json"]')
  const schemaCount = schemaScripts.length

  if (schemaCount === 0) {
    issues.push({
      check: 'structured_data_presence',
      category: 'technical',
      passed: false,
      severity: 'warning',
      message: 'No structured data (schema.org) found',
      recommendation: 'Add JSON-LD structured data to help AI understand your content',
      score_impact: 10
    })
  } else {
    issues.push({
      check: 'structured_data_presence',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: `${schemaCount} structured data blocks found`,
      recommendation: '',
      score_impact: 10
    })
  }

  // === 8. HTTPS ===
  const isHttps = finalUrl.startsWith('https://')

  if (!isHttps) {
    issues.push({
      check: 'https',
      category: 'technical',
      passed: false,
      severity: 'error',
      message: 'Site not using HTTPS',
      recommendation: 'Enable HTTPS for security and SEO benefits',
      score_impact: 10
    })
  } else {
    issues.push({
      check: 'https',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: 'Site using HTTPS',
      recommendation: '',
      score_impact: 10
    })
  }

  // === 9. CANONICAL TAG ===
  const canonical = $('link[rel="canonical"]')

  if (canonical.length === 0) {
    issues.push({
      check: 'canonical_tag',
      category: 'technical',
      passed: false,
      severity: 'notice',
      message: 'No canonical tag',
      recommendation: 'Add canonical tag to prevent duplicate content issues',
      score_impact: 5
    })
  } else {
    const canonicalHref = (canonical.attr('href') || '').trim()
    const canonicalNormalized = normalizeUrl(canonicalHref)
    const finalUrlNormalized = normalizeUrl(finalUrl)

    if (!canonicalHref) {
      issues.push({
        check: 'canonical_tag',
        category: 'technical',
        passed: false,
        severity: 'warning',
        message: 'Canonical tag has empty href',
        recommendation: 'Set canonical href to the preferred URL for this page',
        score_impact: 5
      })
    } else if (canonicalNormalized === finalUrlNormalized) {
      issues.push({
        check: 'canonical_tag',
        category: 'technical',
        passed: true,
        severity: 'pass',
        message: 'Canonical tag is self-referencing (correct)',
        recommendation: '',
        score_impact: 5
      })
    } else {
      const canonicalShort = canonicalHref.slice(0, 60) + (canonicalHref.length > 60 ? '...' : '')
      issues.push({
        check: 'canonical_tag',
        category: 'technical',
        passed: false,
        severity: 'notice',
        message: `Canonical points to different URL: ${canonicalShort}`,
        recommendation: 'Verify canonical URL is correct - this page may be considered duplicate content',
        score_impact: 5
      })
    }
  }

  // === 10. ROBOTS META ===
  const robotsMeta = $('meta[name="robots"]')
  const googlebotMeta = $('meta[name="googlebot"]')

  let noindexFound = false
  let nofollowFound = false

  const checkMeta = (meta: cheerio.Cheerio<any>) => {
    if (meta.length > 0) {
      const content = (meta.attr('content') || '').toLowerCase()
      if (content.includes('noindex')) noindexFound = true
      if (content.includes('nofollow')) nofollowFound = true
    }
  }

  checkMeta(robotsMeta)
  checkMeta(googlebotMeta)

  if (noindexFound) {
    issues.push({
      check: 'robots_meta',
      category: 'technical',
      passed: false,
      severity: 'error',
      message: 'Page has noindex directive - blocked from search engines',
      recommendation: 'Remove noindex directive if this page should be indexed by search engines and AI',
      score_impact: 15
    })
  } else if (nofollowFound) {
    issues.push({
      check: 'robots_meta',
      category: 'technical',
      passed: false,
      severity: 'warning',
      message: 'Page has nofollow directive - links not followed by crawlers',
      recommendation: 'Consider removing nofollow if you want crawlers to follow links on this page',
      score_impact: 5
    })
  } else {
    issues.push({
      check: 'robots_meta',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: 'No indexing restrictions found',
      recommendation: '',
      score_impact: 15
    })
  }

  // === 11. CONTENT QUALITY (Word Count) ===
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  const wordCount = bodyText.split(' ').filter(word => word.length > 0).length

  if (wordCount < 300) {
    issues.push({
      check: 'content_word_count',
      category: 'technical',
      passed: false,
      severity: 'warning',
      message: `Low word count (${wordCount} words)`,
      recommendation: 'Add more comprehensive content (aim for 500+ words)',
      score_impact: 10
    })
  } else if (wordCount < 500) {
    issues.push({
      check: 'content_word_count',
      category: 'technical',
      passed: false,
      severity: 'notice',
      message: `Moderate word count (${wordCount} words)`,
      recommendation: 'Consider expanding to 500+ words for better ranking',
      score_impact: 10
    })
  } else {
    issues.push({
      check: 'content_word_count',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: `Good content length (${wordCount} words)`,
      recommendation: '',
      score_impact: 10
    })
  }

  // === 12. INTERNAL LINKING ===
  const allLinks = $('a[href]')
  const domain = new URL(finalUrl).hostname

  let internalCount = 0
  allLinks.each((_, link) => {
    const href = $(link).attr('href') || ''
    if (isInternalLink(href, domain)) {
      internalCount++
    }
  })

  const externalCount = allLinks.length - internalCount

  if (internalCount < 3) {
    issues.push({
      check: 'internal_linking',
      category: 'technical',
      passed: false,
      severity: 'notice',
      message: `Only ${internalCount} internal links`,
      recommendation: 'Add more internal links (5-10) to improve site structure',
      score_impact: 5
    })
  } else {
    issues.push({
      check: 'internal_linking',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: `${internalCount} internal links, ${externalCount} external`,
      recommendation: '',
      score_impact: 5
    })
  }

  // === 13. LANGUAGE TAG ===
  const htmlTag = $('html')
  const langAttr = htmlTag.attr('lang')

  if (!langAttr) {
    issues.push({
      check: 'language_tag',
      category: 'technical',
      passed: false,
      severity: 'notice',
      message: 'No lang attribute on <html> tag',
      recommendation: "Add lang='en' (or appropriate language) to <html> tag",
      score_impact: 5
    })
  } else {
    issues.push({
      check: 'language_tag',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: `Language set to: ${langAttr}`,
      recommendation: '',
      score_impact: 5
    })
  }

  // === 14. SITEMAP.XML ===
  if (sitemapFound) {
    issues.push({
      check: 'sitemap_xml',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: 'Sitemap.xml found',
      recommendation: '',
      score_impact: 5
    })
  } else {
    issues.push({
      check: 'sitemap_xml',
      category: 'technical',
      passed: false,
      severity: 'warning',
      message: 'No sitemap.xml found',
      recommendation: 'Add sitemap.xml to help search engines and AI crawlers discover content',
      score_impact: 5
    })
  }

  // === 15. RESPONSE TIME ===
  if (responseTimeMs > 0) {
    if (responseTimeMs < 500) {
      issues.push({
        check: 'response_time',
        category: 'technical',
        passed: true,
        severity: 'pass',
        message: `Fast response time (${responseTimeMs}ms)`,
        recommendation: '',
        score_impact: 5
      })
    } else if (responseTimeMs < 1000) {
      issues.push({
        check: 'response_time',
        category: 'technical',
        passed: false,
        severity: 'notice',
        message: `Moderate response time (${responseTimeMs}ms)`,
        recommendation: 'Consider optimizing for sub-500ms response time',
        score_impact: 5
      })
    } else if (responseTimeMs < 2000) {
      issues.push({
        check: 'response_time',
        category: 'technical',
        passed: false,
        severity: 'warning',
        message: `Slow response time (${responseTimeMs}ms)`,
        recommendation: 'Optimize server response time to under 1 second',
        score_impact: 5
      })
    } else {
      issues.push({
        check: 'response_time',
        category: 'technical',
        passed: false,
        severity: 'error',
        message: `Very slow response time (${responseTimeMs}ms)`,
        recommendation: 'Critical: response time over 2 seconds significantly impacts SEO and user experience',
        score_impact: 5
      })
    }
  }

  // === 16. HREFLANG TAGS ===
  const hreflangTags = $('link[rel="alternate"][hreflang]')

  if (hreflangTags.length > 0) {
    const langs: string[] = []
    hreflangTags.each((_, tag) => {
      const lang = $(tag).attr('hreflang')
      if (lang) langs.push(lang)
    })
    const hasXDefault = langs.includes('x-default')

    const displayLangs = langs.slice(0, 5)
    const moreText = langs.length > 5 ? ` (+${langs.length - 5} more)` : ''

    if (hasXDefault) {
      issues.push({
        check: 'hreflang_tags',
        category: 'technical',
        passed: true,
        severity: 'pass',
        message: `Hreflang configured for ${langs.length} versions including x-default: ${displayLangs.join(', ')}${moreText}`,
        recommendation: '',
        score_impact: 5
      })
    } else {
      issues.push({
        check: 'hreflang_tags',
        category: 'technical',
        passed: false,
        severity: 'notice',
        message: `Hreflang present (${langs.length} versions) but missing x-default: ${displayLangs.join(', ')}${moreText}`,
        recommendation: 'Add x-default hreflang to specify the default/fallback page',
        score_impact: 5
      })
    }
  } else {
    issues.push({
      check: 'hreflang_tags',
      category: 'technical',
      passed: true,
      severity: 'pass',
      message: 'No hreflang tags (single-language site)',
      recommendation: '',
      score_impact: 5
    })
  }

  return issues
}

export function extractTechnicalSummary($: cheerio.CheerioAPI, finalUrl: string) {
  const titleText = $('title').text().trim()
  const metaText = $('meta[name="description"]').attr('content')?.trim() || ''

  const images = $('img')
  const totalImages = images.length
  const imagesWithAlt = images.filter((_, img) => $(img).attr('alt') !== undefined).length
  const imagesWithDescriptiveAlt = images.filter((_, img) => {
    const alt = $(img).attr('alt')
    return alt && alt.trim().length > 0
  }).length

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  const wordCount = bodyText.split(' ').filter(word => word.length > 0).length

  return {
    title: titleText.slice(0, 100) || 'Missing',
    title_length: titleText.length,
    meta_description: metaText.slice(0, 160) || 'Missing',
    meta_length: metaText.length,
    word_count: wordCount,
    h1_count: $('h1').length,
    images_total: totalImages,
    images_with_alt: imagesWithAlt,
    images_with_descriptive_alt: imagesWithDescriptiveAlt,
    https: finalUrl.startsWith('https://'),
  }
}
