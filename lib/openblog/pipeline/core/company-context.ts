/**
 * Company Context - Simplified Input System
 * Replaces the complex market-aware system with simple company information fields.
 * All fields are optional except company URL.
 */

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
};

/**
 * Simple company context for blog generation.
 *
 * INPUT: Only company_url is required (mandatory input).
 * OUTPUT: All fields are mandatory in output (always present, even if empty).
 *
 * Field names match opencontext schema for compatibility:
 * - products (not products_services)
 * - tone (not brand_tone)
 */
export interface CompanyContext {
  // REQUIRED INPUT FIELD
  companyUrl: string; // Required input - Company website URL

  // OPTIONAL INPUT FIELDS - Company Information (mandatory in output)
  companyName?: string;
  industry?: string;
  description?: string;

  // OPTIONAL INPUT FIELDS - Products & Services (mandatory in output)
  products?: string[]; // Renamed from products_services
  targetAudience?: string;

  // OPTIONAL INPUT FIELDS - Competitive Context (mandatory in output)
  competitors?: string[];
  tone?: string; // Renamed from brand_tone

  // OPTIONAL INPUT FIELDS - Business Context (mandatory in output)
  painPoints?: string[];
  valuePropositions?: string[];
  useCases?: string[];
  contentThemes?: string[];

  // OPTIONAL INPUT FIELDS - Content Guidelines (mandatory in output, openblog-specific)
  systemInstructions?: string; // Reusable prompts for all content
  clientKnowledgeBase?: string[]; // Facts about company
  contentInstructions?: string; // Style, format, requirements
}

/**
 * Validate the company context.
 * Only company_url is required, everything else is optional.
 */
export function validateCompanyContext(context: CompanyContext): boolean {
  if (!context.companyUrl || !context.companyUrl.trim()) {
    throw new Error('companyUrl is required');
  }

  // Basic URL validation
  if (
    !context.companyUrl.startsWith('http://') &&
    !context.companyUrl.startsWith('https://')
  ) {
    logger.warn(
      `Company URL should include protocol (http/https): ${context.companyUrl}`
    );
  }

  return true;
}

/**
 * Convert company context to prompt variables for content generation.
 *
 * OUTPUT: All fields are mandatory - always present in output (even if empty).
 * This ensures consistent structure matching opencontext schema.
 *
 * Returns a dictionary suitable for prompt template injection.
 */
export function companyContextToPrompt(
  context: CompanyContext
): Record<string, any> {
  // MANDATORY OUTPUT: All fields always present
  return {
    // Required input
    company_url: context.companyUrl,

    // Company Information (mandatory output)
    company_name: context.companyName || 'the company',
    industry: context.industry || '',
    description: context.description || '',

    // Products & Services (mandatory output)
    products: context.products ? context.products.join(', ') : '',
    target_audience: context.targetAudience || '',

    // Competitive Context (mandatory output)
    competitors: context.competitors || [], // List format (matching opencontext string[])
    tone: context.tone || 'professional',

    // Business Context (mandatory output)
    pain_points: context.painPoints
      ? context.painPoints.map((point) => `- ${point}`).join('\n')
      : '',
    value_propositions: context.valuePropositions
      ? context.valuePropositions.map((prop) => `- ${prop}`).join('\n')
      : '',
    use_cases: context.useCases
      ? context.useCases.map((useCase) => `- ${useCase}`).join('\n')
      : '',
    content_themes: context.contentThemes ? context.contentThemes.join(', ') : '',

    // Content Guidelines (mandatory output, openblog-specific)
    system_instructions: context.systemInstructions || '',
    client_knowledge_base: context.clientKnowledgeBase
      ? context.clientKnowledgeBase.map((fact) => `- ${fact}`).join('\n')
      : '',
    content_instructions: context.contentInstructions || '',
  };
}

/**
 * Create CompanyContext from dictionary.
 *
 * Handles both list and string inputs for flexibility.
 * Supports both old field names (products_services, brand_tone) and new names (products, tone)
 * for backward compatibility with opencontext.
 */
export function companyContextFromDict(data: Record<string, any>): CompanyContext {
  // Helper function to ensure list format
  function ensureList(value: any): string[] {
    if (typeof value === 'string') {
      // Split by newlines or commas and clean up
      const items = value
        .replace(/\n/g, ',')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item);
      return items;
    } else if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter((item) => item);
    } else {
      return [];
    }
  }

  // Support both old and new field names (backward compatibility)
  // Old: products_services, brand_tone
  // New: products, tone (matching opencontext)
  const products = ensureList(
    data.products || data.products_services || []
  );

  const tone = data.tone || data.brand_tone;

  return {
    companyUrl: data.company_url || data.companyUrl || '',
    companyName: data.company_name || data.companyName,
    industry: data.industry,
    description: data.description,
    products, // New name
    targetAudience: data.target_audience || data.targetAudience,
    competitors: ensureList(data.competitors || []),
    tone, // New name
    painPoints: ensureList(data.pain_points || data.painPoints || []),
    valuePropositions: ensureList(
      data.value_propositions || data.valuePropositions || []
    ),
    useCases: ensureList(data.use_cases || data.useCases || []),
    contentThemes: ensureList(data.content_themes || data.contentThemes || []),
    systemInstructions: data.system_instructions || data.systemInstructions,
    clientKnowledgeBase: ensureList(
      data.client_knowledge_base || data.clientKnowledgeBase || []
    ),
    contentInstructions: data.content_instructions || data.contentInstructions,
  };
}

/**
 * Create example CompanyContext for SCAILE.
 */
export function createScaileExample(): CompanyContext {
  return {
    companyUrl: 'https://scaile.tech',
    companyName: 'SCAILE',
    industry: 'AI Marketing & Answer Engine Optimization (AEO)',
    description:
      "SCAILE provides an AI Visibility Engine designed to help B2B companies and startups appear in AI-generated search results like Google AI Overviews and ChatGPT. By focusing on Answer Engine Optimization (AEO) rather than traditional SEO, they offer a productized, automated solution to turn brands into authoritative sources for high-intent AI queries.",
    products: [
      'AI Visibility Engine',
      'AEO Foundation (30 articles/mo)',
      'AEO Expansion (50 articles/mo)',
      'AEO Empire (100 articles/mo)',
      'Deep Intent Research',
      '5-LLM Visibility Tracking',
    ],
    targetAudience:
      'B2B Startups, SMEs (German Mittelstand), and Enterprise companies looking to dominate niche markets and automate inbound lead generation.',
    competitors: [
      'Profound',
      'Sight AI',
      'RevenueZen',
      'Omniscient Digital',
      'iPullRank',
      'First Page Sage',
      'AWISEE',
      'WebFX',
      'Intero Digital',
      'Nine Peaks Media',
    ],
    tone: "Professional, results-oriented, innovative, confident, and efficient (emphasizing 'productized' solutions over 'selling hours').",
    painPoints: [
      'Invisibility in modern AI search tools like ChatGPT and Google AI Overviews',
      'Declining effectiveness of traditional SEO and manual sales outreach',
      'High costs and difficulty in scaling content production for multiple markets',
      'Lack of qualified inbound leads from technical or niche audiences',
      'Unpredictable revenue funnels and reliance on headcount for growth',
    ],
    valuePropositions: [
      'Guaranteed visibility in the new era of AI-driven search',
      'A productized, automated engine that replaces manual agency hours',
      'Ability to dominate multiple markets with zero additional headcount',
      'KPI-first approach focused on tangible revenue and lead growth',
      'Comprehensive tracking across major LLMs to ensure brand authority',
    ],
    useCases: [
      "Ranking for 'Best [Product] for [Industry]' queries in ChatGPT",
      'Securing visibility in Google AI Overviews for high-intent searches',
      'Automating content creation to enter new language markets (e.g., German & English)',
      'Establishing brand authority as a primary source for AI answers',
      'Scaling inbound lead generation without increasing marketing headcount',
    ],
    contentThemes: [
      'Answer Engine Optimization (AEO)',
      'AI Search Visibility',
      'Generative Engine Optimization (GEO)',
      'B2B Sales Automation',
      'Digital Go-to-Market Strategy',
      'High-Intent Query Optimization',
    ],
    systemInstructions:
      'Always mention sustainability. Focus on B2B audiences. Use technical language. Emphasize ROI and cost savings.',
    clientKnowledgeBase: [
      'We target Fortune 500 companies',
      'We specialize in security solutions',
      'Founded in 2020',
    ],
    contentInstructions:
      "Include statistics, add case studies, use conversational tone, focus on AEO and Answer Engine visibility, include variations with 'AI search'",
  };
}
