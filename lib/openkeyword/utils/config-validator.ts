/**
 * ABOUTME: Configuration validation for OpenKeyword
 * ABOUTME: Validates API keys and environment setup
 *
 * TypeScript port of openkeywords/config_validator.py
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config: {
    gemini_api_key: boolean;
    dataforseo_login?: boolean;
    dataforseo_password?: boolean;
    se_ranking_api_key?: boolean;
  };
}

/**
 * Configuration validator.
 *
 * Checks that all required API keys are set and working.
 */
export class ConfigValidator {
  /**
   * Validate all configuration
   */
  static async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const config = {
      gemini_api_key: false,
      dataforseo_login: false,
      dataforseo_password: false,
      se_ranking_api_key: false,
    };

    // 1. Check Gemini API key (REQUIRED)
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      errors.push("GEMINI_API_KEY not set (REQUIRED)");
    } else {
      config.gemini_api_key = true;

      // Test Gemini API
      try {
        await this.testGeminiAPI(geminiKey);
      } catch (error) {
        errors.push(
          `Gemini API key invalid or quota exceeded: ${error instanceof Error ? error.message : String(error)}`
        );
        config.gemini_api_key = false;
      }
    }

    // 2. Check DataForSEO credentials (OPTIONAL)
    const dataforSeoLogin = process.env.DATAFORSEO_LOGIN;
    const dataforSeoPassword = process.env.DATAFORSEO_PASSWORD;

    if (!dataforSeoLogin || !dataforSeoPassword) {
      warnings.push(
        "DataForSEO credentials not set (OPTIONAL - will use Gemini SERP analysis as fallback)"
      );
    } else {
      config.dataforseo_login = true;
      config.dataforseo_password = true;
    }

    // 3. Check SE Ranking API key (OPTIONAL)
    const seRankingKey = process.env.SE_RANKING_API_KEY;
    if (!seRankingKey) {
      warnings.push(
        "SE_RANKING_API_KEY not set (OPTIONAL - competitor gap analysis will be disabled)"
      );
    } else {
      config.se_ranking_api_key = true;
    }

    const valid = errors.length === 0;

    return {
      valid,
      errors,
      warnings,
      config,
    };
  }

  /**
   * Test Gemini API key
   */
  private static async testGeminiAPI(apiKey: string): Promise<void> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
    });

    // Simple test prompt
    const result = await model.generateContent("Say 'OK' if you can read this.");
    const response = result.response;
    const text = response.text();

    if (!text || text.length === 0) {
      throw new Error("Gemini API returned empty response");
    }
  }

  /**
   * Print validation results
   */
  static printResults(result: ValidationResult): void {
    console.log("\n=== OpenKeyword Configuration Validation ===\n");

    if (result.valid) {
      console.log("✅ Configuration is valid!\n");
    } else {
      console.log("❌ Configuration has errors:\n");
    }

    // Print errors
    if (result.errors.length > 0) {
      console.log("ERRORS:");
      for (const error of result.errors) {
        console.log(`  ❌ ${error}`);
      }
      console.log();
    }

    // Print warnings
    if (result.warnings.length > 0) {
      console.log("WARNINGS:");
      for (const warning of result.warnings) {
        console.log(`  ⚠️  ${warning}`);
      }
      console.log();
    }

    // Print config status
    console.log("CONFIGURATION STATUS:");
    console.log(
      `  Gemini API: ${result.config.gemini_api_key ? "✅ Configured" : "❌ Missing"}`
    );
    console.log(
      `  DataForSEO: ${result.config.dataforseo_login ? "✅ Configured" : "⚠️  Not configured"}`
    );
    console.log(
      `  SE Ranking: ${result.config.se_ranking_api_key ? "✅ Configured" : "⚠️  Not configured"}`
    );
    console.log();

    if (result.valid) {
      console.log("✅ Ready to generate keywords!");
    } else {
      console.log(
        "❌ Please fix errors before generating keywords."
      );
      console.log(
        "\nSet environment variables in .env.local:"
      );
      console.log("  GEMINI_API_KEY=your_key_here");
      console.log("  DATAFORSEO_LOGIN=REDACTED (optional)");
      console.log("  DATAFORSEO_PASSWORD=your_password (optional)");
      console.log("  SE_RANKING_API_KEY=your_key (optional)");
    }

    console.log("\n==========================================\n");
  }

  /**
   * Quick check - just verify Gemini API key exists
   */
  static quickCheck(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  /**
   * Get missing required config
   */
  static getMissingRequired(): string[] {
    const missing: string[] = [];

    if (!process.env.GEMINI_API_KEY) {
      missing.push("GEMINI_API_KEY");
    }

    return missing;
  }
}
