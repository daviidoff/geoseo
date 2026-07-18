/**
 * ABOUTME: AI platform configurations for AEO mentions check - defines model configs, search capabilities, and tool requirements for Perplexity, Claude, ChatGPT, and Gemini
 * ABOUTME: Migrated from Python openanalytics/aeo-checks/mentions_service.py AI_PLATFORMS config
 */

export interface PlatformConfig {
  model: string;
  has_search: boolean;
  needs_tool: boolean;
  provider: string | null;
}

/**
 * AI Platforms with search capabilities
 * All platforms use google_search tool which routes to DataForSEO SERP
 */
export const AI_PLATFORMS: Record<string, PlatformConfig> = {
  perplexity: {
    model: 'perplexity/sonar-pro',
    has_search: true,
    needs_tool: false, // Perplexity has native web search
    provider: null,
  },
  claude: {
    model: 'anthropic/claude-3.5-sonnet',
    has_search: true,
    needs_tool: true, // Uses google_search tool → DataForSEO
    provider: null,
  },
  chatgpt: {
    model: 'openai/gpt-4.1',
    has_search: true,
    needs_tool: true, // Uses google_search tool → DataForSEO
    provider: 'openai', // Force OpenAI provider
  },
  gemini: {
    model: 'google/gemini-3-flash-preview', // Use gemini-3-flash-preview as specified
    has_search: true,
    needs_tool: true, // Uses google_search tool → DataForSEO
    provider: null,
  },
};

/**
 * Get platform config by name
 */
export function getPlatformConfig(platformName: string): PlatformConfig | null {
  return AI_PLATFORMS[platformName] || null;
}

/**
 * Get all platform names
 */
export function getAllPlatformNames(): string[] {
  return Object.keys(AI_PLATFORMS);
}

/**
 * Get platforms for fast mode (Gemini + ChatGPT only)
 */
export function getFastModePlatforms(): string[] {
  return ['gemini', 'chatgpt'];
}

/**
 * Get platforms for full mode (all 4 platforms)
 */
export function getFullModePlatforms(): string[] {
  return getAllPlatformNames();
}
