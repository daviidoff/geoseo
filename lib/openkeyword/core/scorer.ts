/**
 * ABOUTME: Company-fit scoring for keywords using Gemini AI
 * ABOUTME: Scores keywords 0-100 based on relevance to company context
 *
 * TypeScript port of openkeywords/scorer.py
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ScoredKeyword {
  keyword: string;
  company_fit_score: number; // 0-100
  relevance_explanation?: string;
  recommended_priority?: "high" | "medium" | "low";
}

export interface ScoringContext {
  companyName: string;
  industry: string;
  products?: string[];
  services?: string[];
  targetAudience?: string;
  valuePropositions?: string[];
  competitors?: string[];
}

/**
 * AI-powered company-fit scoring engine.
 *
 * Analyzes how well each keyword aligns with company context:
 * - Product/service relevance
 * - Target audience match
 * - Business value potential
 * - Intent alignment with goals
 */
export class CompanyFitScorer {
  private apiKey: string;
  private modelName: string;
  private genAI: GoogleGenerativeAI;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY required for company-fit scoring");
    }

    this.modelName = options.model || "gemini-3-flash-preview";
    this.genAI = new GoogleGenerativeAI(this.apiKey);

    console.log(`Company-fit scorer initialized (model: ${this.modelName})`);
  }

  /**
   * Score keywords based on company fit (0-100)
   */
  async scoreKeywords(
    keywords: string[],
    context: ScoringContext
  ): Promise<ScoredKeyword[]> {
    if (!keywords || keywords.length === 0) {
      return [];
    }

    console.log(
      `Scoring ${keywords.length} keywords for company fit (${context.companyName})...`
    );

    // Process in batches of 20 for better performance
    const batchSize = 20;
    const results: ScoredKeyword[] = [];

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      const batchResults = await this.scoreBatch(batch, context);
      results.push(...batchResults);
    }

    console.log(`Scoring complete: ${results.length} keywords scored`);
    return results;
  }

  /**
   * Score a batch of keywords
   */
  private async scoreBatch(
    keywords: string[],
    context: ScoringContext
  ): Promise<ScoredKeyword[]> {
    const prompt = this.buildScoringPrompt(keywords, context);

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("No JSON found in scoring response");
        return this.fallbackScoring(keywords, context);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Normalize and validate scores
      const scored: ScoredKeyword[] = (parsed.scored_keywords || []).map(
        (item: any) => ({
          keyword: item.keyword,
          company_fit_score: Math.min(100, Math.max(0, item.score || item.company_fit_score || 50)),
          relevance_explanation: item.explanation || item.relevance_explanation,
          recommended_priority: this.getPriority(item.score || item.company_fit_score || 50),
        })
      );

      // Ensure all keywords are scored
      const scoredKeywords = new Set(scored.map((s) => s.keyword));
      for (const kw of keywords) {
        if (!scoredKeywords.has(kw)) {
          scored.push({
            keyword: kw,
            company_fit_score: 50,
            recommended_priority: "medium",
          });
        }
      }

      return scored;
    } catch (error) {
      console.error("Scoring failed:", error);
      return this.fallbackScoring(keywords, context);
    }
  }

  /**
   * Build prompt for company-fit scoring
   */
  private buildScoringPrompt(
    keywords: string[],
    context: ScoringContext
  ): string {
    const {
      companyName,
      industry,
      products = [],
      services = [],
      targetAudience,
      valuePropositions = [],
      competitors = [],
    } = context;

    return `You are a keyword relevance expert. Score each keyword from 0-100 based on how well it fits this company's business.

**Company Context:**
- Name: ${companyName}
- Industry: ${industry}
${products.length ? `- Products: ${products.join(", ")}` : ""}
${services.length ? `- Services: ${services.join(", ")}` : ""}
${targetAudience ? `- Target Audience: ${targetAudience}` : ""}
${valuePropositions.length ? `- Value Props: ${valuePropositions.join(", ")}` : ""}
${competitors.length ? `- Competitors: ${competitors.join(", ")}` : ""}

**Keywords to Score:**
${keywords.map((kw, i) => `${i + 1}. ${kw}`).join("\n")}

**Scoring Criteria (0-100):**
- **90-100**: Perfect fit - directly about company's core products/services
- **70-89**: Strong fit - related to offerings, clear business value
- **50-69**: Moderate fit - relevant to industry, indirect business value
- **30-49**: Weak fit - tangentially related, low priority
- **0-29**: Poor fit - unrelated to business goals

**Instructions:**
1. Score each keyword based on company context
2. Consider: product/service relevance, target audience match, business value potential
3. Provide brief explanation for each score
4. Be realistic - not everything scores 90+

**Output JSON:**
{
  "scored_keywords": [
    {
      "keyword": "exact keyword text",
      "score": 85,
      "explanation": "Brief reason for score"
    }
  ]
}`;
  }

  /**
   * Get priority level from score
   */
  private getPriority(score: number): "high" | "medium" | "low" {
    if (score >= 70) return "high";
    if (score >= 50) return "medium";
    return "low";
  }

  /**
   * Fallback scoring when AI fails
   */
  private fallbackScoring(
    keywords: string[],
    context: ScoringContext
  ): ScoredKeyword[] {
    // Simple keyword matching fallback
    const companyTerms = [
      context.companyName.toLowerCase(),
      context.industry.toLowerCase(),
      ...(context.products || []).map((p) => p.toLowerCase()),
      ...(context.services || []).map((s) => s.toLowerCase()),
    ];

    return keywords.map((kw) => {
      const lower = kw.toLowerCase();
      let score = 50; // Default

      // Boost if contains company/product/service terms
      for (const term of companyTerms) {
        if (lower.includes(term)) {
          score += 20;
          break;
        }
      }

      // Boost for high-value intent
      if (lower.includes("buy") || lower.includes("pricing") || lower.includes("vs")) {
        score += 10;
      }

      // Penalty for generic terms
      if (lower.length < 15) {
        score -= 10;
      }

      return {
        keyword: kw,
        company_fit_score: Math.min(100, Math.max(0, score)),
        recommended_priority: this.getPriority(score),
      };
    });
  }
}
