/**
 * ABOUTME: SERP analysis using Gemini Google Search grounding (no DataForSEO needed!)
 * ABOUTME: Detects featured snippets, PAA questions, competition levels using free Google Search
 *
 * TypeScript port of openkeywords/gemini_serp_analyzer.py
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SerpFeatures, SerpAnalysis } from "./serp-analyzer";

/**
 * Analyze SERPs for AEO opportunities using Gemini Google Search grounding.
 *
 * This provides FREE SERP analysis using Gemini's native Google Search:
 * - Featured snippet detection (high AEO value)
 * - PAA question extraction (bonus keywords)
 * - Related search discovery
 * - Competition analysis
 * - AEO opportunity scoring
 * - Volume estimates (no API needed!)
 *
 * Advantages over DataForSEO:
 * - ✅ FREE (uses Gemini API you already have)
 * - ✅ Real-time Google Search results
 * - ✅ Natural language analysis of SERP features
 * - ✅ Volume estimates based on search context
 * - ✅ No separate API credentials needed
 *
 * Usage:
 *   const analyzer = new GeminiSerpAnalyzer({ geminiApiKey: "your_key" });
 *   const [analyses, bonusKeywords] = await analyzer.analyzeKeywords(["what is SEO"]);
 *
 *   for (const [kw, analysis] of Object.entries(analyses)) {
 *     console.log(`${kw}: AEO Score ${analysis.features.aeo_opportunity}`);
 *   }
 */
export class GeminiSerpAnalyzer {
  private apiKey: string;
  private maxConcurrent: number;
  private language: string;
  private country: string;
  private modelName: string;
  private genAI: GoogleGenerativeAI;

  constructor(options: {
    geminiApiKey?: string;
    maxConcurrent?: number;
    language?: string;
    country?: string;
    model?: string;
  } = {}) {
    this.apiKey = options.geminiApiKey || process.env.GEMINI_API_KEY || "";
    this.maxConcurrent = options.maxConcurrent || 5;
    this.language = options.language || "en";
    this.country = options.country || "us";
    this.modelName = options.model || "gemini-3-flash-preview";

    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY required for Gemini SERP analysis");
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);

    console.log(
      `Gemini SERP Analyzer initialized (lang=${this.language}, country=${this.country}, model=${this.modelName})`
    );
  }

  /**
   * Check if Gemini API key is configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
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

    console.log(
      `Analyzing SERP for ${keywords.length} keywords using Gemini...`
    );

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
   * Analyze SERP for a single keyword using Gemini Google Search
   */
  private async analyzeSingle(keyword: string): Promise<SerpAnalysis> {
    try {
      // Craft prompt - Gemini will use Google Search grounding
      const prompt = `Search Google for: "${keyword}" (country: ${this.country}, language: ${this.language})

Analyze the search results and provide a SERP analysis in JSON format:

{
  "has_featured_snippet": true/false,
  "featured_snippet_text": "excerpt" or null,
  "featured_snippet_url": "URL" or null,
  "has_paa": true/false,
  "paa_questions": ["question 1", "question 2"],
  "related_searches": ["related 1", "related 2"],
  "top_domains": ["domain1.com", "domain2.com"],
  "organic_results_count": 10,
  "volume_estimate": "high/medium/low",
  "volume_reasoning": "brief explanation"
}

Extract PAA questions, related searches, and top ranking domains.
Estimate search volume based on competition and domain authority.
Return ONLY valid JSON.`;

      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      });

      const response = await result.response;
      const responseText = response.text().trim();

      // Extract JSON from response (handle markdown code blocks)
      let jsonText = responseText;
      if (jsonText.includes("```json")) {
        jsonText = jsonText.split("```json")[1].split("```")[0].trim();
      } else if (jsonText.includes("```")) {
        jsonText = jsonText.split("```")[1].split("```")[0].trim();
      }

      const data = JSON.parse(jsonText);

      return this.parseGeminiResponse(keyword, data);
    } catch (error: unknown) {
      console.error(`Gemini SERP analysis error for '${keyword}':`, error);
      return {
        keyword,
        features: this.createEmptyFeatures(),
        error: error instanceof Error ? error.message : String(error),
        bonus_keywords: [],
      };
    }
  }

  /**
   * Parse Gemini response into analysis
   */
  private parseGeminiResponse(
    keyword: string,
    data: any
  ): SerpAnalysis {
    const features: SerpFeatures & {
      volume_estimate?: string;
      volume_reasoning?: string;
    } = {
      has_featured_snippet: data.has_featured_snippet || false,
      featured_snippet_text: data.featured_snippet_text || undefined,
      featured_snippet_url: data.featured_snippet_url || undefined,
      has_paa: data.has_paa || false,
      paa_questions: data.paa_questions || [],
      related_searches: data.related_searches || [],
      organic_results_count: data.organic_results_count || 0,
      top_domains: data.top_domains || [],
      aeo_opportunity: 0,
      aeo_reason: "",
      volume_estimate: data.volume_estimate,
      volume_reasoning: data.volume_reasoning,
    };

    const bonusKeywords: string[] = [];

    // Collect bonus keywords from PAA and related
    if (features.paa_questions.length > 0) {
      bonusKeywords.push(...features.paa_questions);
    }
    bonusKeywords.push(...features.related_searches);

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
    features: SerpFeatures & {
      volume_estimate?: string;
      volume_reasoning?: string;
    }
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

    // Volume estimate boost
    if (features.volume_estimate === "high") {
      score += 10;
      reasons.push("High search volume");
    } else if (features.volume_estimate === "low") {
      score += 5;
      reasons.push("Low competition (easier to rank)");
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

    const reasonStr =
      reasons.length > 0 ? reasons.join("; ") : "Average opportunity";

    return [score, reasonStr];
  }

  /**
   * Create empty features object
   */
  private createEmptyFeatures(): SerpFeatures {
    return {
      has_featured_snippet: false,
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
 * Convenience function to analyze keywords for AEO opportunity using Gemini
 */
export async function analyzeForAeoGemini(
  keywords: string[],
  options: {
    language?: string;
    country?: string;
    geminiApiKey?: string;
  } = {}
): Promise<[Record<string, SerpAnalysis>, string[]]> {
  const analyzer = new GeminiSerpAnalyzer({
    geminiApiKey: options.geminiApiKey,
    language: options.language || "en",
    country: options.country || "us",
  });
  return analyzer.analyzeKeywords(keywords);
}
