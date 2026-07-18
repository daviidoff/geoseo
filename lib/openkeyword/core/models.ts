/**
 * Data models for OpenKeyword
 *
 * TypeScript port of openkeywords/models.py
 */

// ===== Company Information =====

export interface CompanyInfo {
  /** Company name */
  name: string;
  /** Company website URL */
  url?: string;
  /** Industry category */
  industry?: string;
  /** Company description */
  description?: string;
  /** Services offered */
  services?: string[];
  /** Products offered */
  products?: string[];
  /** Brand names to include */
  brands?: string[];
  /** Target location/region */
  target_location?: string;
  /** Target audience */
  target_audience?: string;
  /** Competitor URLs */
  competitors?: string[];

  // Rich context from company analysis (optional)
  /** Customer pain points and frustrations */
  pain_points?: string[];
  /** Problems the solution addresses */
  customer_problems?: string[];
  /** Real scenarios where product is used */
  use_cases?: string[];
  /** Key value propositions */
  value_propositions?: string[];
  /** What makes them unique vs competitors */
  differentiators?: string[];
  /** Technical capabilities and features */
  key_features?: string[];
  /** Terms describing their approach */
  solution_keywords?: string[];
  /** Brand communication style */
  brand_voice?: string;
}

// ===== Generation Configuration =====

export interface GenerationConfig {
  /** Target number of keywords */
  target_count?: number;
  /** Minimum company-fit score to include */
  min_score?: number;
  /** Group keywords into clusters */
  enable_clustering?: boolean;
  /** Target number of clusters */
  cluster_count?: number;
  /** Target language (any language) */
  language?: string;
  /** Target region/country code */
  region?: string;
  /** Enable deep research (Reddit, Quora, forums) for hyper-niche keywords */
  enable_research?: boolean;
  /** Agency mode: 70% research keywords, strict filtering of broad terms */
  research_focus?: boolean;
  /** Minimum word count for keywords (use 4+ for hyper-niche) */
  min_word_count?: number;
  /** Enable SERP analysis for AEO opportunity scoring (uses DataForSEO) */
  enable_serp_analysis?: boolean;
  /** Number of top keywords to analyze for SERP features */
  serp_sample_size?: number;
  /** Get real search volumes from DataForSEO Keywords Data API */
  enable_volume_lookup?: boolean;
}

/** Default configuration values */
export const DEFAULT_CONFIG: Required<GenerationConfig> = {
  target_count: 50,
  min_score: 40,
  enable_clustering: true,
  cluster_count: 6,
  language: "english",
  region: "us",
  enable_research: false,
  research_focus: false,
  min_word_count: 2,
  enable_serp_analysis: false,
  serp_sample_size: 15,
  enable_volume_lookup: false,
};

// ===== Keyword Types =====

/** Search intent types */
export type SearchIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "question"
  | "comparison";

/** Keyword source types */
export type KeywordSource =
  | "ai_generated"
  | "gap_analysis"
  | "research_reddit"
  | "research_quora"
  | "research_niche"
  | "serp_paa"
  | "hyper_niche_question"
  | "hyper_niche_longtail"
  | "hyper_niche_transactional"
  | "research";

export interface Keyword {
  /** The keyword text */
  keyword: string;
  /** Search intent */
  intent: SearchIntent;
  /** Company-fit score (0-100) */
  score: number;
  /** Semantic cluster name */
  cluster_name?: string;
  /** Is this a question keyword? */
  is_question: boolean;
  /** Monthly search volume (from SE Ranking) */
  volume: number;
  /** SEO difficulty score (from SE Ranking) */
  difficulty: number;
  /** Keyword source */
  source: KeywordSource;

  // AEO/SERP features
  /** AEO opportunity score (0-100) */
  aeo_opportunity: number;
  /** SERP has featured snippet */
  has_featured_snippet: boolean;
  /** SERP has People Also Ask */
  has_paa: boolean;
  /** Whether SERP was analyzed */
  serp_analyzed: boolean;
}

// ===== Cluster =====

export interface Cluster {
  /** Cluster name */
  name: string;
  /** Keywords in this cluster */
  keywords: string[];
}

export function getClusterCount(cluster: Cluster): number {
  return cluster.keywords.length;
}

// ===== Statistics =====

export interface KeywordStatistics {
  /** Total keywords generated */
  total: number;
  /** Average company-fit score */
  avg_score: number;
  /** Count by intent type */
  intent_breakdown: Record<string, number>;
  /** Count by word length category */
  word_length_distribution: Record<string, number>;
  /** Count by source (ai_generated, gap_analysis, research) */
  source_breakdown: Record<string, number>;
  /** Duplicates removed */
  duplicate_count: number;
}

// ===== Generation Result =====

export interface GenerationResult {
  keywords: Keyword[];
  clusters: Cluster[];
  statistics: KeywordStatistics;
  processing_time_seconds: number;
}

// ===== Export/Convert Helpers =====

/**
 * Convert GenerationResult to CSV format
 */
export function toCSV(result: GenerationResult): string {
  const headers = [
    "keyword",
    "intent",
    "score",
    "cluster",
    "is_question",
    "volume",
    "difficulty",
    "source",
    "aeo_opportunity",
    "has_featured_snippet",
    "has_paa",
  ];

  const rows = result.keywords.map((kw) => [
    kw.keyword,
    kw.intent,
    kw.score.toString(),
    kw.cluster_name || "",
    kw.is_question.toString(),
    kw.volume.toString(),
    kw.difficulty.toString(),
    kw.source,
    kw.aeo_opportunity.toString(),
    kw.has_featured_snippet.toString(),
    kw.has_paa.toString(),
  ]);

  return [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");
}

/**
 * Convert GenerationResult to JSON
 */
export function toJSON(result: GenerationResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Convert GenerationResult to plain object
 */
export function toDict(result: GenerationResult): Record<string, unknown> {
  return JSON.parse(JSON.stringify(result));
}
