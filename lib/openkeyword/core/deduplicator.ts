/**
 * ABOUTME: Semantic keyword deduplication using Gemini AI
 * ABOUTME: Removes similar/duplicate keywords using AI similarity detection
 *
 * TypeScript port of openkeywords/deduplicator.py
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface DeduplicationResult {
  unique_keywords: string[];
  removed_duplicates: string[];
  duplicate_groups: Array<{
    canonical: string;
    duplicates: string[];
  }>;
  original_count: number;
  final_count: number;
  dedup_rate: number; // % removed
}

/**
 * Semantic deduplication engine using Gemini AI.
 *
 * Two-stage deduplication:
 * 1. Token-based: Remove exact/near-exact matches
 * 2. Semantic AI: Remove semantically similar keywords
 *
 * More sophisticated than simple string matching.
 */
export class SemanticDeduplicator {
  private apiKey: string;
  private modelName: string;
  private genAI: GoogleGenerativeAI;
  private similarityThreshold: number;

  constructor(options: {
    apiKey?: string;
    model?: string;
    similarityThreshold?: number;
  } = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY required for semantic deduplication");
    }

    this.modelName = options.model || "gemini-3-flash-preview";
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.similarityThreshold = options.similarityThreshold || 0.85; // 85% similar = duplicate

    console.log(
      `Semantic deduplicator initialized (model: ${this.modelName}, threshold: ${this.similarityThreshold})`
    );
  }

  /**
   * Deduplicate keywords using two-stage approach
   */
  async deduplicateKeywords(
    keywords: string[]
  ): Promise<DeduplicationResult> {
    if (!keywords || keywords.length === 0) {
      return {
        unique_keywords: [],
        removed_duplicates: [],
        duplicate_groups: [],
        original_count: 0,
        final_count: 0,
        dedup_rate: 0,
      };
    }

    const originalCount = keywords.length;
    console.log(`Deduplicating ${originalCount} keywords...`);

    // Stage 1: Token-based deduplication (fast)
    const { unique: stage1Unique, removed: stage1Removed } =
      this.tokenBasedDedup(keywords);

    console.log(
      `Stage 1 (token-based): ${stage1Unique.length} unique, ${stage1Removed.length} removed`
    );

    // Stage 2: Semantic AI deduplication (slow but thorough)
    const stage2Result = await this.semanticDedup(stage1Unique);

    const allRemoved = [...stage1Removed, ...stage2Result.removed];
    const dedupRate = (allRemoved.length / originalCount) * 100;

    console.log(
      `Deduplication complete: ${stage2Result.unique.length} final keywords (${dedupRate.toFixed(1)}% removed)`
    );

    return {
      unique_keywords: stage2Result.unique,
      removed_duplicates: allRemoved,
      duplicate_groups: stage2Result.groups,
      original_count: originalCount,
      final_count: stage2Result.unique.length,
      dedup_rate: dedupRate,
    };
  }

  /**
   * Stage 1: Fast token-based deduplication
   */
  private tokenBasedDedup(keywords: string[]): {
    unique: string[];
    removed: string[];
  } {
    const seen = new Map<string, string>(); // normalized -> original
    const unique: string[] = [];
    const removed: string[] = [];

    for (const kw of keywords) {
      const normalized = this.normalizeKeyword(kw);

      if (!seen.has(normalized)) {
        seen.set(normalized, kw);
        unique.push(kw);
      } else {
        removed.push(kw);
      }
    }

    return { unique, removed };
  }

  /**
   * Normalize keyword for token-based matching
   */
  private normalizeKeyword(keyword: string): string {
    return keyword
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, "") // Remove punctuation
      .replace(/\s+/g, " ") // Collapse whitespace
      .split(" ")
      .sort() // Sort tokens for order-independence
      .join(" ");
  }

  /**
   * Stage 2: Semantic AI deduplication
   */
  private async semanticDedup(keywords: string[]): Promise<{
    unique: string[];
    removed: string[];
    groups: Array<{ canonical: string; duplicates: string[] }>;
  }> {
    if (keywords.length <= 5) {
      // Too few to deduplicate semantically
      return { unique: keywords, removed: [], groups: [] };
    }

    // Process in batches of 30 for better performance
    const batchSize = 30;
    const allGroups: Array<{ canonical: string; duplicates: string[] }> = [];
    let remaining = [...keywords];

    for (let i = 0; i < remaining.length; i += batchSize) {
      const batch = remaining.slice(i, Math.min(i + batchSize, remaining.length));
      if (batch.length < 2) break;

      const batchGroups = await this.findDuplicatesBatch(batch);
      allGroups.push(...batchGroups);

      // Remove duplicates from remaining
      const duplicates = new Set(batchGroups.flatMap((g) => g.duplicates));
      remaining = remaining.filter((kw) => !duplicates.has(kw));
    }

    const removed = allGroups.flatMap((g) => g.duplicates);
    const unique = keywords.filter((kw) => !removed.includes(kw));

    return { unique, removed, groups: allGroups };
  }

  /**
   * Find semantic duplicates in a batch using Gemini
   */
  private async findDuplicatesBatch(
    keywords: string[]
  ): Promise<Array<{ canonical: string; duplicates: string[] }>> {
    const prompt = `You are a keyword deduplication expert. Find semantically similar/duplicate keywords in this list.

**Keywords:**
${keywords.map((kw, i) => `${i + 1}. ${kw}`).join("\n")}

**Instructions:**
- Identify keywords that mean THE SAME THING (semantic duplicates)
- Group duplicates together with their canonical (best) version
- Similarity threshold: ${this.similarityThreshold * 100}% (only mark as duplicates if VERY similar)
- Keep keywords that are RELATED but NOT DUPLICATES

**Examples of duplicates:**
- "best marketing software" and "top marketing tools" → duplicates
- "how to do SEO" and "how do I do SEO" → duplicates
- "marketing automation" and "marketing automation tools" → KEEP BOTH (different specificity)

**Output JSON:**
{
  "duplicate_groups": [
    {
      "canonical": "best keyword to keep",
      "duplicates": ["similar keyword 1", "similar keyword 2"]
    }
  ]
}

If no duplicates found, return empty array.`;

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
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.duplicate_groups || []).filter(
        (g: any) => g.canonical && g.duplicates && g.duplicates.length > 0
      );
    } catch (error) {
      console.error("Semantic deduplication failed for batch:", error);
      return [];
    }
  }
}
