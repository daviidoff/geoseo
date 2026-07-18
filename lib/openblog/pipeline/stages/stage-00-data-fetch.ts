/**
 * Stage 0: Data Fetch & Auto-Detection
 *
 * Maps to v4.1 Phase 1, Steps 1-3:
 * - Step 1: Schedule trigger (entry point)
 * - Step 2: get_supabase_information (or direct input)
 * - Step 3: set_field_names (normalize and validate)
 *
 * New feature: Auto-detection of company information from company_url
 * - Scrape website for metadata
 * - Use Gemini to analyze business info
 * - Fetch sitemap for internal links pool
 *
 * Input:
 *   - job_id: Unique identifier
 *   - primary_keyword: Blog topic/keyword
 *   - company_url: Company website (for auto-detection)
 *   - Optional: company_name, company_location, company_language (overrides)
 *
 * Output:
 *   - ExecutionContext with populated:
 *     - job_config (primary_keyword, content_generation_instruction, etc)
 *     - company_data (auto-detected or overridden)
 *     - language
 *     - blog_page (internal links, keyword, etc)
 */

import { Stage } from '../core/workflow-engine';
import { ExecutionContext } from '../core/execution-context';
import {
  SitemapCrawler,
  SitemapPageList,
  getBlogUrls,
  getUrlsByLabel,
  getLabelSummary,
  count,
} from '../data_sources';

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
  debug: (msg: string) => console.debug(`[DEBUG] ${msg}`),
};

/**
 * Stage 0: Fetch and auto-detect job data.
 *
 * Handles:
 * - Validating required input fields
 * - Auto-detecting company information from website
 * - Applying user overrides
 * - Normalizing field names
 * - Building ExecutionContext
 */
export class DataFetchStage extends Stage {
  stageNum = 0;
  stageName = 'Data Fetch & Auto-Detection';

  async execute(context: ExecutionContext): Promise<ExecutionContext> {
    logger.info(`Stage 0: ${this.stageName}`);
    logger.info(`Job ID: ${context.job_id}`);

    // Step 1: Validate required input
    this.validateInput(context);
    logger.info('✅ Input validation passed');

    // Step 2: Auto-detect company information
    const companyData = await this.autoDetectCompany(
      context.job_config.company_url || ''
    );
    logger.info('✅ Company information auto-detected');

    // Step 2b: Crawl sitemap for internal links
    const sitemapData = await this.crawlCompanySitemap(
      context.job_config.company_url || ''
    );
    if (sitemapData) {
      logger.info(
        `✅ Sitemap crawled: ${sitemapData.total_pages || 0} pages found`
      );
      // Store sitemap data in context
      (context as any).sitemapData = sitemapData;
    } else {
      logger.info('⚠️ No sitemap data found');
    }

    // Step 3: Apply overrides
    const finalCompanyData = this.applyOverrides(companyData, context.job_config);
    logger.info('✅ User overrides applied');

    // Step 4: Build normalized context
    context.company_data = finalCompanyData;

    // Language priority: job_config.language > company_data.company_language > "en"
    context.language =
      context.job_config.language ||
      finalCompanyData.company_language ||
      'en';

    context.blog_page = this.buildBlogPage(context, sitemapData);
    context.job_config = this.normalizeJobConfig(context.job_config);

    logger.info('✅ ExecutionContext built');
    logger.info(
      `   Company: ${finalCompanyData.company_name || 'Unknown'}`
    );
    logger.info(`   Language: ${context.language}`);
    logger.info(
      `   Keyword: ${context.job_config.primary_keyword || 'Unknown'}`
    );

    return context;
  }

  /**
   * Validate required input fields.
   */
  private validateInput(context: ExecutionContext): void {
    const requiredFields: Record<string, string> = {
      primary_keyword: 'Blog topic/keyword',
      company_url: 'Company website URL',
    };

    const jobConfig = context.job_config;
    const missing: string[] = [];

    for (const [field, description] of Object.entries(requiredFields)) {
      if (!jobConfig[field]) {
        missing.push(`${field} (${description})`);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required fields:\n  - ${missing.join('\n  - ')}`
      );
    }

    logger.debug(
      `Required fields present: ${Object.keys(requiredFields).join(', ')}`
    );
  }

  /**
   * Auto-detect company information from URL.
   *
   * Operations:
   * 1. Extract domain and company name from URL
   * 2. Scrape website for metadata (language, location)
   * 3. Use Gemini to analyze company (industry, business model)
   * 4. Fetch sitemap for internal links pool
   *
   * Returns:
   *   Dictionary with auto-detected company information
   *
   * Note:
   *   For MVP, return basic info. Full Gemini analysis optional.
   */
  private async autoDetectCompany(
    companyUrl: string
  ): Promise<Record<string, any>> {
    logger.debug(`Auto-detecting company info from: ${companyUrl}`);

    // Extract domain and basic info
    const domain = this.extractDomain(companyUrl);
    const companyName = this.extractCompanyName(domain);

    logger.debug(`Domain: ${domain}`);
    logger.debug(`Company name: ${companyName}`);

    // Build initial company_data
    const companyData: Record<string, any> = {
      company_url: companyUrl,
      company_name: companyName,
      company_language: 'en', // Default to English
      company_location: 'Unknown',
      company_info: {
        description: `Information about ${companyName}`,
        industry: 'Unknown',
        business_model: 'Unknown',
      },
      company_competitors: [],
    };

    logger.debug(`Auto-detected company data: ${JSON.stringify(companyData)}`);
    return companyData;
  }

  /**
   * Extract domain from URL.
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      const domain = parsed.hostname.replace(/^www\./, '');
      if (!domain) {
        throw new Error(`Invalid URL: ${url}`);
      }
      return domain;
    } catch (e) {
      const error = e as Error;
      throw new Error(`Could not parse URL '${url}': ${error.message}`);
    }
  }

  /**
   * Extract company name from domain.
   *
   * Examples:
   * - "acme.com" → "ACME"
   * - "my-company.co.uk" → "My Company"
   * - "example.org" → "Example"
   */
  private extractCompanyName(domain: string): string {
    // Remove TLD
    const name = domain.split('.')[0];

    // Replace hyphens with spaces
    const withSpaces = name.replace(/-/g, ' ');

    // Title case
    const titleCase = withSpaces
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return titleCase;
  }

  /**
   * Crawl company sitemap to extract internal links and site structure.
   */
  private async crawlCompanySitemap(
    companyUrl: string
  ): Promise<Record<string, any> | null> {
    if (!companyUrl) {
      logger.debug('No company_url provided, skipping sitemap crawl');
      return null;
    }

    try {
      logger.debug(`Crawling sitemap for: ${companyUrl}`);

      // Initialize crawler with reasonable limits for blog generation
      const crawler = new SitemapCrawler(
        undefined, // custom patterns
        10000, // timeout: 10s
        3600, // cache_ttl: 1 hour
        500, // max_urls: 500 for performance
        50 // max_cache_size: 50
      );

      // Crawl the sitemap
      const sitemapPages = await crawler.crawl(companyUrl);

      if (!sitemapPages || count(sitemapPages) === 0) {
        logger.debug(`No sitemap URLs found for ${companyUrl}`);
        return null;
      }

      // Extract URLs by type for internal linking (high confidence only)
      const blogUrls = getBlogUrls(sitemapPages, 0.7);
      const resourceUrls = getUrlsByLabel(sitemapPages, 'resource', 0.6);
      const productUrls = getUrlsByLabel(sitemapPages, 'product', 0.6);
      const docsUrls = getUrlsByLabel(sitemapPages, 'docs', 0.6);
      const companyUrls = getUrlsByLabel(sitemapPages, 'company', 0.6);

      // Get page breakdown
      const pageSummary = getLabelSummary(sitemapPages);

      // Build analysis
      const sitemapData: Record<string, any> = {
        total_pages: count(sitemapPages),
        blog_count: blogUrls.length,
        blog_urls: blogUrls.slice(0, 20), // Limit to 20
        resource_urls: resourceUrls.slice(0, 10),
        product_urls: productUrls.slice(0, 8),
        docs_urls: docsUrls.slice(0, 6),
        company_urls: companyUrls.slice(0, 4),
        page_summary: pageSummary,
        fetch_timestamp: sitemapPages.fetchTimestamp,
        site_structure: this.analyzeSiteStructure(sitemapPages),
        // CRITICAL: Include raw sitemap_pages for Stage 5 internal links
        _sitemap_pages_object: sitemapPages,
      };

      logger.info(
        `Sitemap analysis complete: ${sitemapData.total_pages} total pages, ${sitemapData.blog_count} blogs`
      );
      return sitemapData;
    } catch (e) {
      const error = e as Error;
      logger.warn(`Failed to crawl sitemap for ${companyUrl}: ${error.message}`);
      return null;
    }
  }

  /**
   * Analyze site structure from sitemap data for competitive intelligence.
   */
  private analyzeSiteStructure(
    sitemapPages: SitemapPageList
  ): Record<string, any> {
    const pageSummary = getLabelSummary(sitemapPages);
    const totalPages = count(sitemapPages);

    // Calculate content focus percentages
    const contentFocus = {
      content_heavy:
        ((pageSummary.blog + pageSummary.resource) / Math.max(totalPages, 1)) *
        100,
      product_focus: (pageSummary.product / Math.max(totalPages, 1)) * 100,
      service_focus: (pageSummary.service / Math.max(totalPages, 1)) * 100,
      documentation: (pageSummary.docs / Math.max(totalPages, 1)) * 100,
    };

    // Determine site type
    let siteType: string;
    if (contentFocus.content_heavy > 30) {
      siteType = 'content_marketing';
    } else if (contentFocus.product_focus > 40) {
      siteType = 'product_focused';
    } else if (contentFocus.service_focus > 30) {
      siteType = 'service_focused';
    } else {
      siteType = 'corporate';
    }

    return {
      site_type: siteType,
      content_focus: contentFocus,
      has_blog: pageSummary.blog > 0,
      content_volume:
        pageSummary.blog > 20
          ? 'high'
          : pageSummary.blog > 5
            ? 'medium'
            : 'low',
    };
  }

  /**
   * Apply user overrides to auto-detected company data.
   */
  private applyOverrides(
    companyData: Record<string, any>,
    jobConfig: Record<string, any>
  ): Record<string, any> {
    const overrideFields = [
      'company_name',
      'company_location',
      'company_language',
      'company_competitors',
      'content_generation_instruction',
      // Author fields for E-E-A-T scoring
      'author_name',
      'author_bio',
      'author_url',
    ];

    for (const field of overrideFields) {
      if (field in jobConfig && jobConfig[field]) {
        let value = jobConfig[field];

        // Special handling for competitors
        if (field === 'company_competitors' && Array.isArray(value)) {
          value = this.normalizeCompetitorsList(value);
        }

        companyData[field] = value;
        logger.debug(`Override ${field}: ${value}`);
      }
    }

    // Also check for author fields inside job_config["company_data"]
    if (
      jobConfig.company_data &&
      typeof jobConfig.company_data === 'object'
    ) {
      const nestedCompanyData = jobConfig.company_data;
      const authorFields = ['author_name', 'author_bio', 'author_url'];

      for (const field of authorFields) {
        if (field in nestedCompanyData && nestedCompanyData[field]) {
          companyData[field] = nestedCompanyData[field];
          logger.debug(
            `Override ${field} from company_data: ${nestedCompanyData[field]}`
          );
        }
      }

      // Also handle competitors from nested company_data
      if ('competitors' in nestedCompanyData) {
        let competitors = nestedCompanyData.competitors;
        if (Array.isArray(competitors)) {
          competitors = this.normalizeCompetitorsList(competitors);
        }
        companyData.company_competitors = competitors;
        logger.debug(
          `Override company_competitors from company_data: ${competitors}`
        );
      }
    }

    return companyData;
  }

  /**
   * Normalize competitors list to handle both formats.
   */
  private normalizeCompetitorsList(competitors: any[]): string[] {
    if (!competitors) {
      return [];
    }

    const normalized: string[] = [];

    for (const item of competitors) {
      if (typeof item === 'string') {
        // Check if it's a comma-separated string
        if (item.includes(',')) {
          const splitItems = item
            .split(',')
            .map((comp) => comp.trim())
            .filter((comp) => comp);
          normalized.push(...splitItems);
        } else {
          normalized.push(item.trim());
        }
      } else if (Array.isArray(item)) {
        // Nested list (shouldn't happen, but handle it)
        normalized.push(...this.normalizeCompetitorsList(item));
      }
    }

    // Remove duplicates while preserving order
    const seen = new Set<string>();
    const result: string[] = [];

    for (const comp of normalized) {
      const lower = comp.toLowerCase();
      if (comp && !seen.has(lower)) {
        seen.add(lower);
        result.push(comp);
      }
    }

    return result;
  }

  /**
   * Build blog_page configuration with enhanced sitemap integration.
   */
  private buildBlogPage(
    context: ExecutionContext,
    sitemapData: Record<string, any> | null
  ): Record<string, any> {
    const jobConfig = context.job_config;

    // Build internal links with priority: user provided > sitemap crawled > legacy sitemap_urls
    let providedLinks = jobConfig.links || '';

    if (!providedLinks) {
      // Priority 1: Use crawled sitemap data
      if (sitemapData) {
        const relevantUrls = this.getRelevantInternalLinks(sitemapData);
        if (relevantUrls.length > 0) {
          providedLinks = this.formatSitemapLinks(relevantUrls);
          logger.info(
            `Built ${relevantUrls.length} internal links from sitemap crawl (multiple page types)`
          );
        }
      }

      // Priority 2: Fall back to legacy sitemap_urls + batch_siblings
      if (!providedLinks) {
        const sitemapUrls = Array.from(jobConfig.sitemap_urls || []) as string[];
        const batchSiblings = jobConfig.batch_siblings || [];

        // Merge batch siblings into URL pool
        if (batchSiblings.length > 0) {
          logger.info(
            `Adding ${batchSiblings.length} batch siblings to link pool for prompt`
          );
          for (const sibling of batchSiblings) {
            const siblingUrl = sibling.slug || '';
            if (siblingUrl && !sitemapUrls.includes(siblingUrl)) {
              sitemapUrls.push(siblingUrl);
            }
          }
        }

        if (sitemapUrls.length > 0) {
          providedLinks = this.formatLegacyLinks(sitemapUrls);
          logger.info(
            `Built ${sitemapUrls.slice(0, 10).length} links from legacy sitemap_urls + batch_siblings`
          );
        }
      }
    }

    return {
      primary_keyword: jobConfig.primary_keyword || '',
      links: providedLinks,
      image_url: jobConfig.image_url, // Optional: pre-generated image
    };
  }

  /**
   * Get relevant internal links from sitemap data across multiple page types.
   */
  private getRelevantInternalLinks(
    sitemapData: Record<string, any>
  ): string[] {
    if (!sitemapData) {
      return [];
    }

    const relevantUrls: string[] = [];

    // Priority 1: Blog URLs
    const blogUrls = sitemapData.blog_urls || [];
    relevantUrls.push(...blogUrls.slice(0, 6)); // Max 6 blog links

    // Priority 2: Resource pages
    const resourceUrls = sitemapData.resource_urls || [];
    relevantUrls.push(...resourceUrls.slice(0, 4)); // Max 4 resource links

    // Priority 3: Product pages
    const productUrls = sitemapData.product_urls || [];
    relevantUrls.push(...productUrls.slice(0, 3)); // Max 3 product links

    // Priority 4: Documentation
    const docsUrls = sitemapData.docs_urls || [];
    relevantUrls.push(...docsUrls.slice(0, 2)); // Max 2 docs links

    // Priority 5: Company pages
    const companyUrls = sitemapData.company_urls || [];
    relevantUrls.push(...companyUrls.slice(0, 1)); // Max 1 company link

    logger.debug(`Selected ${relevantUrls.length} relevant links`);
    return relevantUrls;
  }

  /**
   * Format sitemap URLs into internal link suggestions for the LLM prompt.
   */
  private formatSitemapLinks(urls: string[]): string {
    const linkLines: string[] = [];
    const limitedUrls = urls.slice(0, 12); // Limit to 12

    for (let i = 0; i < limitedUrls.length; i++) {
      const url = limitedUrls[i];
      const parts = url.replace(/\/$/, '').split('/');
      const slug = parts[parts.length - 1] || '';

      // Convert slug to readable title
      let title = slug.replace(/-/g, ' ').replace(/_/g, ' ');
      title = title
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      if (!title) {
        title = 'Related Article';
      }

      linkLines.push(`[${i + 1}] ${url} - ${title}`);
    }

    return linkLines.join('\n');
  }

  /**
   * Format legacy sitemap_urls into internal link suggestions.
   */
  private formatLegacyLinks(sitemapUrls: string[]): string {
    const linkLines: string[] = [];
    const limitedUrls = sitemapUrls.slice(0, 10);

    for (let i = 0; i < limitedUrls.length; i++) {
      const url = limitedUrls[i];
      const parts = url.replace(/\/$/, '').split('/');
      const slug = parts[parts.length - 1] || '';
      const title = slug.replace(/-/g, ' ').replace(/_/g, ' ');
      const titleCase = title
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      linkLines.push(`[${i + 1}] ${url} - ${titleCase || 'Related'}`);
    }

    return linkLines.join('\n');
  }

  /**
   * Normalize and validate job configuration fields.
   */
  private normalizeJobConfig(
    jobConfig: Record<string, any>
  ): Record<string, any> {
    const normalized = { ...jobConfig };

    // Ensure primary_keyword is set
    if (!('primary_keyword' in normalized)) {
      normalized.primary_keyword = '';
    }

    // Set default content generation instruction if not provided
    if (!('content_generation_instruction' in normalized)) {
      normalized.content_generation_instruction =
        'Write a comprehensive, SEO-optimized blog post. ' +
        'Follow all content rules strictly. ' +
        'Ensure paragraph length ≤ 25 words. ' +
        'Include 8+ sources, 1+ internal link per H2 section. ' +
        'Generate 5 FAQ items and 3 PAA items minimum.';
    }

    return normalized;
  }
}
