/**
 * ABOUTME: Semantic keyword clustering using Gemini AI
 * ABOUTME: Groups keywords into topic clusters for better organization
 *
 * TypeScript port of openkeywords/clusterer.py
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface KeywordCluster {
  cluster_name: string;
  keywords: string[];
  keyword_count: number;
  avg_score?: number;
  primary_intent?: string;
}

export interface ClusteringResult {
  clusters: KeywordCluster[];
  unclustered: string[];
  total_clusters: number;
  clustering_quality_score: number;
}

/**
 * Semantic clustering engine using Gemini AI.
 *
 * Groups keywords into topic clusters based on semantic similarity.
 * Uses AI to understand context and relationships between keywords.
 */
export class SemanticClusterer {
  private apiKey: string;
  private modelName: string;
  private genAI: GoogleGenerativeAI;
  private minClusterSize: number;
  private maxClusters: number;

  constructor(options: {
    apiKey?: string;
    model?: string;
    minClusterSize?: number;
    maxClusters?: number;
  } = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY required for semantic clustering");
    }

    this.modelName = options.model || "gemini-3-flash-preview";
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.minClusterSize = options.minClusterSize || 3;
    this.maxClusters = options.maxClusters || 10;

    console.log(
      `Semantic clusterer initialized (model: ${this.modelName}, min_size: ${this.minClusterSize}, max: ${this.maxClusters})`
    );
  }

  /**
   * Cluster keywords into semantic topic groups
   */
  async clusterKeywords(
    keywords: string[],
    companyContext?: {
      name: string;
      industry: string;
      products?: string[];
      services?: string[];
    }
  ): Promise<ClusteringResult> {
    if (!keywords || keywords.length === 0) {
      return {
        clusters: [],
        unclustered: [],
        total_clusters: 0,
        clustering_quality_score: 0,
      };
    }

    if (keywords.length < this.minClusterSize) {
      // Too few keywords to cluster meaningfully
      return {
        clusters: [
          {
            cluster_name: "General Keywords",
            keywords: keywords,
            keyword_count: keywords.length,
          },
        ],
        unclustered: [],
        total_clusters: 1,
        clustering_quality_score: 50,
      };
    }

    console.log(`Clustering ${keywords.length} keywords using Gemini AI...`);

    const prompt = this.buildClusteringPrompt(keywords, companyContext);

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
        console.error("No JSON found in clustering response");
        return this.fallbackClustering(keywords);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize clusters
      const clusters: KeywordCluster[] = (parsed.clusters || [])
        .filter((c: any) => c.keywords && c.keywords.length >= this.minClusterSize)
        .slice(0, this.maxClusters)
        .map((c: any) => ({
          cluster_name: c.cluster_name || c.name || "Unnamed Cluster",
          keywords: c.keywords || [],
          keyword_count: (c.keywords || []).length,
          avg_score: c.avg_score,
          primary_intent: c.primary_intent || c.intent,
        }));

      // Find unclustered keywords
      const clusteredKeywords = new Set(
        clusters.flatMap((c) => c.keywords)
      );
      const unclustered = keywords.filter((kw) => !clusteredKeywords.has(kw));

      const qualityScore = this.calculateQualityScore(
        clusters,
        keywords.length
      );

      console.log(
        `Clustering complete: ${clusters.length} clusters, ${unclustered.length} unclustered, quality: ${qualityScore}`
      );

      return {
        clusters,
        unclustered,
        total_clusters: clusters.length,
        clustering_quality_score: qualityScore,
      };
    } catch (error) {
      console.error("Clustering failed:", error);
      return this.fallbackClustering(keywords);
    }
  }

  /**
   * Build prompt for Gemini to cluster keywords
   */
  private buildClusteringPrompt(
    keywords: string[],
    companyContext?: {
      name: string;
      industry: string;
      products?: string[];
      services?: string[];
    }
  ): string {
    const contextStr = companyContext
      ? `\nCompany: ${companyContext.name}
Industry: ${companyContext.industry}
${companyContext.products?.length ? `Products: ${companyContext.products.join(", ")}` : ""}
${companyContext.services?.length ? `Services: ${companyContext.services.join(", ")}` : ""}`
      : "";

    return `You are a semantic keyword clustering expert. Analyze these keywords and group them into ${this.minClusterSize}-${this.maxClusters} topic-based clusters.
${contextStr}

Keywords to cluster:
${keywords.map((kw, i) => `${i + 1}. ${kw}`).join("\n")}

Instructions:
- Group keywords by SEMANTIC SIMILARITY (topic, intent, user need)
- Each cluster must have at least ${this.minClusterSize} keywords
- Maximum ${this.maxClusters} clusters total
- Give each cluster a clear, descriptive name
- Identify primary intent for each cluster (informational, commercial, transactional, comparison, question)
- Calculate avg_score (0-100) based on keyword quality/relevance

Output JSON format:
{
  "clusters": [
    {
      "cluster_name": "Clear Topic Name",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "primary_intent": "informational|commercial|transactional|comparison|question",
      "avg_score": 85
    }
  ]
}

Focus on creating MEANINGFUL clusters that help understand keyword strategy.`;
  }

  /**
   * Calculate clustering quality score (0-100)
   */
  private calculateQualityScore(
    clusters: KeywordCluster[],
    totalKeywords: number
  ): number {
    if (clusters.length === 0) return 0;

    const clusteredCount = clusters.reduce(
      (sum, c) => sum + c.keyword_count,
      0
    );
    const coverage = (clusteredCount / totalKeywords) * 100;

    // Penalty for too few or too many clusters
    const clusterRatio = clusters.length / Math.max(1, totalKeywords / 5);
    const clusterPenalty =
      clusterRatio < 0.3 || clusterRatio > 2 ? 0.7 : 1.0;

    // Penalty for unbalanced clusters
    const avgSize = clusteredCount / clusters.length;
    const variance =
      clusters.reduce((sum, c) => sum + Math.pow(c.keyword_count - avgSize, 2), 0) /
      clusters.length;
    const balancePenalty = variance > avgSize * 2 ? 0.8 : 1.0;

    return Math.round(coverage * clusterPenalty * balancePenalty);
  }

  /**
   * Fallback clustering when AI fails
   */
  private fallbackClustering(keywords: string[]): ClusteringResult {
    // Simple intent-based fallback
    const intentClusters = new Map<string, string[]>();

    for (const kw of keywords) {
      const lower = kw.toLowerCase();
      let intent = "informational";

      if (
        lower.includes("how") ||
        lower.includes("what") ||
        lower.includes("why") ||
        lower.includes("?")
      ) {
        intent = "question";
      } else if (
        lower.includes("vs") ||
        lower.includes("versus") ||
        lower.includes("alternative")
      ) {
        intent = "comparison";
      } else if (
        lower.includes("buy") ||
        lower.includes("price") ||
        lower.includes("cost")
      ) {
        intent = "commercial";
      }

      if (!intentClusters.has(intent)) {
        intentClusters.set(intent, []);
      }
      intentClusters.get(intent)!.push(kw);
    }

    const clusters: KeywordCluster[] = Array.from(
      intentClusters.entries()
    ).map(([intent, kws]) => ({
      cluster_name: `${intent.charAt(0).toUpperCase() + intent.slice(1)} Keywords`,
      keywords: kws,
      keyword_count: kws.length,
      primary_intent: intent,
    }));

    return {
      clusters,
      unclustered: [],
      total_clusters: clusters.length,
      clustering_quality_score: 60,
    };
  }
}
