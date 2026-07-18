/**
 * Structured Data Depth Analysis - 6 AEO-focused checks
 *
 * Analyzes Schema.org structured data for:
 * - Organization schema completeness
 * - FAQ/HowTo content schemas
 * - Knowledge graph signals (sameAs links)
 * - Content freshness (datePublished, dateModified)
 * - JSON-LD validation (required fields per schema type)
 */

import * as cheerio from 'cheerio'
import type { CheckResult } from './technical'

interface SchemaData {
  schemaTypes: string[]
  allSchemas: any[]
  orgSchema: any | null
}

// Required fields for common schema types (Google's Rich Results requirements)
const SCHEMA_REQUIRED_FIELDS: Record<string, string[]> = {
  'Organization': ['name', 'url'],
  'LocalBusiness': ['name', 'address'],
  'Article': ['headline', 'author', 'datePublished'],
  'BlogPosting': ['headline', 'author', 'datePublished'],
  'NewsArticle': ['headline', 'author', 'datePublished'],
  'Product': ['name'],
  'FAQPage': ['mainEntity'],
  'HowTo': ['name', 'step'],
  'Recipe': ['name', 'recipeIngredient', 'recipeInstructions'],
  'Event': ['name', 'startDate', 'location'],
  'Person': ['name'],
  'WebPage': ['name'],
  'WebSite': ['name', 'url'],
}

export function extractSchemaData($: cheerio.CheerioAPI): SchemaData {
  const schemaScripts = $('script[type="application/ld+json"]')
  const schemaTypes: string[] = []
  const allSchemas: any[] = []
  let orgSchema: any | null = null

  schemaScripts.each((_, script) => {
    try {
      const scriptContent = $(script).html() || '{}'
      const data = JSON.parse(scriptContent)

      // Handle @graph structure
      let items: any[]
      if (data['@graph']) {
        items = data['@graph']
      } else if (Array.isArray(data)) {
        items = data
      } else {
        items = [data]
      }

      for (const item of items) {
        if (typeof item === 'object' && item !== null) {
          allSchemas.push(item)
          const schemaType = item['@type']

          if (schemaType) {
            if (Array.isArray(schemaType)) {
              schemaTypes.push(...schemaType)
            } else {
              schemaTypes.push(schemaType)
            }
          }

          // Capture Organization/LocalBusiness schema
          if (['Organization', 'LocalBusiness', 'Corporation', 'Company'].includes(schemaType)) {
            if (orgSchema === null) {
              orgSchema = item
            }
          }
        }
      }
    } catch (error) {
      // Invalid JSON, skip
      return
    }
  })

  // Deduplicate schema types
  const uniqueSchemaTypes = [...new Set(schemaTypes)]

  return {
    schemaTypes: uniqueSchemaTypes,
    allSchemas,
    orgSchema
  }
}

export function calculateOrgSchemaCompleteness(orgSchema: any | null): number {
  if (!orgSchema) return 0.0

  // Required fields (40%)
  let requiredScore = 0.0
  if (orgSchema.name) requiredScore += 0.2
  if (orgSchema.url) requiredScore += 0.2

  // Important fields (40%)
  let importantScore = 0.0
  if (orgSchema.logo) importantScore += 0.15
  if (orgSchema.description) importantScore += 0.15
  if (orgSchema.sameAs && orgSchema.sameAs.length > 0) importantScore += 0.1

  // Good to have (20%)
  let optionalScore = 0.0
  if (orgSchema.address) optionalScore += 0.1
  if (orgSchema.contactPoint) optionalScore += 0.05
  if (orgSchema.foundingDate) optionalScore += 0.025
  if (orgSchema.founder || orgSchema.founders) optionalScore += 0.025

  return Math.min(1.0, requiredScore + importantScore + optionalScore)
}

export function countSameAsLinks(orgSchema: any | null): number {
  if (!orgSchema) return 0

  const sameAs = orgSchema.sameAs
  if (typeof sameAs === 'string') return 1
  if (Array.isArray(sameAs)) return sameAs.length
  return 0
}

export function checkContentFreshness($: cheerio.CheerioAPI, allSchemas: any[]) {
  let hasDatePublished = false
  let hasDateModified = false
  const datesFound: string[] = []

  // Check schema.org for dates
  for (const schema of allSchemas) {
    const schemaType = schema['@type'] || ''

    if (['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'HowTo', 'WebPage'].includes(schemaType)) {
      if (schema.datePublished) {
        hasDatePublished = true
        datesFound.push('schema:datePublished')
      }
      if (schema.dateModified) {
        hasDateModified = true
        datesFound.push('schema:dateModified')
      }
    }
  }

  // Check HTML <time> elements
  const timeElements = $('time[datetime]')
  if (timeElements.length > 0 && !hasDatePublished) {
    hasDatePublished = true
    datesFound.push('html:time')
  }

  // Check meta tags
  const articlePublished = $('meta[property="article:published_time"]')
  const articleModified = $('meta[property="article:modified_time"]')

  if (articlePublished.length > 0) {
    hasDatePublished = true
    datesFound.push('meta:article:published_time')
  }
  if (articleModified.length > 0) {
    hasDateModified = true
    datesFound.push('meta:article:modified_time')
  }

  return {
    has_date_published: hasDatePublished,
    has_date_modified: hasDateModified,
    dates_found: datesFound
  }
}

export function validateSchema(schema: any): string[] {
  const schemaType = Array.isArray(schema['@type'])
    ? schema['@type'][0]
    : schema['@type'] || ''

  const required = SCHEMA_REQUIRED_FIELDS[schemaType] || []
  const missing: string[] = []

  for (const field of required) {
    if (!schema[field]) {
      missing.push(field)
    }
  }

  return missing
}

export function validateAllSchemas(allSchemas: any[]) {
  const validationErrors: Array<{ type: string; missing_fields: string[] }> = []

  for (const schema of allSchemas) {
    const schemaType = Array.isArray(schema['@type'])
      ? schema['@type'][0]
      : schema['@type'] || 'Unknown'

    // Only validate schemas we have requirements for
    if (schemaType in SCHEMA_REQUIRED_FIELDS) {
      const missing = validateSchema(schema)
      if (missing.length > 0) {
        validationErrors.push({
          type: schemaType,
          missing_fields: missing
        })
      }
    }
  }

  const schemasChecked = allSchemas.filter(
    s => (Array.isArray(s['@type']) ? s['@type'][0] : s['@type']) in SCHEMA_REQUIRED_FIELDS
  ).length

  return {
    validation_errors: validationErrors,
    has_errors: validationErrors.length > 0,
    schemas_checked: schemasChecked
  }
}

export function runStructuredDataChecks($: cheerio.CheerioAPI): CheckResult[] {
  const issues: CheckResult[] = []
  const { schemaTypes, allSchemas, orgSchema } = extractSchemaData($)

  // === 1. ORGANIZATION SCHEMA COMPLETENESS ===
  const completeness = calculateOrgSchemaCompleteness(orgSchema)

  if (orgSchema === null) {
    issues.push({
      check: 'org_schema_completeness',
      category: 'structured_data',
      passed: false,
      severity: 'warning',
      message: 'No Organization schema found',
      recommendation: 'Add Organization schema with name, url, logo, description, and sameAs links',
      score_impact: 10
    })
  } else if (completeness < 0.5) {
    issues.push({
      check: 'org_schema_completeness',
      category: 'structured_data',
      passed: false,
      severity: 'warning',
      message: `Organization schema incomplete (${Math.round(completeness * 100)}%)`,
      recommendation: 'Add missing fields: logo, description, sameAs links to Wikipedia/LinkedIn',
      score_impact: 10
    })
  } else {
    issues.push({
      check: 'org_schema_completeness',
      category: 'structured_data',
      passed: true,
      severity: 'pass',
      message: `Organization schema complete (${Math.round(completeness * 100)}%)`,
      recommendation: '',
      score_impact: 10
    })
  }

  // === 2. FAQ SCHEMA ===
  const hasFaq = schemaTypes.some(t => ['FAQPage', 'Question'].includes(t))

  if (!hasFaq) {
    issues.push({
      check: 'faq_schema',
      category: 'structured_data',
      passed: false,
      severity: 'notice',
      message: 'No FAQ schema found',
      recommendation: 'Add FAQPage schema to help AI extract Q&A content',
      score_impact: 5
    })
  } else {
    issues.push({
      check: 'faq_schema',
      category: 'structured_data',
      passed: true,
      severity: 'pass',
      message: 'FAQ schema present',
      recommendation: '',
      score_impact: 5
    })
  }

  // === 3. HOWTO/ARTICLE SCHEMA ===
  const contentSchemas = ['HowTo', 'Article', 'BlogPosting', 'NewsArticle', 'TechArticle']
  const hasContentSchema = schemaTypes.some(t => contentSchemas.includes(t))

  if (!hasContentSchema) {
    issues.push({
      check: 'content_schema',
      category: 'structured_data',
      passed: false,
      severity: 'notice',
      message: 'No content schema (HowTo/Article) found',
      recommendation: 'Add Article or HowTo schema for content-rich pages',
      score_impact: 5
    })
  } else {
    const foundTypes = schemaTypes.filter(t => contentSchemas.includes(t))
    issues.push({
      check: 'content_schema',
      category: 'structured_data',
      passed: true,
      severity: 'pass',
      message: `Content schema present: ${foundTypes.join(', ')}`,
      recommendation: '',
      score_impact: 5
    })
  }

  // === 4. SAMEAS LINKS ===
  const sameAsCount = countSameAsLinks(orgSchema)

  if (sameAsCount === 0) {
    issues.push({
      check: 'sameas_links',
      category: 'structured_data',
      passed: false,
      severity: 'warning',
      message: 'No sameAs links in Organization schema',
      recommendation: 'Add sameAs links to LinkedIn, Wikipedia, Twitter, Crunchbase for knowledge graph',
      score_impact: 5
    })
  } else if (sameAsCount < 3) {
    issues.push({
      check: 'sameas_links',
      category: 'structured_data',
      passed: false,
      severity: 'notice',
      message: `Only ${sameAsCount} sameAs link(s)`,
      recommendation: 'Add more sameAs links (aim for 3-5) to strengthen entity recognition',
      score_impact: 5
    })
  } else {
    issues.push({
      check: 'sameas_links',
      category: 'structured_data',
      passed: true,
      severity: 'pass',
      message: `${sameAsCount} sameAs links found`,
      recommendation: '',
      score_impact: 5
    })
  }

  // === 5. CONTENT FRESHNESS ===
  const freshness = checkContentFreshness($, allSchemas)

  if (!freshness.has_date_published && !freshness.has_date_modified) {
    issues.push({
      check: 'content_freshness',
      category: 'structured_data',
      passed: false,
      severity: 'notice',
      message: 'No content dates found (datePublished/dateModified)',
      recommendation: 'Add datePublished and dateModified to Article schema or use <time> elements',
      score_impact: 5
    })
  } else if (!freshness.has_date_modified) {
    issues.push({
      check: 'content_freshness',
      category: 'structured_data',
      passed: false,
      severity: 'notice',
      message: `Has datePublished but no dateModified (${freshness.dates_found.join(', ')})`,
      recommendation: 'Add dateModified to show content is maintained and up-to-date',
      score_impact: 5
    })
  } else {
    issues.push({
      check: 'content_freshness',
      category: 'structured_data',
      passed: true,
      severity: 'pass',
      message: `Content dates present (${freshness.dates_found.join(', ')})`,
      recommendation: '',
      score_impact: 5
    })
  }

  // === 6. JSON-LD VALIDATION ===
  const validation = validateAllSchemas(allSchemas)

  if (validation.schemas_checked === 0) {
    issues.push({
      check: 'jsonld_validation',
      category: 'structured_data',
      passed: true,
      severity: 'pass',
      message: 'No validatable schemas found',
      recommendation: '',
      score_impact: 5
    })
  } else if (validation.has_errors) {
    const errorMsgs = validation.validation_errors.slice(0, 3).map(
      err => `${err.type} missing: ${err.missing_fields.join(', ')}`
    )

    issues.push({
      check: 'jsonld_validation',
      category: 'structured_data',
      passed: false,
      severity: 'warning',
      message: `Schema validation errors (${validation.validation_errors.length}): ${errorMsgs.join('; ')}`,
      recommendation: 'Add missing required fields to fix Rich Results eligibility',
      score_impact: 5
    })
  } else {
    issues.push({
      check: 'jsonld_validation',
      category: 'structured_data',
      passed: true,
      severity: 'pass',
      message: `All ${validation.schemas_checked} schemas have required fields`,
      recommendation: '',
      score_impact: 5
    })
  }

  return issues
}

export function extractStructuredDataSummary($: cheerio.CheerioAPI) {
  const { schemaTypes, allSchemas, orgSchema } = extractSchemaData($)
  const completeness = calculateOrgSchemaCompleteness(orgSchema)
  const sameAsCount = countSameAsLinks(orgSchema)

  // Extract sameAs URLs
  let sameAsUrls: string[] = []
  if (orgSchema && orgSchema.sameAs) {
    const sameAs = orgSchema.sameAs
    if (typeof sameAs === 'string') {
      sameAsUrls = [sameAs]
    } else if (Array.isArray(sameAs)) {
      sameAsUrls = sameAs
    }
  }

  return {
    schema_types: schemaTypes,
    schema_count: allSchemas.length,
    schema_completeness: Math.round(completeness * 100) / 100,
    has_organization: orgSchema !== null,
    has_faq: schemaTypes.some(t => ['FAQPage', 'Question'].includes(t)),
    has_howto: schemaTypes.includes('HowTo'),
    has_article: schemaTypes.some(t => ['Article', 'BlogPosting', 'NewsArticle'].includes(t)),
    same_as_count: sameAsCount,
    same_as_urls: sameAsUrls.slice(0, 5)
  }
}
