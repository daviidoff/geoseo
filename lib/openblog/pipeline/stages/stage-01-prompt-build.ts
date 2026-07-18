/**
 * Stage 1: Simple Prompt Construction
 *
 * ABOUTME: Builds prompts using company context instead of complex market templates
 * ABOUTME: Simple, clean system that focuses on company information only
 *
 * Builds the main article prompt by:
 * 1. Loading company context (name, industry, description, etc.)
 * 2. Injecting company variables into a simple prompt template
 * 3. Adding optional sections (pain points, competitors, guidelines)
 * 4. Validating prompt structure
 * 5. Storing in context for Stage 2
 *
 * This approach is SIMPLE and EFFECTIVE:
 * - Company-focused content generation
 * - All fields optional except company URL
 * - Clean prompt structure without market complexity
 * - Flexible content guidelines and instructions
 *
 * Combined with tools (googleSearch, urlContext), this creates company-appropriate content.
 */

import { Stage } from '../core/workflow-engine';
import { ExecutionContext } from '../core/execution-context';
import {
  CompanyContext,
  companyContextFromDict,
  companyContextToPrompt,
  validateCompanyContext,
} from '../core/company-context';
import {
  buildArticlePrompt,
  validatePromptInputs,
} from '../prompts/simple-article-prompt';

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
  debug: (msg: string) => console.debug(`[DEBUG] ${msg}`),
};

/**
 * Stage 1: Build simple article prompt with company context injection.
 *
 * Builds the complete prompt that will be sent to Gemini using company information.
 * Simple system without market complexity - company context only.
 */
export class PromptBuildStage extends Stage {
  stageNum = 1;
  stageName = 'Simple Prompt Construction';

  async execute(context: ExecutionContext): Promise<ExecutionContext> {
    logger.info(`Stage 1: ${this.stageName}`);

    // Extract primary keyword (required)
    const primaryKeyword = context.job_config.primary_keyword || '';
    if (!primaryKeyword) {
      throw new Error('primary_keyword is required');
    }

    // Extract language (optional, default to English)
    // Priority: job_config.language > company_data.language > "en"
    const companyData = context.company_data || {};
    const language =
      context.job_config.language ||
      companyData.language ||
      companyData.company_language ||
      'en';

    // Extract word count (optional, dynamic)
    const wordCount = context.job_config.word_count;

    // Extract country (optional, for market-specific content)
    const country = context.job_config.country;

    // Extract content generation instruction (optional, custom instructions)
    const contentGenerationInstruction =
      context.job_config.content_generation_instruction;

    // Extract tone override (optional, overrides company_context.tone)
    const toneOverride = context.job_config.tone;

    // Extract system_prompts (batch-level instructions)
    const systemPrompts = context.job_config.system_prompts || [];

    // Convert company_data to CompanyContext
    let companyContext: CompanyContext;
    if (typeof companyData === 'object' && !('companyUrl' in companyData)) {
      // It's a dict, convert it
      companyContext = companyContextFromDict(companyData);
    } else {
      // Already a CompanyContext
      companyContext = companyData as CompanyContext;
    }

    // Validate company context (requires company_url)
    validateCompanyContext(companyContext);

    // Convert to prompt variables
    const promptContext = companyContextToPrompt(companyContext);

    logger.debug(`Keyword: '${primaryKeyword}'`);
    logger.debug(`Language: ${language}`);
    logger.debug(`Country: ${country || 'Not specified'}`);
    logger.debug(`Word count: ${wordCount || 'Default (1,500-2,500)'}`);
    logger.debug(`Tone override: ${toneOverride || 'Using company tone'}`);
    logger.debug(`System prompts (batch-level): ${systemPrompts.length} items`);
    logger.debug(`Company: ${promptContext.company_name || 'Unknown'}`);
    logger.debug(`Company URL: ${promptContext.company_url || 'Not provided'}`);
    logger.debug(`Industry: ${promptContext.industry || 'Not specified'}`);

    // Validate inputs before building prompt
    validatePromptInputs(primaryKeyword, promptContext);

    // Build the simple prompt
    let prompt: string;
    try {
      prompt = buildArticlePrompt({
        primaryKeyword,
        companyContext: promptContext,
        language,
        wordCount,
        country,
        contentGenerationInstruction,
        toneOverride,
        systemPrompts,
      });
    } catch (e) {
      const error = e as Error;
      logger.error(`Failed to build prompt: ${error.message}`);
      throw new Error(`Unable to generate prompt: ${error.message}`);
    }

    // Validate generated prompt
    if (!prompt || prompt.trim().length < 500) {
      throw new Error(
        `Generated prompt is too short (${prompt.length} chars, expected > 500)`
      );
    }

    logger.info('✅ Simple prompt generated successfully');
    logger.info(`   Length: ${prompt.length} characters`);
    logger.info(`   Language: ${language}`);
    logger.info(`   Keyword: '${primaryKeyword}'`);
    logger.info(`   Company: '${promptContext.company_name || 'Unknown'}'`);

    // Store in context
    context.prompt = prompt;
    (context as any).companyContext = companyContext;
    context.language = language;

    return context;
  }

  /**
   * Basic prompt validation.
   */
  private validatePrompt(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt is empty');
    }

    if (prompt.length < 500) {
      throw new Error(
        `Prompt too short (${prompt.length} chars, expected > 500)`
      );
    }

    // Check for basic content
    if (
      !prompt.includes('Write a comprehensive') &&
      !prompt.toLowerCase().includes('write')
    ) {
      throw new Error("Prompt doesn't appear to contain writing instructions");
    }
  }
}
