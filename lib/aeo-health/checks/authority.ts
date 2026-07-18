/**
 * Authority & E-E-A-T Signal Checks - 3 trust indicator checks
 *
 * Detects Experience, Expertise, Authoritativeness, and Trustworthiness signals:
 * - About page presence
 * - Contact information
 * - Social proof links
 */

import * as cheerio from 'cheerio'
import type { CheckResult } from './technical'

function findLinkPatterns($: cheerio.CheerioAPI, patterns: string[]): boolean {
  const allLinks = $('a[href]')

  let found = false
  allLinks.each((_, link) => {
    const href = ($(link).attr('href') || '').toLowerCase()
    for (const pattern of patterns) {
      const regex = new RegExp(pattern)
      if (regex.test(href)) {
        found = true
        return false // break each loop
      }
    }
  })

  return found
}

function extractSocialLinks($: cheerio.CheerioAPI, sameAsUrls: string[] = []): Set<string> {
  const socialPatterns: Record<string, string> = {
    'linkedin': 'linkedin\\.com',
    'twitter': '(twitter\\.com|x\\.com)',
    'facebook': 'facebook\\.com',
    'instagram': 'instagram\\.com',
    'youtube': 'youtube\\.com',
    'github': 'github\\.com',
    'tiktok': 'tiktok\\.com',
  }

  const foundSocials = new Set<string>()

  // 1. Check HTML <a> tags
  const allLinks = $('a[href]')
  allLinks.each((_, link) => {
    const href = ($(link).attr('href') || '').toLowerCase()
    for (const [platform, pattern] of Object.entries(socialPatterns)) {
      if (new RegExp(pattern).test(href)) {
        foundSocials.add(platform)
      }
    }
  })

  // 2. Check schema.org sameAs URLs
  for (const url of sameAsUrls) {
    const urlLower = url.toLowerCase()
    for (const [platform, pattern] of Object.entries(socialPatterns)) {
      if (new RegExp(pattern).test(urlLower)) {
        foundSocials.add(platform)
      }
    }
  }

  return foundSocials
}

function hasContactInfo($: cheerio.CheerioAPI) {
  const text = $('body').text()

  // Email pattern
  const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text)

  // Phone patterns
  const phonePatterns = [
    /(?:tel|phone|call|fax|mobile)[\s:]+[\+\d\s\-\(\)\.]{10,}/i,
    /\+\d{1,3}[\s\-]?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}/,
    /(?:1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  ]
  const hasPhone = phonePatterns.some(p => p.test(text))

  // Address indicators
  const addressPatterns = [
    /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|way|drive|dr)\b/i,
    /(?:floor|suite|ste|unit)\s*#?\s*\d+/i,
    /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/,
    /\b\d{5}\s+[A-Za-z]+\b/,
  ]
  const hasAddress = addressPatterns.some(p => p.test(text))

  return {
    has_email: hasEmail,
    has_phone: hasPhone,
    has_address: hasAddress,
  }
}

export function runAuthorityChecks($: cheerio.CheerioAPI, sameAsUrls: string[] = []): CheckResult[] {
  const issues: CheckResult[] = []

  // === 1. ABOUT PAGE ===
  const aboutPatterns = [
    '/about($|/|-us|_us)',
    '/company($|/)',
    '/who-we-are',
    '/our-story',
    '/ueber-uns',
    '/wir-sind',
  ]
  const hasAbout = findLinkPatterns($, aboutPatterns)

  if (!hasAbout) {
    issues.push({
      check: 'about_page',
      category: 'authority',
      passed: false,
      severity: 'notice',
      message: 'No About page link found',
      recommendation: 'Add a visible link to your About/Company page for trust signals',
      score_impact: 5
    })
  } else {
    issues.push({
      check: 'about_page',
      category: 'authority',
      passed: true,
      severity: 'pass',
      message: 'About page link found',
      recommendation: '',
      score_impact: 5
    })
  }

  // === 2. CONTACT INFORMATION ===
  const contactInfo = hasContactInfo($)
  const hasAnyContact = contactInfo.has_email || contactInfo.has_phone || contactInfo.has_address

  const contactPatterns = ['/contact($|/|-us)', '/kontakt', '/get-in-touch']
  const hasContactPage = findLinkPatterns($, contactPatterns)

  if (!hasAnyContact && !hasContactPage) {
    issues.push({
      check: 'contact_info',
      category: 'authority',
      passed: false,
      severity: 'warning',
      message: 'No contact information found',
      recommendation: 'Add visible email, phone, or address for trust and local SEO',
      score_impact: 5
    })
  } else {
    const contactTypes: string[] = []
    if (contactInfo.has_email) contactTypes.push('email')
    if (contactInfo.has_phone) contactTypes.push('phone')
    if (contactInfo.has_address) contactTypes.push('address')
    if (hasContactPage) contactTypes.push('contact page')

    issues.push({
      check: 'contact_info',
      category: 'authority',
      passed: true,
      severity: 'pass',
      message: `Contact info found: ${contactTypes.join(', ')}`,
      recommendation: '',
      score_impact: 5
    })
  }

  // === 3. SOCIAL PROOF LINKS ===
  const socialLinks = extractSocialLinks($, sameAsUrls)
  const keySocials = new Set(['linkedin', 'twitter'])
  const hasKeySocials = [...socialLinks].some(s => keySocials.has(s))

  if (socialLinks.size === 0) {
    issues.push({
      check: 'social_proof_links',
      category: 'authority',
      passed: false,
      severity: 'warning',
      message: 'No social media links found',
      recommendation: 'Add links to LinkedIn, Twitter/X for social proof and entity recognition',
      score_impact: 4
    })
  } else if (!hasKeySocials) {
    issues.push({
      check: 'social_proof_links',
      category: 'authority',
      passed: false,
      severity: 'notice',
      message: `Found social links (${[...socialLinks].join(', ')}) but missing LinkedIn/Twitter`,
      recommendation: 'Add LinkedIn and Twitter for stronger business authority signals',
      score_impact: 4
    })
  } else {
    issues.push({
      check: 'social_proof_links',
      category: 'authority',
      passed: true,
      severity: 'pass',
      message: `Social proof links found: ${[...socialLinks].sort().join(', ')}`,
      recommendation: '',
      score_impact: 4
    })
  }

  return issues
}

export function extractAuthoritySummary($: cheerio.CheerioAPI, sameAsUrls: string[] = []) {
  const aboutPatterns = ['/about($|/|-us)', '/company($|/)']
  const contactPatterns = ['/contact($|/)', '/kontakt']

  const contactInfo = hasContactInfo($)
  const socialLinks = extractSocialLinks($, sameAsUrls)

  return {
    has_about_page: findLinkPatterns($, aboutPatterns),
    has_contact_page: findLinkPatterns($, contactPatterns),
    has_contact_info: contactInfo.has_email || contactInfo.has_phone,
    social_links: [...socialLinks],
  }
}
