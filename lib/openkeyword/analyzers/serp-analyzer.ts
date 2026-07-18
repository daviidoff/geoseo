/**
 * ABOUTME: SERP analysis for AEO prioritization using standalone DataForSEO client
 * ABOUTME: Detects featured snippets, PAA questions, competition levels for agency-level output
 *
 * TypeScript port of openkeywords/serp_analyzer.py
 */

import { DataForSEOClient, SerpResponse } from "../clients/dataforseo-client";

// ===== Types =====

export interface SerpFeatures {
  has_featured_snippet: boolean;
  featured_snippet_text?: string;
  featured_snippet_url?: string;

  has_paa: boolean;
  paa_questions: string[];

  related_searches: string[];

  // Competition indicators
  organic_results_count: number;
  top_domains: string[];

  // AEO opportunity score (0-100)
  aeo_opportunity: number;
  aeo_reason: string;

  // Search volume estimate
  volume_estimate?: number | string;
  volume_reasoning?: string;
}

export interface SerpAnalysis {
  keyword: string;
  features: SerpFeatures;
  error?: string;

  // Bonus keywords discovered from SERP
  bonus_keywords: string[];
}

// ===== Analyzer =====

/**
 * Analyze SERPs for AEO opportunities using DataForSEO.
 *
 * This provides agency-level SERP analysis:
 * - Featured snippet detection (high AEO value)
 * - PAA question extraction (bonus keywords)
 * - Related search discovery
 * - Competition analysis
 * - AEO opportunity scoring
 *
 * Usage:
 *   const analyzer = new SerpAnalyzer(); // Uses DATAFORSEO_LOGIN/PASSWORD env vars
 *   const [analyses, bonusKeywords] = await analyzer.analyzeKeywords(["what is SEO"]);
 *
 *   for (const [kw, analysis] of Object.entries(analyses)) {
 *     console.log(`${kw}: AEO Score ${analysis.features.aeo_opportunity}`);
 *   }
 */
export class SerpAnalyzer {
  private dataforseoLogin?: string;
  private dataforseoPassword?: string;
  private maxConcurrent: number;
  private language: string;
  private country: string;
  private client?: DataForSEOClient;

  constructor(options: {
    dataforseoLogin?: string;
    dataforseoPassword?: string;
    maxConcurrent?: number;
    language?: string;
    country?: string;
  } = {}) {
    this.dataforseoLogin =
      options.dataforseoLogin || process.env.DATAFORSEO_LOGIN;
    this.dataforseoPassword =
      options.dataforseoPassword || process.env.DATAFORSEO_PASSWORD;
    this.maxConcurrent = options.maxConcurrent || 5;
    this.language = options.language || "en";
    this.country = options.country || "us";

    if (this.isConfigured()) {
      console.log(
        `SERP Analyzer initialized with DataForSEO (lang=${this.language}, country=${this.country})`
      );
    } else {
      console.warn(
        "SERP Analyzer: DataForSEO not configured. " +
          "Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables."
      );
    }
  }

  /**
   * Check if DataForSEO credentials are configured
   */
  isConfigured(): boolean {
    return Boolean(this.dataforseoLogin && this.dataforseoPassword);
  }

  /**
   * Get or create DataForSEO client
   */
  private getClient(): DataForSEOClient {
    if (!this.client) {
      this.client = new DataForSEOClient({
        login: this.dataforseoLogin,
        password: this.dataforseoPassword,
      });
    }
    return this.client;
  }

  /**
   * Analyze multiple keywords for SERP features
   */
  async analyzeKeywords(
    keywords: string[],
    extractBonus = true
  ): Promise<[Record<string, SerpAnalysis>, string[]]> {
    if (!keywords || keywords.length === 0) {
      return [{}, []];
    }

    if (!this.isConfigured()) {
      console.warn(
        "DataForSEO not configured - returning empty SERP analysis"
      );
      const emptyAnalyses: Record<string, SerpAnalysis> = {};
      for (const kw of keywords) {
        emptyAnalyses[kw] = {
          keyword: kw,
          features: this.createEmptyFeatures(),
          error: "DataForSEO not configured",
          bonus_keywords: [],
        };
      }
      return [emptyAnalyses, []];
    }

    console.log(`Analyzing SERP for ${keywords.length} keywords...`);

    // Run analyses with concurrency limit
    const analyses: Record<string, SerpAnalysis> = {};
    const allBonusKeywords = new Set<string>();

    // Process in batches to respect concurrency limit
    for (let i = 0; i < keywords.length; i += this.maxConcurrent) {
      const batch = keywords.slice(i, i + this.maxConcurrent);
      const batchResults = await Promise.allSettled(
        batch.map((kw) => this.analyzeSingle(kw))
      );

      for (let j = 0; j < batch.length; j++) {
        const kw = batch[j];
        const result = batchResults[j];

        if (result.status === "fulfilled") {
          analyses[kw] = result.value;
          if (extractBonus) {
            result.value.bonus_keywords.forEach((b) =>
              allBonusKeywords.add(b)
            );
          }
        } else {
          console.error(`SERP analysis failed for '${kw}':`, result.reason);
          analyses[kw] = {
            keyword: kw,
            features: this.createEmptyFeatures(),
            error: String(result.reason),
            bonus_keywords: [],
          };
        }
      }
    }

    // Remove original keywords from bonus
    const bonusList = Array.from(allBonusKeywords).filter(
      (b) => !keywords.some((k) => k.toLowerCase() === b.toLowerCase())
    );

    console.log(
      `SERP analysis complete. Found ${bonusList.length} bonus keywords from PAA/related`
    );

    return [analyses, bonusList];
  }

  /**
   * Analyze SERP for a single keyword
   */
  private async analyzeSingle(keyword: string): Promise<SerpAnalysis> {
    try {
      const client = this.getClient();
      const response = await client.search(keyword, {
        numResults: 10,
        language: this.language,
        country: this.country,
      });

      if (!response.success) {
        return {
          keyword,
          features: this.createEmptyFeatures(),
          error: response.error || "SERP search failed",
          bonus_keywords: [],
        };
      }

      return this.parseSerpResponse(keyword, response);
    } catch (error: unknown) {
      console.error(`SERP analysis error for '${keyword}':`, error);
      return {
        keyword,
        features: this.createEmptyFeatures(),
        error: error instanceof Error ? error.message : String(error),
        bonus_keywords: [],
      };
    }
  }

  /**
   * Parse DataForSEO response into analysis
   */
  private parseSerpResponse(
    keyword: string,
    response: SerpResponse
  ): SerpAnalysis {
    const features: SerpFeatures = {
      has_featured_snippet: false,
      featured_snippet_text: undefined,
      featured_snippet_url: undefined,
      has_paa: false,
      paa_questions: [],
      related_searches: [],
      organic_results_count: 0,
      top_domains: [],
      aeo_opportunity: 0,
      aeo_reason: "",
    };
    const bonusKeywords: string[] = [];

    // Featured snippet
    if (response.featured_snippet) {
      features.has_featured_snippet = true;
      features.featured_snippet_text =
        response.featured_snippet.snippet || undefined;
      features.featured_snippet_url =
        response.featured_snippet.link || undefined;
    }

    // People Also Ask
    if (response.people_also_ask && response.people_also_ask.length > 0) {
      features.has_paa = true;
      features.paa_questions = response.people_also_ask
        .map((q) => q.question)
        .filter((q): q is string => Boolean(q));
      // PAA questions are excellent bonus keywords
      bonusKeywords.push(...features.paa_questions);
    } else {
      features.has_paa = false;
    }

    // Related searches
    if (response.related_searches && response.related_searches.length > 0) {
      features.related_searches = response.related_searches
        .map((r) => r.query)
        .filter((q): q is string => Boolean(q));
      bonusKeywords.push(...features.related_searches);
    }

    // Organic results analysis
    features.organic_results_count = response.results.length;

    // Extract top domains for competition analysis
    const topDomains: string[] = [];
    for (const r of response.results.slice(0, 5)) {
      const link = r.link;
      if (link) {
        try {
          const url = new URL(link);
          const domain = url.hostname.replace("www.", "");
          if (domain) {
            topDomains.push(domain);
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }
    features.top_domains = topDomains;

    // Calculate AEO opportunity score
    const [aeoScore, aeoReason] = this.calculateAeoOpportunity(
      keyword,
      features
    );
    features.aeo_opportunity = aeoScore;
    features.aeo_reason = aeoReason;

    return {
      keyword,
      features,
      bonus_keywords: bonusKeywords.filter((b) => Boolean(b)),
    };
  }

  /**
   * Calculate AEO opportunity score (0-100)
   */
  private calculateAeoOpportunity(
    keyword: string,
    features: SerpFeatures
  ): [number, string] {
    let score = 50; // Base score
    const reasons: string[] = [];

    // Featured snippet already exists = opportunity to take it
    if (features.has_featured_snippet) {
      score += 25;
      reasons.push("Has featured snippet (can be captured)");
    }

    // PAA = Google wants Q&A content
    if (features.has_paa) {
      score += 15;
      reasons.push("Has PAA section");
      if (features.paa_questions.length >= 4) {
        score += 5;
        reasons.push("Rich PAA (4+ questions)");
      }
    }

    // Question keyword = higher AEO value
    const questionWords = [
      "how",
      "what",
      "why",
      "when",
      "where",
      "who",
      "which",
      "can",
      "does",
      "is",
    ];
    if (
      questionWords.some((w) => keyword.toLowerCase().startsWith(w))
    ) {
      score += 10;
      reasons.push("Question keyword");
    }

    // Competition analysis
    const bigPlayers = [
      "wikipedia",
      "amazon",
      "youtube",
      "facebook",
      "linkedin",
      "reddit",
      "quora",
    ];
    const bigPlayerCount = features.top_domains.filter((d) =>
      bigPlayers.some((bp) => d.includes(bp))
    ).length;

    if (bigPlayerCount === 0) {
      score += 10;
      reasons.push("No major sites in top 5");
    } else if (bigPlayerCount >= 3) {
      score -= 15;
      reasons.push("High competition (3+ major sites)");
    }

    // Cap score
    score = Math.max(0, Math.min(100, score));

    const reasonStr = reasons.length > 0 ? reasons.join("; ") : "Average opportunity";

    return [score, reasonStr];
  }

  /**
   * Create empty features object
   */
  private createEmptyFeatures(): SerpFeatures {
    return {
      has_featured_snippet: false,
      featured_snippet_text: undefined,
      featured_snippet_url: undefined,
      has_paa: false,
      paa_questions: [],
      related_searches: [],
      organic_results_count: 0,
      top_domains: [],
      aeo_opportunity: 0,
      aeo_reason: "",
    };
  }
}

/**
 * Convenience function to analyze keywords for AEO opportunity
 */
export async function analyzeForAeo(
  keywords: string[],
  options: {
    language?: string;
    country?: string;
    dataforseoLogin?: string;
    dataforseoPassword?: string;
  } = {}
): Promise<[Record<string, SerpAnalysis>, string[]]> {
  const analyzer = new SerpAnalyzer({
    dataforseoLogin: options.dataforseoLogin,
    dataforseoPassword: options.dataforseoPassword,
    language: options.language || "en",
    country: options.country || "us",
  });
  return analyzer.analyzeKeywords(keywords);
}
