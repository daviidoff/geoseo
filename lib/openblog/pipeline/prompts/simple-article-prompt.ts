/**
 * Simple Article Prompt - Company Context Based
 * Replaces complex market-aware prompts with simple company context injection.
 */

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
  debug: (msg: string) => console.debug(`[DEBUG] ${msg}`),
};

/**
 * Build a simple article prompt using company context.
 */
export function buildArticlePrompt(params: {
  primaryKeyword: string;
  companyContext: Record<string, any>;
  language?: string;
  wordCount?: number;
  country?: string;
  contentGenerationInstruction?: string;
  toneOverride?: string;
  systemPrompts?: string[];
}): string {
  const {
    primaryKeyword,
    companyContext,
    language = 'en',
    wordCount,
    country,
    contentGenerationInstruction,
    toneOverride,
    systemPrompts = [],
  } = params;

  // All fields are mandatory in output (from to_prompt_context)
  const companyName = companyContext.company_name || 'the company';
  const companyUrl = companyContext.company_url || '';
  const industry = companyContext.industry || '';
  const description = companyContext.description || '';

  // Tone priority: job_config.tone_override > company_context.tone > "professional"
  const tone = toneOverride || companyContext.tone || 'professional';

  // Products & Services
  const products = companyContext.products || '';
  const targetAudience = companyContext.target_audience || '';
  const competitorsRaw = companyContext.competitors || [];
  const competitors = Array.isArray(competitorsRaw)
    ? competitorsRaw.join(', ')
    : String(competitorsRaw || '');
  const painPoints = companyContext.pain_points || '';
  const valuePropositions = companyContext.value_propositions || '';
  const useCases = companyContext.use_cases || '';
  const contentThemes = companyContext.content_themes || '';

  // Content guidelines (article-level from company_context)
  const systemInstructions = companyContext.system_instructions || '';
  const clientKnowledgeBase = companyContext.client_knowledge_base || '';
  const contentInstructions = companyContext.content_instructions || '';

  // Batch-level system prompts
  let batchSystemPromptsText = '';
  if (systemPrompts.length > 0) {
    batchSystemPromptsText = systemPrompts.map((p) => `- ${p}`).join('\n');
  }

  // Build the company context section
  let companySection = `
COMPANY CONTEXT:
Company: ${companyName}
Website: ${companyUrl}`;

  if (industry) companySection += `\nIndustry: ${industry}`;
  if (description) companySection += `\nDescription: ${description}`;
  if (products) companySection += `\nProducts/Services: ${products}`;
  if (targetAudience) companySection += `\nTarget Audience: ${targetAudience}`;
  if (tone) companySection += `\nBrand Tone: ${tone}`;

  // Add optional sections if provided
  let optionalSections = '';

  if (painPoints) {
    optionalSections += `

CUSTOMER PAIN POINTS:
${painPoints}`;
  }

  if (valuePropositions) {
    optionalSections += `

VALUE PROPOSITIONS:
${valuePropositions}`;
  }

  if (useCases) {
    optionalSections += `

USE CASES:
${useCases}`;
  }

  if (contentThemes) {
    optionalSections += `

CONTENT THEMES: ${contentThemes}`;
  }

  if (competitors) {
    optionalSections += `

COMPETITORS TO DIFFERENTIATE FROM: ${competitors}`;
  }

  // Content guidelines section
  let guidelinesSection = '';

  if (systemInstructions) {
    guidelinesSection += `

SYSTEM INSTRUCTIONS (Article-level):
${systemInstructions}`;
  }

  if (batchSystemPromptsText) {
    guidelinesSection += `

BATCH INSTRUCTIONS (Applies to all articles in this batch):
${batchSystemPromptsText}`;
  }

  if (clientKnowledgeBase) {
    guidelinesSection += `

COMPANY KNOWLEDGE BASE:
${clientKnowledgeBase}`;
  }

  if (contentInstructions) {
    guidelinesSection += `

CONTENT WRITING INSTRUCTIONS (Article-level):
${contentInstructions}`;
  }

  // Determine word count target (dynamic or default)
  let wordCountText: string;
  let wordCountRange: string;

  if (wordCount) {
    wordCountText = `${wordCount.toLocaleString()} words`;
    if (wordCount < 1500) {
      const min = Math.max(800, wordCount - 200);
      const max = wordCount + 200;
      wordCountRange = `${min}-${max} words`;
    } else if (wordCount < 2500) {
      wordCountRange = `${wordCount - 300}-${wordCount + 300} words`;
    } else {
      wordCountRange = `${wordCount - 500}-${wordCount + 500} words`;
    }
  } else {
    wordCountText = '1,500-2,500 words';
    wordCountRange = '1,500-2,500 words';
  }

  // Build market context section (if country provided)
  let marketSection = '';
  if (country) {
    const countryNameMap: Record<string, string> = {
      US: 'United States',
      DE: 'Germany',
      FR: 'France',
      GB: 'United Kingdom',
      UK: 'United Kingdom',
      IT: 'Italy',
      ES: 'Spain',
      NL: 'Netherlands',
      BE: 'Belgium',
      AT: 'Austria',
      CH: 'Switzerland',
      PL: 'Poland',
      SE: 'Sweden',
      NO: 'Norway',
      DK: 'Denmark',
      FI: 'Finland',
      IE: 'Ireland',
      PT: 'Portugal',
      GR: 'Greece',
      CZ: 'Czech Republic',
      HU: 'Hungary',
      RO: 'Romania',
    };
    const countryDisplay = countryNameMap[country.toUpperCase()] || country.toUpperCase();
    marketSection = `
TARGET MARKET:
- Primary country: ${countryDisplay} (${country.toUpperCase()})
- Adapt content for ${countryDisplay} market context, regulations, and cultural expectations
- Use market-appropriate examples, authorities, and references
- Consider local business practices and industry standards for ${countryDisplay}
`;
  }

  // Build content generation instruction section (if provided)
  let customInstructionSection = '';
  if (contentGenerationInstruction && contentGenerationInstruction.trim()) {
    customInstructionSection = `

ADDITIONAL CONTENT INSTRUCTIONS:
${contentGenerationInstruction}
`;
  }

  // Build the complete prompt
  const prompt = `Write a comprehensive, high-quality blog article about "${primaryKeyword}".

TOPIC FOCUS:
The article must be entirely focused on "${primaryKeyword}". Every section, paragraph, and example should relate directly to this topic.
- Deep dive into what "${primaryKeyword}" means, how it works, why it matters
- Provide practical, actionable insights about "${primaryKeyword}"
- Include real-world examples and use cases related to "${primaryKeyword}"
- Address common questions and concerns about "${primaryKeyword}"

${companySection}${optionalSections}${guidelinesSection}${marketSection}${customInstructionSection}

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

Please write the complete article now.`;

  logger.debug(`Generated prompt length: ${prompt.length} characters`);
  logger.debug(`Company context included: ${!!(companyName && companyUrl)}`);
  logger.debug(`Optional sections: ${optionalSections.length} chars`);
  logger.debug(`Guidelines sections: ${guidelinesSection.length} chars`);

  return prompt;
}

/**
 * Validate that required inputs are provided for prompt generation.
 */
export function validatePromptInputs(
  primaryKeyword: string,
  companyContext: Record<string, any>
): boolean {
  if (!primaryKeyword || !primaryKeyword.trim()) {
    throw new Error('primary_keyword is required and cannot be empty');
  }

  if (!companyContext.company_url) {
    throw new Error('company_url is required in company_context');
  }

  return true;
}

/**
 * Estimate the prompt length without building the full prompt.
 * Useful for checking if prompt will be too long for API limits.
 */
export function getPromptLengthEstimate(
  primaryKeyword: string,
  companyContext: Record<string, any>,
  language: string = 'en'
): number {
  const basePromptLength = 800; // Approximate base template length

  // Add length of dynamic content
  const keywordLength = primaryKeyword ? primaryKeyword.length : 0;
  const companyNameLength = (companyContext.company_name || '').length;
  const descriptionLength = (companyContext.description || '').length;

  // Add length of optional sections
  const competitorsRaw = companyContext.competitors || [];
  const competitorsStr = Array.isArray(competitorsRaw)
    ? competitorsRaw.join(', ')
    : String(competitorsRaw || '');

  const optionalLength =
    (companyContext.products || '').length +
    (companyContext.target_audience || '').length +
    competitorsStr.length +
    (companyContext.pain_points || '').length +
    (companyContext.value_propositions || '').length +
    (companyContext.use_cases || '').length +
    (companyContext.content_themes || '').length +
    (companyContext.system_instructions || '').length +
    (companyContext.client_knowledge_base || '').length +
    (companyContext.content_instructions || '').length;

  const estimatedLength =
    basePromptLength +
    keywordLength +
    companyNameLength +
    descriptionLength +
    optionalLength;

  logger.debug(`Estimated prompt length: ${estimatedLength} characters`);
  return estimatedLength;
}
