/**
 * ABOUTME: AEO Mentions Check Service - AI platform visibility analysis with quality-adjusted scoring, position detection, and dimension-based query generation
 * ABOUTME: Migrated from Python openanalytics/aeo-checks/mentions_service.py with 100% functional parity using gemini-3-flash-preview model
 */

import { AI_PLATFORMS, getFastModePlatforms, getFullModePlatforms } from './platforms';

// ==================== Types ====================

export interface CompanyInfo {
  industry?: string;
  productCategory?: string;
  services?: string[];
  products?: string[];
  pain_points?: string[];
  country_specific_queries?: string[];
  geographic_modifiers?: string[];
  regulatory_requirements?: string[];
  use_cases?: string[];
  description?: string;
}

export interface CompanyAnalysis {
  companyInfo: CompanyInfo;
  competitors?: Array<{ name: string }>;
}

export interface MentionsCheckRequest {
  companyName: string;
  companyAnalysis: CompanyAnalysis;
  language?: string;
  country?: string;
  numQueries?: number;
  mode?: 'full' | 'fast';
  generateInsights?: boolean;
  platforms?: string[];
}

export interface QueryResult {
  query: string;
  dimension: string;
  platform: string;
  raw_mentions: number;
  capped_mentions: number;
  quality_score: number;
  mention_type: string;
  position: number | null;
  source_urls: string[];
  competitor_mentions: Array<{ name: string; count: number }>;
  response_text: string;
}

export interface PlatformStats {
  mentions: number;
  quality_score: number;
  responses: number;
  errors: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
}

export interface DimensionStats {
  mentions: number;
  quality_score: number;
  queries: number;
}

export interface MentionsCheckResponse {
  companyName: string;
  visibility: number;
  band: string;
  mentions: number;
  presence_rate: number;
  quality_score: number;
  max_quality: number;
  platform_stats: Record<string, PlatformStats>;
  dimension_stats: Record<string, DimensionStats>;
  query_results: QueryResult[];
  actualQueriesProcessed: number;
  execution_time_seconds: number;
  total_cost: number;
  total_tokens: number;
  mode: string;
}

// ==================== Quality Scoring Functions ====================

/**
 * Detect mention quality type
 */
export function detectMentionType(text: string, companyName: string): string {
  const textLower = text.toLowerCase();
  const companyLower = companyName.toLowerCase();

  const recommendPatterns = [
    `recommend ${companyLower}`,
    `${companyLower} is the best`,
    `best.*${companyLower}`,
    `${companyLower}.*excellent`,
    `top choice.*${companyLower}`,
  ];

  for (const pattern of recommendPatterns) {
    const regex = new RegExp(pattern);
    if (regex.test(textLower)) {
      return 'primary_recommendation';
    }
  }

  const topOptionPattern = new RegExp(`(top|leading|best).*${companyLower}`);
  if (topOptionPattern.test(textLower)) {
    return 'top_option';
  }

  const listedPattern = new RegExp(`\\d+\\.|\\*.*${companyLower}`);
  if (listedPattern.test(text)) {
    return 'listed_option';
  }

  if (textLower.includes(companyLower)) {
    return 'mentioned_in_context';
  }

  return 'none';
}

/**
 * Detect position in numbered/bulleted lists
 */
export function detectListPosition(text: string, companyName: string): number | null {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const regex = new RegExp(companyName, 'i');
    if (regex.test(line)) {
      const numberedMatch = line.match(/^\s*([\d]+)[\.)\s]/);
      if (numberedMatch) {
        return parseInt(numberedMatch[1]);
      }
      if (/^\s*[\*\-\•]/.test(line)) {
        return i + 1;
      }
    }
  }
  return null;
}

/**
 * Count and cap mentions with quality scoring
 */
export function countMentions(
  text: string,
  companyName: string
): {
  raw_mentions: number;
  capped_mentions: number;
  quality_score: number;
  mention_type: string;
  position: number | null;
} {
  const regex = new RegExp(companyName, 'gi');
  const matches = text.match(regex);
  const rawMentions = matches ? matches.length : 0;

  if (rawMentions === 0) {
    return {
      raw_mentions: 0,
      capped_mentions: 0,
      quality_score: 0.0,
      mention_type: 'none',
      position: null,
    };
  }

  const cappedMentions = Math.min(rawMentions, 3);
  const mentionType = detectMentionType(text, companyName);
  const position = detectListPosition(text, companyName);

  // Base scores by mention type
  const baseScores: Record<string, number> = {
    primary_recommendation: 9.0,
    top_option: 7.0,
    listed_option: 5.0,
    mentioned_in_context: 3.0,
    none: 0.0,
  };
  const baseScore = baseScores[mentionType] || 3.0;

  // Position bonus
  let positionBonus = 0.0;
  if (position !== null) {
    if (position === 1) {
      positionBonus = 2.0;
    } else if (position <= 3) {
      positionBonus = 1.0;
    } else if (position <= 5) {
      positionBonus = 0.5;
    }
  }

  // Multiple mentions bonus
  const mentionBonus = Math.min(1.0, (cappedMentions - 1) * 0.5);

  const qualityScore = Math.min(10.0, baseScore + positionBonus + mentionBonus);

  return {
    raw_mentions: rawMentions,
    capped_mentions: cappedMentions,
    quality_score: Math.round(qualityScore * 100) / 100,
    mention_type: mentionType,
    position,
  };
}

/**
 * Extract competitor mentions from response
 */
export function extractCompetitorMentions(
  text: string,
  competitors: Array<{ name: string }>
): Array<{ name: string; count: number }> {
  const results: Array<{ name: string; count: number }> = [];

  for (const comp of competitors) {
    const name = comp.name;
    if (name) {
      const regex = new RegExp(name, 'gi');
      const matches = text.match(regex);
      const count = matches ? matches.length : 0;
      if (count > 0) {
        results.push({ name, count });
      }
    }
  }

  return results;
}

// ==================== Query Generation ====================

interface QueryData {
  query: string;
  dimension: string;
}

/**
 * Generate test queries across dimensions
 */
export function generateQueries(
  companyName: string,
  companyAnalysis: CompanyAnalysis | null,
  numQueries: number,
  mode: string
): QueryData[] {
  const queries: QueryData[] = [];

  // Always include branded queries
  queries.push({ query: companyName, dimension: 'Branded' });
  queries.push({ query: `${companyName} software`, dimension: 'Branded' });

  // Extract info from company analysis
  let industry = '';
  let productCategory = '';
  let services: string[] = [];
  let painPoints: string[] = [];
  let countrySpecificQueries: string[] = [];
  let geographicModifiers: string[] = [];
  let regulatoryRequirements: string[] = [];
  let useCases: string[] = [];

  if (companyAnalysis?.companyInfo) {
    const info = companyAnalysis.companyInfo;
    industry = info.industry || '';
    productCategory = info.productCategory || '';
    services = info.services || [];
    painPoints = info.pain_points || [];
    countrySpecificQueries = info.country_specific_queries || [];
    geographicModifiers = info.geographic_modifiers || [];
    regulatoryRequirements = info.regulatory_requirements || [];
    useCases = info.use_cases || [];
  }

  // AI-platform + geography queries
  const aiPlatforms = ['ChatGPT', 'Perplexity', 'Claude', 'Gemini'];
  if (painPoints.length > 0 && geographicModifiers.length > 0) {
    for (const painPoint of painPoints.slice(0, 2)) {
      for (const platform of aiPlatforms.slice(0, 2)) {
        for (const geoMod of geographicModifiers.slice(0, 1)) {
          queries.push({
            query: `how to ${painPoint} with ${platform} for ${geoMod} companies`,
            dimension: 'AI-Platform-Geography',
          });
        }
      }
    }
  }

  // Service + geography combinations
  if (services.length > 0 && geographicModifiers.length > 0) {
    for (const service of services.slice(0, 1)) {
      for (const geoMod of geographicModifiers.slice(0, 1)) {
        queries.push({
          query: `${service} for ${geoMod} enterprises`,
          dimension: 'Service-Geography',
        });
      }
    }
  }

  // Industry + geography combinations
  if (industry && geographicModifiers.length > 0) {
    for (const geoMod of geographicModifiers.slice(0, 1)) {
      queries.push({
        query: `best ${industry} for ${geoMod} companies`,
        dimension: 'Industry-Geography',
      });
      if (painPoints.length > 0) {
        const painPoint = painPoints[0];
        queries.push({
          query: `how to ${painPoint} in ${industry} for ${geoMod} enterprises`,
          dimension: 'Industry-Geography-Intent',
        });
      }
    }
  }

  // Use pre-generated use cases
  if (useCases.length > 0) {
    for (const useCase of useCases.slice(0, 2)) {
      queries.push({
        query: `best practices for ${useCase}`,
        dimension: 'Use-Case/Intent',
      });
    }
  }

  // Compliance + AI platform queries
  if (regulatoryRequirements.length > 0 && services.length > 0) {
    for (const req of regulatoryRequirements.slice(0, 1)) {
      for (const service of services.slice(0, 1)) {
        queries.push({
          query: `${service} with ${req} compliance`,
          dimension: 'Compliance-Focused',
        });
      }
    }
  }

  // Service-specific queries
  if (services.length > 0) {
    for (const service of services.slice(0, 2)) {
      queries.push({
        query: `${service} software`,
        dimension: 'Service-Specific',
      });
    }
  } else if (industry) {
    queries.push({
      query: `${industry} software`,
      dimension: 'Service-Specific',
    });
  }

  // Industry/vertical queries
  if (industry) {
    queries.push({
      query: `best ${industry} tools`,
      dimension: 'Industry/Vertical',
    });
    queries.push({
      query: `${industry} solutions`,
      dimension: 'Industry/Vertical',
    });
  }

  // Use-case queries
  if (painPoints.length > 0) {
    for (const painPoint of painPoints.slice(0, 2)) {
      queries.push({
        query: `how to ${painPoint}`,
        dimension: 'Use-Case/Intent',
      });
    }
  }

  // Competitive queries
  queries.push({
    query: `${companyName} vs alternatives`,
    dimension: 'Competitive',
  });
  queries.push({
    query: `${companyName} competitors`,
    dimension: 'Competitive',
  });

  // Broad category
  if (productCategory) {
    queries.push({
      query: `best ${productCategory}`,
      dimension: 'Broad Category',
    });
  }

  const currentYear = new Date().getFullYear();
  queries.push({
    query: `best software tools ${currentYear}`,
    dimension: 'Broad Category',
  });

  // Limit based on mode
  if (mode === 'fast') {
    return queries.slice(0, 10);
  }
  return queries.slice(0, numQueries);
}

// ==================== Visibility Calculation ====================

/**
 * Calculate visibility score and band from query results
 */
export function calculateVisibility(
  queryResults: QueryResult[],
  totalResponses: number
): {
  visibility: number;
  band: string;
  presence_rate: number;
  avg_quality_when_mentioned: number;
} {
  const responsesWithMentions = queryResults.filter(qr => qr.mention_type !== 'none').length;
  const totalQuality = queryResults.reduce((sum, qr) => sum + qr.quality_score, 0);

  const presenceRate = totalResponses > 0 ? responsesWithMentions / totalResponses : 0;
  const avgQualityWhenMentioned = responsesWithMentions > 0 ? totalQuality / responsesWithMentions : 0;

  // Quality factor: ranges from 0.85 to 1.15
  const qualityFactor = 0.85 + (avgQualityWhenMentioned / 10) * 0.3;

  // Visibility = presence rate × quality factor (capped at 100%)
  const visibility = Math.min(100.0, presenceRate * qualityFactor * 100);

  // Determine visibility band
  let band = 'Minimal';
  if (visibility >= 80) {
    band = 'Dominant';
  } else if (visibility >= 60) {
    band = 'Strong';
  } else if (visibility >= 40) {
    band = 'Moderate';
  } else if (visibility >= 20) {
    band = 'Weak';
  }

  return {
    visibility: Math.round(visibility * 10) / 10,
    band,
    presence_rate: Math.round(presenceRate * 1000) / 10,
    avg_quality_when_mentioned: Math.round(avgQualityWhenMentioned * 100) / 100,
  };
}

/**
 * Validate company analysis has real data
 */
export function validateCompanyAnalysis(companyAnalysis: CompanyAnalysis): {
  valid: boolean;
  error?: string;
  details?: any;
} {
  const companyInfo = companyAnalysis.companyInfo || {};

  const products = companyInfo.products || [];
  const services = companyInfo.services || [];
  const industry = companyInfo.industry || '';
  const description = companyInfo.description || '';

  const hasProductsOrServices = products.length > 0 || services.length > 0;
  const hasDetailedDescription = description.length > 100;

  if (!hasProductsOrServices) {
    return {
      valid: false,
      error: 'Real company analysis data required',
      details: {
        message:
          'AEO mentions check requires REAL company analysis with products or services data. ' +
          'Basic CSV data (industry only) is NOT sufficient for meaningful visibility scores. ' +
          'You MUST run company analysis first (/company/analyze), then include the full result.',
        validation: {
          products: products.length,
          services: services.length,
          industry: industry || 'missing',
          description_length: description.length,
        },
        requirement: 'At least one product or service from company analysis is required.',
      },
    };
  }

  return { valid: true };
}
