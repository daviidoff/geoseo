/**
 * ABOUTME: SE Ranking API client for competitor gap analysis
 * ABOUTME: Discovers keywords competitors rank for but you don't
 *
 * TypeScript port of openkeywords/seranking_client.py
 */

export interface SERankingConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface CompetitorGapResult {
  competitor_url: string;
  gap_keywords: string[];
  total_gap_keywords: number;
  competitor_total_keywords: number;
  overlap_keywords: string[];
  overlap_count: number;
}

export interface KeywordGapAnalysis {
  your_url: string;
  competitors: CompetitorGapResult[];
  total_gap_opportunities: number;
  recommended_keywords: string[];
}

/**
 * SE Ranking API client for competitor keyword gap analysis.
 *
 * Finds keywords your competitors rank for that you don't.
 * Helps identify content gaps and opportunities.
 */
export class SERankingClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: SERankingConfig = {}) {
    this.apiKey = config.apiKey || process.env.SE_RANKING_API_KEY || "";
    this.baseUrl = config.baseUrl || "https://api4.seranking.com/";

    if (!this.apiKey) {
      console.warn("SE Ranking API key not configured - gap analysis will be skipped");
    } else {
      console.log("SE Ranking client initialized");
    }
  }

  /**
   * Check if SE Ranking is configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Analyze keyword gaps between your site and competitors
   */
  async analyzeKeywordGap(
    yourUrl: string,
    competitorUrls: string[],
    region: string = "us",
    limit: number = 50
  ): Promise<KeywordGapAnalysis> {
    if (!this.isConfigured()) {
      console.warn("SE Ranking not configured - returning empty gap analysis");
      return {
        your_url: yourUrl,
        competitors: [],
        total_gap_opportunities: 0,
        recommended_keywords: [],
      };
    }

    if (!competitorUrls || competitorUrls.length === 0) {
      return {
        your_url: yourUrl,
        competitors: [],
        total_gap_opportunities: 0,
        recommended_keywords: [],
      };
    }

    console.log(
      `Analyzing keyword gap: ${yourUrl} vs ${competitorUrls.length} competitors...`
    );

    // Analyze each competitor
    const competitorResults: CompetitorGapResult[] = [];

    for (const competitorUrl of competitorUrls) {
      try {
        const gapResult = await this.getGapForCompetitor(
          yourUrl,
          competitorUrl,
          region,
          limit
        );
        competitorResults.push(gapResult);
      } catch (error) {
        console.error(`Failed to analyze ${competitorUrl}:`, error);
      }
    }

    // Aggregate all gap keywords
    const allGapKeywords = new Set<string>();
    for (const result of competitorResults) {
      for (const kw of result.gap_keywords) {
        allGapKeywords.add(kw);
      }
    }

    // Rank keywords by how many competitors use them (more = better opportunity)
    const keywordFrequency = new Map<string, number>();
    for (const result of competitorResults) {
      for (const kw of result.gap_keywords) {
        keywordFrequency.set(kw, (keywordFrequency.get(kw) || 0) + 1);
      }
    }

    const recommended = Array.from(keywordFrequency.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
      .slice(0, limit)
      .map(([kw]) => kw);

    console.log(
      `Gap analysis complete: ${allGapKeywords.size} total opportunities, ${recommended.length} recommended`
    );

    return {
      your_url: yourUrl,
      competitors: competitorResults,
      total_gap_opportunities: allGapKeywords.size,
      recommended_keywords: recommended,
    };
  }

  /**
   * Get keyword gap for a single competitor
   */
  private async getGapForCompetitor(
    yourUrl: string,
    competitorUrl: string,
    region: string,
    limit: number
  ): Promise<CompetitorGapResult> {
    try {
      // SE Ranking API endpoint for keyword gap analysis
      const endpoint = `${this.baseUrl}keywords/gap`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${this.apiKey}`,
        },
        body: JSON.stringify({
          your_domain: yourUrl,
          competitor_domain: competitorUrl,
          region_id: this.getRegionId(region),
          limit: limit,
        }),
      });

      if (!response.ok) {
        throw new Error(`SE Ranking API error: ${response.status}`);
      }

      const data = await response.json();

      // Parse response
      const gapKeywords = (data.gap_keywords || []).map((item: any) => item.keyword || item);
      const overlapKeywords = (data.overlap_keywords || []).map((item: any) => item.keyword || item);

      return {
        competitor_url: competitorUrl,
        gap_keywords: gapKeywords,
        total_gap_keywords: gapKeywords.length,
        competitor_total_keywords: data.competitor_total_keywords || 0,
        overlap_keywords: overlapKeywords,
        overlap_count: overlapKeywords.length,
      };
    } catch (error) {
      console.error(`SE Ranking gap analysis failed for ${competitorUrl}:`, error);
      return {
        competitor_url: competitorUrl,
        gap_keywords: [],
        total_gap_keywords: 0,
        competitor_total_keywords: 0,
        overlap_keywords: [],
        overlap_count: 0,
      };
    }
  }

  /**
   * Map region code to SE Ranking region ID
   */
  private getRegionId(region: string): number {
    const regionMap: Record<string, number> = {
      us: 1,
      uk: 2,
      ca: 3,
      au: 4,
      de: 5,
      fr: 6,
      es: 7,
      it: 8,
      br: 9,
      mx: 10,
      ar: 11,
      in: 12,
      // Add more as needed
    };

    return regionMap[region.toLowerCase()] || 1; // Default to US
  }

  /**
   * Get keywords your competitors rank for
   */
  async getCompetitorKeywords(
    competitorUrl: string,
    region: string = "us",
    limit: number = 100
  ): Promise<string[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const endpoint = `${this.baseUrl}keywords/organic`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${this.apiKey}`,
        },
        body: JSON.stringify({
          domain: competitorUrl,
          region_id: this.getRegionId(region),
          limit: limit,
        }),
      });

      if (!response.ok) {
        throw new Error(`SE Ranking API error: ${response.status}`);
      }

      const data = await response.json();
      return (data.keywords || []).map((item: any) => item.keyword || item);
    } catch (error) {
      console.error("Failed to get competitor keywords:", error);
      return [];
    }
  }
}
