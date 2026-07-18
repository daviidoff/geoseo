/**
 * ABOUTME: Standalone DataForSEO client for SERP analysis
 * ABOUTME: Provides featured snippets, PAA, related searches for AEO scoring
 *
 * TypeScript port of openkeywords/dataforseo_client.py
 */

// DataForSEO location codes for common countries
export const LOCATION_CODES: Record<string, number> = {
  us: 2840, // United States
  uk: 2826, // United Kingdom
  gb: 2826, // United Kingdom (alt)
  ca: 2124, // Canada
  au: 2036, // Australia
  de: 2276, // Germany
  fr: 2250, // France
  es: 2724, // Spain
  it: 2380, // Italy
  jp: 2392, // Japan
  br: 2076, // Brazil
  in: 2356, // India
  mx: 2484, // Mexico
  nl: 2528, // Netherlands
  se: 2752, // Sweden
  pl: 2616, // Poland
  ch: 2756, // Switzerland
  at: 2040, // Austria
  be: 2056, // Belgium
  pt: 2620, // Portugal
  dk: 2208, // Denmark
  no: 2578, // Norway
  fi: 2246, // Finland
  ie: 2372, // Ireland
  nz: 2554, // New Zealand
  sg: 2702, // Singapore
  hk: 2344, // Hong Kong
  kr: 2410, // South Korea
  tw: 2158, // Taiwan
  ae: 2784, // UAE
  za: 2710, // South Africa
  ar: 2032, // Argentina
  cl: 2152, // Chile
  co: 2170, // Colombia
};

// ===== Types =====

export interface SearchResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
  displayed_link?: string;
}

export interface SerpResponse {
  success: boolean;
  query: string;
  results: SearchResult[];
  provider?: string;
  cost?: number;
  error?: string;

  // Rich SERP features
  featured_snippet?: {
    title?: string;
    snippet?: string;
    link?: string;
  };
  people_also_ask?: Array<{
    question?: string;
    snippet?: string;
    link?: string;
  }>;
  related_searches?: Array<{
    query?: string;
  }>;

  // Metadata
  total_results?: number;
  timestamp?: string;
}

export interface KeywordData {
  volume: number;
  cpc: number;
  competition: number;
  competition_level: string;
  difficulty: number;
}

// ===== Client =====

/**
 * DataForSEO client for premium SERP data.
 *
 * Provides rich search results including:
 * - Organic results
 * - Featured snippets
 * - People Also Ask
 * - Related searches
 *
 * Cost: $0.50 per 1,000 queries ($0.0005 per query)
 * Latency: ~200-800ms
 *
 * Usage:
 *   const client = new DataForSEOClient(); // Uses env vars
 *   // Or: const client = new DataForSEOClient({ login: "...", password: "..." });
 *
 *   const response = await client.search("what is SEO", { country: "us" });
 *   if (response.success) {
 *     console.log(`Featured snippet: ${response.featured_snippet}`);
 *     console.log(`PAA questions: ${response.people_also_ask?.length}`);
 *   }
 */
export class DataForSEOClient {
  private static readonly BASE_URL =
    "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

  private apiLogin: string;
  private apiPassword: string;
  private costPer1k = 0.5;

  constructor(options?: { login?: string; password?: string }) {
    this.apiLogin =
      options?.login || process.env.DATAFORSEO_LOGIN || "";
    this.apiPassword =
      options?.password || process.env.DATAFORSEO_PASSWORD || "";

    if (this.isConfigured()) {
      console.log("DataForSEO client initialized");
    } else {
      console.warn(
        "DataForSEO not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD " +
          "environment variables, or pass login/password to constructor."
      );
    }
  }

  /**
   * Check if client has valid credentials
   */
  isConfigured(): boolean {
    return Boolean(this.apiLogin && this.apiPassword);
  }

  /**
   * Execute search query through DataForSEO
   */
  async search(
    query: string,
    options: {
      numResults?: number;
      language?: string;
      country?: string;
    } = {}
  ): Promise<SerpResponse> {
    const {
      numResults = 10,
      language = "en",
      country = "us",
    } = options;

    if (!this.isConfigured()) {
      return {
        success: false,
        query,
        results: [],
        error:
          "DataForSEO credentials not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.",
      };
    }

    if (!query) {
      return {
        success: false,
        query,
        results: [],
        error: "Query parameter is required",
      };
    }

    if (query.length > 2048) {
      return {
        success: false,
        query,
        results: [],
        error: "Query too long (max 2048 characters)",
      };
    }

    // Cap at 100 (DataForSEO max)
    const depth = Math.min(numResults, 100);

    try {
      // Create HTTP Basic Auth header
      const credentials = `${this.apiLogin}:${this.apiPassword}`;
      const encodedCredentials = Buffer.from(credentials).toString(
        "base64"
      );
      const authHeader = `Basic ${encodedCredentials}`;

      // Get location code (default to US if unknown)
      const locationCode =
        LOCATION_CODES[country.toLowerCase()] || 2840;

      const response = await fetch(DataForSEOClient.BASE_URL, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            keyword: query,
            location_code: locationCode,
            language_code: language,
            depth,
            calculate_rectangles: false,
          },
        ]),
        signal: AbortSignal.timeout(30000),
      });

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          query,
          results: [],
          error:
            "DataForSEO authentication failed. Check your credentials.",
        };
      } else if (response.status === 400) {
        const text = await response.text();
        return {
          success: false,
          query,
          results: [],
          error: `Invalid request: ${text.slice(0, 200)}`,
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      // DataForSEO returns tasks array
      if (
        !data ||
        !data.tasks ||
        !Array.isArray(data.tasks) ||
        data.tasks.length === 0
      ) {
        return {
          success: false,
          query,
          results: [],
          error: "Invalid response structure from DataForSEO",
        };
      }

      const taskResult = data.tasks[0];
      if (taskResult.status_code !== 20000) {
        const errorMsg =
          taskResult.status_message || "Unknown error";
        return {
          success: false,
          query,
          results: [],
          error: `DataForSEO task failed: ${errorMsg}`,
        };
      }

      const resultData = taskResult.result;
      if (!resultData || !Array.isArray(resultData) || resultData.length === 0) {
        return {
          success: false,
          query,
          results: [],
          error: "No results in DataForSEO response",
        };
      }

      return this.parseResponse(resultData[0], query);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          query,
          results: [],
          error: "DataForSEO request timeout after 30s",
        };
      }

      console.error("DataForSEO error:", error);
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        query,
        results: [],
        error: `DataForSEO error: ${errorMsg}`,
      };
    }
  }

  /**
   * Parse DataForSEO response into standardized format
   */
  private parseResponse(data: any, query: string): SerpResponse {
    const items = data.items || [];
    const results: SearchResult[] = [];
    let featuredSnippet: SerpResponse["featured_snippet"];
    const peopleAlsoAsk: SerpResponse["people_also_ask"] = [];
    const relatedSearches: SerpResponse["related_searches"] = [];

    for (const item of items) {
      const itemType = item.type || "";

      // Organic results
      if (itemType === "organic") {
        results.push({
          position: item.rank_absolute || 0,
          title: item.title || "",
          link: item.url || "",
          snippet: item.description || "",
          displayed_link: item.breadcrumb || "",
        });
      }

      // Featured snippet
      else if (itemType === "featured_snippet" && !featuredSnippet) {
        featuredSnippet = {
          title: item.title,
          snippet: item.description,
          link: item.url,
        };
      }

      // People Also Ask
      else if (itemType === "people_also_ask") {
        const paaItems = item.items || [];
        for (const paa of paaItems) {
          peopleAlsoAsk.push({
            question: paa.title,
            snippet: paa.description,
            link: paa.url,
          });
        }
      }

      // Related searches
      else if (itemType === "related_searches") {
        const rsItems = item.items || [];
        for (const rs of rsItems) {
          if (typeof rs === "string") {
            relatedSearches.push({ query: rs });
          } else if (rs && typeof rs === "object") {
            relatedSearches.push({ query: rs.title });
          }
        }
      }
    }

    // Cost: $0.50 per 1,000 queries = $0.0005 per query
    const cost = 0.0005;

    return {
      success: true,
      query,
      results,
      provider: "dataforseo",
      cost,
      featured_snippet: featuredSnippet,
      people_also_ask: peopleAlsoAsk,
      related_searches: relatedSearches,
      total_results: results.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get search volume, CPC, and competition data for keywords.
   *
   * Uses DataForSEO Keywords Data API.
   * Cost: ~$0.075 per 1000 keywords
   */
  async getKeywordData(
    keywords: string[],
    options: {
      language?: string;
      country?: string;
    } = {}
  ): Promise<Record<string, KeywordData>> {
    const { language = "en", country = "us" } = options;

    if (!this.isConfigured()) {
      console.warn("DataForSEO not configured for keyword data");
      return {};
    }

    if (!keywords || keywords.length === 0) {
      return {};
    }

    // Limit to 1000 keywords per request (API limit)
    const limitedKeywords = keywords.slice(0, 1000);

    try {
      const credentials = `${this.apiLogin}:${this.apiPassword}`;
      const encodedCredentials = Buffer.from(credentials).toString(
        "base64"
      );
      const authHeader = `Basic ${encodedCredentials}`;

      const locationCode =
        LOCATION_CODES[country.toLowerCase()] || 2840;

      const payload = [
        {
          keywords: limitedKeywords,
          location_code: locationCode,
          language_code: language,
        },
      ];

      const response = await fetch(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(60000),
        }
      );

      if (response.status === 401 || response.status === 403) {
        console.error(
          "DataForSEO authentication failed for keyword data"
        );
        return {};
      }

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      // Parse response
      const resultMap: Record<string, KeywordData> = {};

      if (data.tasks && Array.isArray(data.tasks)) {
        for (const task of data.tasks) {
          if (
            task.status_code === 20000 &&
            task.result &&
            Array.isArray(task.result)
          ) {
            for (const item of task.result) {
              const keyword = (item.keyword || "").toLowerCase();
              if (keyword) {
                // Handle competition - can be float or null
                let competition = item.competition;
                if (
                  competition === null ||
                  competition === undefined ||
                  (typeof competition !== "number" &&
                    typeof competition !== "string")
                ) {
                  competition = 0.0;
                }

                // Competition level is a string like "LOW", "MEDIUM", "HIGH"
                const compLevel = item.competition_level || "";

                // Estimate difficulty from competition level string
                const difficultyMap: Record<string, number> = {
                  LOW: 25,
                  MEDIUM: 50,
                  HIGH: 75,
                };
                const difficulty =
                  difficultyMap[
                    String(compLevel).toUpperCase()
                  ] || 50;

                resultMap[keyword] = {
                  volume: item.search_volume || 0,
                  cpc: item.cpc || 0,
                  competition: Number(competition),
                  competition_level: String(compLevel),
                  difficulty,
                };
              }
            }
          }
        }
      }

      console.log(
        `Got keyword data for ${Object.keys(resultMap).length}/${keywords.length} keywords`
      );
      return resultMap;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("DataForSEO keyword data request timeout");
      } else {
        console.error("DataForSEO keyword data error:", error);
      }
      return {};
    }
  }

  /**
   * Get keyword difficulty scores (0-100).
   *
   * Uses DataForSEO Keyword Difficulty API for more accurate scores.
   * Cost: ~$0.05 per keyword
   */
  async getKeywordDifficulty(
    keywords: string[],
    options: {
      language?: string;
      country?: string;
    } = {}
  ): Promise<Record<string, number>> {
    const { language = "en", country = "us" } = options;

    if (!this.isConfigured()) {
      return {};
    }

    if (!keywords || keywords.length === 0) {
      return {};
    }

    const limitedKeywords = keywords.slice(0, 1000);

    try {
      const credentials = `${this.apiLogin}:${this.apiPassword}`;
      const encodedCredentials = Buffer.from(credentials).toString(
        "base64"
      );
      const authHeader = `Basic ${encodedCredentials}`;

      const locationCode =
        LOCATION_CODES[country.toLowerCase()] || 2840;

      // Build batch request - one keyword per task for difficulty
      const payload = limitedKeywords.map((kw) => ({
        keyword: kw,
        location_code: locationCode,
        language_code: language,
      }));

      const response = await fetch(
        "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_difficulty/live",
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(90000),
        }
      );

      if (response.status === 401 || response.status === 403) {
        console.error(
          "DataForSEO authentication failed for keyword difficulty"
        );
        return {};
      }

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      const resultMap: Record<string, number> = {};

      if (data.tasks && Array.isArray(data.tasks)) {
        for (const task of data.tasks) {
          if (
            task.status_code === 20000 &&
            task.result &&
            Array.isArray(task.result)
          ) {
            for (const item of task.result) {
              const keyword = (item.keyword || "").toLowerCase();
              const difficulty = item.keyword_difficulty || 50;
              if (keyword) {
                resultMap[keyword] = difficulty
                  ? parseInt(String(difficulty))
                  : 50;
              }
            }
          }
        }
      }

      console.log(
        `Got difficulty for ${Object.keys(resultMap).length}/${keywords.length} keywords`
      );
      return resultMap;
    } catch (error: unknown) {
      console.error("DataForSEO keyword difficulty error:", error);
      return {};
    }
  }
}

/**
 * Convenience function for single SERP search
 */
export async function searchSerp(
  query: string,
  options: {
    country?: string;
    language?: string;
    login?: string;
    password?: string;
  } = {}
): Promise<SerpResponse> {
  const { country = "us", language = "en", login, password } = options;

  const client = new DataForSEOClient({ login, password });
  return client.search(query, { country, language });
}
