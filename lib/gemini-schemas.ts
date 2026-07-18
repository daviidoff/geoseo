/**
 * ABOUTME: Response schemas for Gemini structured JSON output
 * ABOUTME: Used with SharedGeminiClient for enforcing output format
 *
 * These schemas ensure Gemini outputs properly structured JSON
 * instead of freeform text, preventing hallucinations and parsing errors.
 */

/**
 * Schema builder utilities for Gemini's response_schema parameter
 */
export const SchemaType = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  ARRAY: 'ARRAY',
  OBJECT: 'OBJECT',
} as const

type SchemaTypeValue = (typeof SchemaType)[keyof typeof SchemaType]

interface SchemaProperty {
  type: SchemaTypeValue
  description?: string
  items?: SchemaProperty
  properties?: Record<string, SchemaProperty>
  required?: string[]
  enum?: string[]
}

interface Schema {
  type: SchemaTypeValue
  properties: Record<string, SchemaProperty>
  required?: string[]
}

/**
 * Helper to create a string property
 */
export function stringProp(description?: string): SchemaProperty {
  return { type: SchemaType.STRING, description }
}

/**
 * Helper to create a number property
 */
export function numberProp(description?: string): SchemaProperty {
  return { type: SchemaType.NUMBER, description }
}

/**
 * Helper to create an integer property
 */
export function integerProp(description?: string): SchemaProperty {
  return { type: SchemaType.INTEGER, description }
}

/**
 * Helper to create a boolean property
 */
export function booleanProp(description?: string): SchemaProperty {
  return { type: SchemaType.BOOLEAN, description }
}

/**
 * Helper to create an array property
 */
export function arrayProp(items: SchemaProperty, description?: string): SchemaProperty {
  return { type: SchemaType.ARRAY, items, description }
}

/**
 * Helper to create an object property
 */
export function objectProp(
  properties: Record<string, SchemaProperty>,
  required?: string[],
  description?: string
): SchemaProperty {
  return { type: SchemaType.OBJECT, properties, required, description }
}

/**
 * Helper to create an enum string property
 */
export function enumProp(values: string[], description?: string): SchemaProperty {
  return { type: SchemaType.STRING, enum: values, description }
}

// ============================================================================
// KEYWORD GENERATION SCHEMA
// ============================================================================

/**
 * Schema for a single generated keyword
 */
export const KeywordItemSchema: SchemaProperty = objectProp(
  {
    keyword: stringProp('The keyword phrase (2-6 words)'),
    searchVolume: integerProp('Estimated monthly search volume (0-1000000)'),
    difficulty: integerProp('SEO difficulty score (0-100)'),
    intent: enumProp(
      ['informational', 'navigational', 'commercial', 'transactional'],
      'Search intent type'
    ),
    cpc: numberProp('Cost per click estimate in USD'),
    competition: enumProp(['low', 'medium', 'high'], 'Competition level'),
    serpFeatures: arrayProp(
      stringProp(),
      'SERP features (e.g., featured_snippet, people_also_ask, knowledge_panel)'
    ),
    aeoOpportunity: integerProp('AEO opportunity score (0-100)'),
    reasoning: stringProp('Why this keyword is relevant'),
  },
  ['keyword', 'searchVolume', 'difficulty', 'intent']
)

/**
 * Schema for keyword generation response
 */
export const KeywordGenerationSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    keywords: arrayProp(KeywordItemSchema, 'List of generated keywords'),
    summary: stringProp('Brief summary of keyword strategy'),
    totalKeywords: integerProp('Total number of keywords generated'),
  },
  required: ['keywords', 'totalKeywords'],
}

// ============================================================================
// BLOG ARTICLE SCHEMA
// ============================================================================

/**
 * Schema for comparison table
 */
export const ComparisonTableSchema: SchemaProperty = objectProp(
  {
    title: stringProp('Table title'),
    headers: arrayProp(stringProp(), 'Column headers (2-6 columns)'),
    rows: arrayProp(arrayProp(stringProp()), 'Table rows (1-10 rows)'),
  },
  ['title', 'headers', 'rows']
)

/**
 * Schema for blog article generation
 */
export const BlogArticleSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    // Meta fields
    Title: stringProp('SEO-optimized article title (50-60 chars)'),
    Meta_Description: stringProp('Meta description (120-160 chars)'),
    Slug: stringProp('URL-friendly slug'),

    // Content structure
    Intro: stringProp('Introduction paragraph (150-200 words, HTML allowed)'),
    Direct_Answer: stringProp('Direct answer for featured snippet (40-60 words)'),
    Teaser: stringProp('Teaser for search results (1-2 sentences)'),

    // Sections (up to 9)
    section_01_heading: stringProp('Section 1 heading (H2)'),
    section_01_content: stringProp('Section 1 content (HTML allowed)'),
    section_02_heading: stringProp('Section 2 heading (H2)'),
    section_02_content: stringProp('Section 2 content (HTML allowed)'),
    section_03_heading: stringProp('Section 3 heading (H2)'),
    section_03_content: stringProp('Section 3 content (HTML allowed)'),
    section_04_heading: stringProp('Section 4 heading (H2, optional)'),
    section_04_content: stringProp('Section 4 content (HTML allowed, optional)'),
    section_05_heading: stringProp('Section 5 heading (H2, optional)'),
    section_05_content: stringProp('Section 5 content (HTML allowed, optional)'),
    section_06_heading: stringProp('Section 6 heading (H2, optional)'),
    section_06_content: stringProp('Section 6 content (HTML allowed, optional)'),

    // PAA (People Also Ask)
    paa_01_question: stringProp('PAA question 1'),
    paa_01_answer: stringProp('PAA answer 1 (50-100 words)'),
    paa_02_question: stringProp('PAA question 2'),
    paa_02_answer: stringProp('PAA answer 2 (50-100 words)'),
    paa_03_question: stringProp('PAA question 3'),
    paa_03_answer: stringProp('PAA answer 3 (50-100 words)'),

    // FAQ
    faq_01_question: stringProp('FAQ question 1'),
    faq_01_answer: stringProp('FAQ answer 1'),
    faq_02_question: stringProp('FAQ question 2'),
    faq_02_answer: stringProp('FAQ answer 2'),
    faq_03_question: stringProp('FAQ question 3'),
    faq_03_answer: stringProp('FAQ answer 3'),

    // Tables
    tables: arrayProp(ComparisonTableSchema, 'Comparison tables (max 2)'),

    // Sources
    Sources: stringProp('Comma-separated list of source URLs'),
  },
  required: ['Title', 'Meta_Description', 'Slug', 'Intro', 'Direct_Answer'],
}

// ============================================================================
// ANALYTICS SCHEMAS
// ============================================================================

/**
 * Schema for health check item
 */
export const HealthCheckItemSchema: SchemaProperty = objectProp(
  {
    category: enumProp(
      ['technical', 'content', 'authority', 'ux'],
      'Check category'
    ),
    item: stringProp('What was checked'),
    status: enumProp(['pass', 'warning', 'fail'], 'Check status'),
    score: integerProp('Score (0-100)'),
    recommendation: stringProp('Improvement recommendation'),
    priority: enumProp(['high', 'medium', 'low'], 'Fix priority'),
  },
  ['category', 'item', 'status', 'score']
)

/**
 * Schema for health check response
 */
export const HealthCheckSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    overallScore: integerProp('Overall health score (0-100)'),
    checks: arrayProp(HealthCheckItemSchema, 'List of health checks'),
    summary: stringProp('Brief summary of site health'),
    topPriorities: arrayProp(stringProp(), 'Top 3 priorities to fix'),
  },
  required: ['overallScore', 'checks', 'summary'],
}

/**
 * Schema for mentions check item
 */
export const MentionItemSchema: SchemaProperty = objectProp(
  {
    source: stringProp('AI model or search engine name'),
    mentioned: booleanProp('Whether brand was mentioned'),
    context: stringProp('Context of the mention'),
    sentiment: enumProp(['positive', 'neutral', 'negative'], 'Mention sentiment'),
    url: stringProp('Source URL if available'),
  },
  ['source', 'mentioned']
)

/**
 * Schema for mentions check response
 */
export const MentionsCheckSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    brand: stringProp('Brand/company name checked'),
    totalMentions: integerProp('Total mentions found'),
    mentions: arrayProp(MentionItemSchema, 'List of mentions'),
    visibilityScore: integerProp('Overall visibility score (0-100)'),
    recommendations: arrayProp(stringProp(), 'Recommendations to improve visibility'),
  },
  required: ['brand', 'totalMentions', 'mentions', 'visibilityScore'],
}

// ============================================================================
// CONTEXT GENERATION SCHEMA
// ============================================================================

/**
 * Schema for business context generation
 */
export const BusinessContextSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    companyName: stringProp('Company name'),
    industry: stringProp('Primary industry'),
    subIndustry: stringProp('Sub-industry or niche'),
    targetAudience: stringProp('Target audience description'),
    uniqueValueProposition: stringProp('Unique value proposition'),
    competitors: arrayProp(stringProp(), 'Main competitors'),
    keyProducts: arrayProp(stringProp(), 'Key products or services'),
    brandVoice: enumProp(
      ['professional', 'casual', 'technical', 'friendly', 'authoritative'],
      'Brand voice/tone'
    ),
    contentGoals: arrayProp(stringProp(), 'Content marketing goals'),
    keywords: arrayProp(stringProp(), 'Core keywords'),
  },
  required: ['companyName', 'industry', 'targetAudience', 'uniqueValueProposition'],
}

// ============================================================================
// EXPORT ALL SCHEMAS
// ============================================================================

export const GeminiSchemas = {
  // Keyword generation
  KeywordGeneration: KeywordGenerationSchema,
  KeywordItem: KeywordItemSchema,

  // Blog generation
  BlogArticle: BlogArticleSchema,
  ComparisonTable: ComparisonTableSchema,

  // Analytics
  HealthCheck: HealthCheckSchema,
  HealthCheckItem: HealthCheckItemSchema,
  MentionsCheck: MentionsCheckSchema,
  MentionItem: MentionItemSchema,

  // Context
  BusinessContext: BusinessContextSchema,
}

export default GeminiSchemas
