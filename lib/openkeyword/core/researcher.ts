/**
 * Deep Research Engine - Find hyper-niche keywords from real user discussions.
 *
 * Uses Google Search grounding to find:
 * - Reddit discussions (pain points, questions, terminology)
 * - Quora questions (real user language)
 * - Forum posts (niche communities)
 * - People Also Ask (Google PAA)
 * - Blog comments and reviews
 *
 * This finds keywords that AI alone would never generate.
 *
 * TypeScript port of openkeywords/researcher.py
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// Community sources to prioritize for keyword discovery
const RESEARCH_SOURCES = [
  "site:reddit.com",
  "site:quora.com",
  "people also ask",
  "forum",
  "community",
];

export interface ResearchKeyword {
  keyword: string;
  intent: string;
  source: string;
  context?: string;
  is_question: boolean;
  score: number;
}

/**
 * Deep research engine using Google Search grounding.
 *
 * Discovers hyper-niche, long-tail keywords and questions from:
 * - Reddit (authentic user discussions)
 * - Quora (real questions people ask)
 * - Forums (niche communities)
 * - People Also Ask (Google suggestions)
 *
 * Uses Gemini with Google Search tool for grounded research.
 */
export class ResearchEngine {
  private apiKey: string;
  private modelName: string;
  private genAI: GoogleGenerativeAI;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
    if (!this.apiKey) {
      throw new Error(
        "API key required. Set GEMINI_API_KEY env var or pass apiKey option."
      );
    }

    this.modelName = options.model || "gemini-3-flash-preview";
    this.genAI = new GoogleGenerativeAI(this.apiKey);

    console.log(
      `Research engine initialized with Gemini (model: ${this.modelName})`
    );
  }

  /**
   * Discover hyper-niche keywords through deep research.
   *
   * Searches Reddit, Quora, forums for real user language.
   */
  async discoverKeywords(options: {
    companyName: string;
    industry: string;
    services: string[];
    products?: string[];
    targetLocation?: string;
    language?: string;
    targetCount?: number;
  }): Promise<ResearchKeyword[]> {
    const {
      companyName,
      industry,
      services,
      products = [],
      targetLocation = "United States",
      language = "english",
      targetCount = 30,
    } = options;

    const allKeywords: ResearchKeyword[] = [];

    // Over-generate from each source to account for deduplication
    // Each source gets 50% of target, so total raw is ~150% before dedup
    const perSource = Math.max(Math.floor(targetCount / 2), 15);

    // Research tasks in parallel
    const [redditResults, questionResults, nicheResults] =
      await Promise.allSettled([
        this.researchReddit(industry, services, language, perSource),
        this.researchQuestions(industry, services, language, perSource),
        this.researchNicheTerms(
          industry,
          services,
          products,
          language,
          perSource
        ),
      ]);

    // Collect results
    for (const result of [redditResults, questionResults, nicheResults]) {
      if (result.status === "fulfilled") {
        allKeywords.push(...result.value);
      } else {
        console.error("Research task failed:", result.reason);
      }
    }

    console.log(`Deep research found ${allKeywords.length} raw keywords`);

    // Deduplicate
    const seen = new Set<string>();
    const unique: ResearchKeyword[] = [];
    for (const kw of allKeywords) {
      const text = kw.keyword.toLowerCase().trim();
      if (text && !seen.has(text)) {
        seen.add(text);
        unique.push(kw);
      }
    }

    console.log(
      `After dedup: ${unique.length} unique keywords from research`
    );
    return unique;
  }

  /**
   * Search Reddit for real user keywords and questions
   */
  private async researchReddit(
    industry: string,
    services: string[],
    language: string,
    targetCount: number
  ): Promise<ResearchKeyword[]> {
    const servicesStr =
      services.length > 0 ? services.slice(0, 3).join(", ") : industry;

    // Get current date
    const currentDate = new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const currentYear = new Date().getFullYear();

    const prompt = `Today's date: ${currentDate}

You are a keyword researcher. Search Reddit for REAL discussions about ${industry}.

Search for: "${industry} site:reddit.com" and "${servicesStr} site:reddit.com"

Find ${targetCount} unique keywords/phrases that REAL USERS use when discussing:
- Problems they face related to ${servicesStr}
- Questions they ask
- Solutions they're looking for
- Specific terminology and jargon
- Pain points and frustrations
- HYPER-LOCAL queries (city-specific, region-specific, language-specific)

Focus on:
- Long-tail keywords (4-7 words)
- Question-based keywords (how, what, why, can I, should I)
- Problem-based keywords (problem with, issue, help with, struggling with)
- Comparison keywords (vs, versus, alternative to, better than)
- Location-specific keywords (in [city], near me, [region] specific)
- Include current year ${currentYear} for time-sensitive queries

IMPORTANT: Find NICHE keywords that typical AI keyword generators would miss.
Look for the SPECIFIC language and terminology Reddit users actually use.
Include HYPER-LOCAL variations (cities, neighborhoods, regional terms).

Output JSON:
{"keywords": [
  {"keyword": "exact phrase from reddit", "intent": "question|commercial|informational|transactional|comparison", "source": "reddit", "context": "brief context where found"}
]}`;

    return this.executeGroundedResearch(prompt, "reddit");
  }

  /**
   * Search Quora and People Also Ask for real questions
   */
  private async researchQuestions(
    industry: string,
    services: string[],
    language: string,
    targetCount: number
  ): Promise<ResearchKeyword[]> {
    const servicesStr =
      services.length > 0 ? services.slice(0, 3).join(", ") : industry;

    const currentDate = new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const currentYear = new Date().getFullYear();

    const prompt = `Today's date: ${currentDate}

You are a keyword researcher. Search for REAL QUESTIONS people ask about ${industry}.

Search: "${industry} site:quora.com" and "people also ask ${servicesStr}"

Find ${targetCount} unique QUESTION keywords that real users ask about:
- ${servicesStr}
- Problems in ${industry}
- Buying decisions
- Comparisons and alternatives
- HYPER-LOCAL questions (location-specific, market-specific)

Focus on:
- Complete question phrases (how do I, what is the best, why does)
- Specific problem questions (why won't, how to fix, what to do when)
- Decision questions (should I, is it worth, which is better)
- "People Also Ask" style questions
- Location-specific questions (in [city], for [region], [language] speakers)
- Include current year ${currentYear} for time-sensitive questions

These should be REAL questions from Quora, forums, and Google PAA.
Find questions that typical AI generators would miss.
Include HYPER-LOCAL variations (cities, regions, languages).

Output JSON:
{"keywords": [
  {"keyword": "exact question from research", "intent": "question", "source": "quora_paa", "context": "where found"}
]}`;

    return this.executeGroundedResearch(prompt, "quora_paa");
  }

  /**
   * Search for niche terminology and specific use cases
   */
  private async researchNicheTerms(
    industry: string,
    services: string[],
    products: string[],
    language: string,
    targetCount: number
  ): Promise<ResearchKeyword[]> {
    let context = `${industry}, ${services.slice(0, 2).join(", ")}`;
    if (products.length > 0) {
      context += `, ${products.slice(0, 2).join(", ")}`;
    }

    const prompt = `You are a keyword researcher. Search for NICHE terminology in ${industry}.

Search forums, communities, and specialized sites for: "${context}"

Find ${targetCount} unique NICHE keywords including:
- Industry-specific terminology and jargon
- Specific use cases (e.g., "project management for construction companies")
- Role-specific keywords (e.g., "CRM for sales managers")
- Problem-specific keywords (e.g., "inventory management for small retail")
- Feature-specific keywords (e.g., "kanban board software")
- Location or segment specific (e.g., "accounting software for freelancers UK")

Focus on:
- Hyper-specific long-tail keywords (5-8 words)
- Keywords with modifiers (best, free, affordable, enterprise)
- Use-case specific (for startups, for agencies, for remote teams)
- Industry vertical specific

Find the EXACT terminology and phrases professionals use.

Output JSON:
{"keywords": [
  {"keyword": "niche term found", "intent": "commercial|informational|transactional", "source": "niche_research", "context": "context"}
]}`;

    return this.executeGroundedResearch(prompt, "niche_research");
  }

  /**
   * Execute a research prompt with Gemini
   */
  private async executeGroundedResearch(
    prompt: string,
    sourceType: string
  ): Promise<ResearchKeyword[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          responseMimeType: "application/json",
        },
      });

      const response = await result.response;
      const keywords = this.parseKeywordsResponse(response.text());

      console.log(`Research (${sourceType}): found ${keywords.length} keywords`);
      return keywords;
    } catch (error: unknown) {
      console.error(`Research failed for ${sourceType}:`, error);
      return [];
    }
  }

  /**
   * Parse keywords from AI response
   */
  private parseKeywordsResponse(responseText: string): ResearchKeyword[] {
    try {
      let text = responseText.trim();

      // Handle markdown code blocks
      if (text.includes("```json")) {
        text = text.split("```json")[1].split("```")[0].trim();
      } else if (text.includes("```")) {
        text = text.split("```")[1].split("```")[0].trim();
      }

      const data = JSON.parse(text);
      const keywordsData = data.keywords || [];

      // Validate and clean keywords
      const validKeywords: ResearchKeyword[] = [];
      for (const kw of keywordsData) {
        const keywordText = (kw.keyword || "").trim();
        if (!keywordText || keywordText.length < 5) {
          continue;
        }

        // Clean up the keyword - normalize whitespace
        const cleanedKeyword = keywordText.replace(/\s+/g, " ");

        const questionStarts = [
          "how",
          "what",
          "why",
          "when",
          "where",
          "which",
          "who",
          "can",
          "should",
          "is",
          "are",
          "does",
          "do",
        ];

        validKeywords.push({
          keyword: cleanedKeyword,
          intent: kw.intent || "informational",
          source: kw.source || "research",
          context: kw.context || "",
          is_question: questionStarts.some((start) =>
            cleanedKeyword.toLowerCase().startsWith(start)
          ),
          score: 0, // Will be scored later
        });
      }

      return validKeywords;
    } catch (error: unknown) {
      console.error("Failed to parse research response:", error);
      return [];
    }
  }
}
