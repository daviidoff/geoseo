/**
 * ABOUTME: OpenBlog prompt builders for blog generation
 * ABOUTME: Ported from openblog/pipeline/prompts/simple_article_prompt.py
 */

interface CompanyContext {
  company_name?: string
  company_url?: string
  industry?: string
  description?: string
  products?: string
  target_audience?: string
  competitors?: string | string[]
  tone?: string
  pain_points?: string
  value_propositions?: string
  use_cases?: string
  content_themes?: string
  system_instructions?: string
  client_knowledge_base?: string
  content_instructions?: string
}

interface BuildArticlePromptParams {
  primary_keyword: string
  company_context: CompanyContext
  language?: string
  word_count?: number
  country?: string
  content_generation_instruction?: string
  tone_override?: string
  system_prompts?: string[]
}

/**
 * Build article prompt using company context.
 * Ported from simple_article_prompt.py:build_article_prompt()
 */
export function buildArticlePrompt({
  primary_keyword,
  company_context,
  language = 'en',
  word_count,
  country,
  content_generation_instruction,
  tone_override,
  system_prompts = [],
}: BuildArticlePromptParams): string {
  // Extract company context fields
  const company_name = company_context.company_name || 'the company'
  const company_url = company_context.company_url || ''
  const industry = company_context.industry || ''
  const description = company_context.description || ''

  // Tone priority: tone_override > company_context.tone > "professional"
  const tone = tone_override || company_context.tone || 'professional'

  const products = company_context.products || ''
  const target_audience = company_context.target_audience || ''

  // Handle competitors (can be string or array)
  const competitors_raw = company_context.competitors
  const competitors = Array.isArray(competitors_raw)
    ? competitors_raw.join(', ')
    : (competitors_raw || '')

  const pain_points = company_context.pain_points || ''
  const value_propositions = company_context.value_propositions || ''
  const use_cases = company_context.use_cases || ''
  const content_themes = company_context.content_themes || ''

  // Content guidelines
  const system_instructions = company_context.system_instructions || ''
  const client_knowledge_base = company_context.client_knowledge_base || ''
  const content_instructions = company_context.content_instructions || ''

  // Build the company context section
  let company_section = `
COMPANY CONTEXT:
Company: ${company_name}
Website: ${company_url}`

  if (industry) {
    company_section += `\nIndustry: ${industry}`
  }

  if (description) {
    company_section += `\nDescription: ${description}`
  }

  if (products) {
    company_section += `\nProducts/Services: ${products}`
  }

  if (target_audience) {
    company_section += `\nTarget Audience: ${target_audience}`
  }

  if (tone) {
    company_section += `\nBrand Tone: ${tone}`
  }

  // Add optional sections if provided
  let optional_sections = ''

  if (pain_points) {
    optional_sections += `

CUSTOMER PAIN POINTS:
${pain_points}`
  }

  if (value_propositions) {
    optional_sections += `

VALUE PROPOSITIONS:
${value_propositions}`
  }

  if (use_cases) {
    optional_sections += `

USE CASES:
${use_cases}`
  }

  if (content_themes) {
    optional_sections += `

CONTENT THEMES: ${content_themes}`
  }

  if (competitors) {
    optional_sections += `

COMPETITORS TO DIFFERENTIATE FROM: ${competitors}`
  }

  // Content guidelines section
  let guidelines_section = ''

  // Article-level system instructions
  if (system_instructions) {
    guidelines_section += `

SYSTEM INSTRUCTIONS (Article-level):
${system_instructions}`
  }

  // Batch-level system prompts
  if (system_prompts.length > 0) {
    const batch_prompts_text = system_prompts.map(p => `- ${p}`).join('\n')
    guidelines_section += `

BATCH INSTRUCTIONS (Applies to all articles in this batch):
${batch_prompts_text}`
  }

  // Company knowledge base
  if (client_knowledge_base) {
    guidelines_section += `

COMPANY KNOWLEDGE BASE:
${client_knowledge_base}`
  }

  // Article-level content instructions
  if (content_instructions) {
    guidelines_section += `

CONTENT WRITING INSTRUCTIONS (Article-level):
${content_instructions}`
  }

  // Build market context section (if country provided)
  let market_section = ''
  if (country) {
    const country_name_map: Record<string, string> = {
      'US': 'United States', 'DE': 'Germany', 'FR': 'France', 'GB': 'United Kingdom', 'UK': 'United Kingdom',
      'IT': 'Italy', 'ES': 'Spain', 'NL': 'Netherlands', 'BE': 'Belgium', 'AT': 'Austria', 'CH': 'Switzerland',
      'PL': 'Poland', 'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland', 'IE': 'Ireland',
      'PT': 'Portugal', 'GR': 'Greece', 'CZ': 'Czech Republic', 'HU': 'Hungary', 'RO': 'Romania'
    }
    const country_display = country_name_map[country.toUpperCase()] || country.toUpperCase()
    market_section = `
TARGET MARKET:
- Primary country: ${country_display} (${country.toUpperCase()})
- Adapt content for ${country_display} market context, regulations, and cultural expectations
- Use market-appropriate examples, authorities, and references
- Consider local business practices and industry standards for ${country_display}
`
  }

  // Build content generation instruction section
  let custom_instruction_section = ''
  if (content_generation_instruction && content_generation_instruction.trim()) {
    custom_instruction_section = `

ADDITIONAL CONTENT INSTRUCTIONS:
${content_generation_instruction}
`
  }

  // Build the complete prompt
  const prompt = `Write a comprehensive, high-quality blog article about "${primary_keyword}".

TOPIC FOCUS:
The article must be entirely focused on "${primary_keyword}". Every section, paragraph, and example should relate directly to this topic.
- Deep dive into what "${primary_keyword}" means, how it works, why it matters
- Provide practical, actionable insights about "${primary_keyword}"
- Include real-world examples and use cases related to "${primary_keyword}"
- Address common questions and concerns about "${primary_keyword}"

${company_section}${optional_sections}${guidelines_section}${market_section}${custom_instruction_section}

ARTICLE REQUIREMENTS:
- Target language: ${language}
- Write in ${tone} tone
- Focus on providing genuine value to readers
- Include specific examples and actionable insights
- Structure with clear headings and subheadings
- Include introduction, main sections, and conclusion
- Make it engaging and informative
- Note: Word count target is specified dynamically in the system instruction (based on job configuration)

CRITICAL REQUIREMENTS (Detailed specifications in system instruction):
- Follow all citation requirements specified in the system instruction (every paragraph must include citations)
- Follow all section header requirements specified in the system instruction (2+ question-format headers)
- Follow all conversational tone requirements specified in the system instruction (10+ conversational phrases)
- Follow all content quality requirements specified in the system instruction (E-E-A-T, data-driven content, section variety)
- **MANDATORY:** Include \`image_01_url\` (Unsplash URL) and \`image_01_alt_text\` - these are REQUIRED fields in the JSON schema
- **RECOMMENDED:** Include \`image_02_url\` and \`image_03_url\` (Unsplash URLs) with alt text and credits for better engagement
- **CRITICAL FOR SEO:** Create VARIED section lengths (not uniform) - at least 2 LONG sections (700+ words), 2-3 MEDIUM sections (400-600 words), remaining SHORT (200-300 words). You decide which topics deserve LONG treatment based on their complexity and importance.

Please write the complete article now.`

  return prompt
}
