/**
 * Sitemap Crawler Processor
 *
 * Fetches and labels all URLs from a company's sitemap.
 * Auto-detects page types (blog, product, service, docs, resource, other).
 *
 * Usage:
 *   const crawler = new SitemapCrawler();
 *   const sitemapPages = await crawler.crawl("https://example.com");
 */

import {
  SitemapPage,
  SitemapPageList,
  PageLabel,
  createSitemapPage,
  createEmptySitemapPageList,
} from './sitemap-page';

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string, err?: any) => {
    console.error(`[ERROR] ${msg}`);
    if (err) console.error(err);
  },
  debug: (msg: string) => console.debug(`[DEBUG] ${msg}`),
};

/**
 * Crawls company sitemap and auto-labels all URLs.
 *
 * Responsibilities:
 * 1. Fetch sitemap from standard locations (/sitemap.xml, /sitemap_index.xml)
 * 2. Handle recursive sitemap_index.xml (multiple sitemaps)
 * 3. Extract all URLs
 * 4. Auto-detect page type (blog, product, service, docs, resource, other)
 * 5. Return labeled SitemapPageList for downstream filtering
 *
 * Design:
 * - Single responsibility: Crawl and label
 * - Pattern matching for classification
 * - Configurable: Custom patterns, confidence thresholds, caching
 */
export class SitemapCrawler {
  // Default URL patterns for common page types
  private static readonly DEFAULT_PATTERNS: Record<string, string[]> = {
    blog: [
      '/blog/?',
      '/news/?',
      '/articles/?',
      '/posts/?',
      '/insights/?',
      '/stories/?',
      '/updates/?',
      '/press/?',
    ],
    product: [
      '/products?/?',
      '/solutions?/?',
      '/pricing/?',
      '/features/?',
      '/plans/?',
      '/offerings?/?',
      '/store/?',
      '/shop/?',
      '/catalog/?',
      '/deals?/?',
      '/inventory/?',
    ],
    service: [
      '/services?/?',
      '/consulting/?',
      '/agency/?',
      '/professional-services/?',
    ],
    docs: [
      '/docs?/?',
      '/documentation/?',
      '/guides?/?',
      '/tutorials?/?',
      '/help/?',
      '/kb/?',
      '/knowledge-base/?',
      '/faq/?',
    ],
    resource: [
      '/whitepapers?/?',
      '/case-studies?/?',
      '/templates?/?',
      '/tools?/?',
      '/calculators?/?',
      '/webinars?/?',
      '/videos?/?',
      '/ebooks?/?',
      '/reports?/?',
    ],
    company: [
      '/about/?',
      '/about-us/?',
      '/team/?',
      '/careers?/?',
      '/jobs?/?',
      '/culture/?',
      '/company/?',
      '/who-we-are/?',
      '/mission/?',
      '/vision/?',
      '/values?/?',
      '/leadership/?',
      '/newsroom/?',
    ],
    legal: [
      '/imprint/?',
      '/impressum/?',
      '/privacy/?',
      '/privacy-policy/?',
      '/terms?/?',
      '/terms-of-service/?',
      '/terms-of-use/?',
      '/legal/?',
      '/disclaimer/?',
      '/cookies?/?',
      '/data-protection/?',
      '/gdpr/?',
    ],
    contact: [
      '/contact/?',
      '/contact-us/?',
      '/get-in-touch/?',
      '/reach-us/?',
      '/talk-to-us/?',
      '/support/?',
      '/customer-support/?',
      '/help-desk/?',
      '/email-us/?',
    ],
    landing: [
      '/campaigns?/?',
      '/lp/?',
      '/landing/?',
      '/offers?/?',
      '/promotions?/?',
      '/deals?/?',
      '/promos?/?',
    ],
  };

  // Dangerous URL protocols that should be rejected
  private static readonly DANGEROUS_PROTOCOLS = [
    'javascript:',
    'file:',
    'data:',
    'vbscript:',
    'about:',
    'chrome:',
    'chrome-extension:',
  ];

  private patterns: Record<string, string[]>;
  private timeout: number;
  private cacheTtl: number;
  private maxUrls: number;
  private maxCacheSize: number;
  private cache: Map<string, { data: SitemapPageList; timestamp: number }> =
    new Map();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    customPatterns?: Record<string, string[]>,
    timeout: number = 10000, // 10 seconds default
    cacheTtl: number = 3600, // 1 hour
    maxUrls: number = 10000,
    maxCacheSize: number = 100
  ) {
    if (maxUrls <= 0) {
      throw new Error(`maxUrls must be > 0, got ${maxUrls}`);
    }
    if (maxCacheSize <= 0) {
      throw new Error(`maxCacheSize must be > 0, got ${maxCacheSize}`);
    }
    if (cacheTtl < 0) {
      throw new Error(`cacheTtl must be >= 0, got ${cacheTtl}`);
    }

    this.patterns = customPatterns || SitemapCrawler.DEFAULT_PATTERNS;
    this.timeout = timeout;
    this.cacheTtl = cacheTtl;
    this.maxUrls = maxUrls;
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Crawl company's sitemap and return labeled pages.
   */
  async crawl(companyUrl: string): Promise<SitemapPageList> {
    const startTime = Date.now();

    // Normalize company_url (remove trailing slash)
    companyUrl = companyUrl.replace(/\/$/, '');

    logger.info(`Starting sitemap crawl for ${companyUrl}`);

    // Validate company_url first
    if (!this.isValidUrl(companyUrl)) {
      logger.error(`Invalid company_url: ${companyUrl}`);
      return createEmptySitemapPageList(companyUrl);
    }

    // Check cache
    const cacheKey = `${companyUrl}:${this.maxUrls}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtl * 1000) {
      this.cacheHits++;
      const duration = (Date.now() - startTime) / 1000;
      logger.info(
        `Sitemap crawl complete (cached): ${cached.data.pages.length} URLs in ${duration.toFixed(2)}s`
      );
      return cached.data;
    }

    this.cacheMisses++;

    try {
      // Step 1: Fetch all URLs from sitemap
      const urls = await this.fetchAllUrls(companyUrl);
      logger.info(`Fetched ${urls.length} URLs from sitemap`);

      if (urls.length === 0) {
        logger.warn(`No URLs found in sitemap for ${companyUrl}`);
        const result = createEmptySitemapPageList(companyUrl);
        const duration = (Date.now() - startTime) / 1000;
        logger.info(`Sitemap crawl complete: 0 URLs in ${duration.toFixed(2)}s`);
        return result;
      }

      // Step 2: Apply memory limit
      let limitedUrls = urls;
      if (urls.length > this.maxUrls) {
        logger.warn(
          `Sitemap has ${urls.length} URLs, limiting to ${this.maxUrls}`
        );
        limitedUrls = urls.slice(0, this.maxUrls);
      }

      // Step 3: Create SitemapPage objects with pattern-based classification
      const pages: SitemapPage[] = [];
      let invalidUrlCount = 0;

      for (const url of limitedUrls) {
        if (!this.isValidUrl(url)) {
          invalidUrlCount++;
          logger.debug(`Invalid URL skipped: ${url}`);
          continue;
        }
        const page = this.classifyPage(url);
        pages.push(page);
      }

      if (invalidUrlCount > 0) {
        logger.warn(`Skipped ${invalidUrlCount} invalid URLs`);
      }

      // Step 4: Return labeled page list
      const sitemapPages: SitemapPageList = {
        pages,
        companyUrl,
        totalUrls: urls.length,
        fetchTimestamp: new Date().toISOString(),
      };

      // Store in cache with LRU eviction
      this.cache.set(cacheKey, { data: sitemapPages, timestamp: Date.now() });

      // Evict oldest entries if cache exceeds max size
      if (this.cache.size > this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }

      const duration = (Date.now() - startTime) / 1000;
      logger.info(
        `Sitemap crawl complete: ${pages.length} URLs ` +
          `(cache_hits=${this.cacheHits}, cache_misses=${this.cacheMisses}, ` +
          `cache_size=${this.cache.size}) in ${duration.toFixed(2)}s`
      );
      return sitemapPages;
    } catch (e) {
      const error = e as Error;
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        logger.warn(`Sitemap crawl timeout for ${companyUrl}: ${error.message}`);
      } else {
        logger.error(
          `Unexpected error crawling sitemap for ${companyUrl}: ${error.message}`,
          error
        );
      }
      return createEmptySitemapPageList(companyUrl);
    }
  }

  /**
   * Fetch all URLs from sitemap(s).
   *
   * Handles:
   * - Single sitemap.xml
   * - sitemap_index.xml with multiple sitemaps
   * - Non-existent sitemaps gracefully
   * - HTTP redirects
   * - Concurrent sub-sitemap fetching
   */
  private async fetchAllUrls(companyUrl: string): Promise<string[]> {
    let allUrls: string[] = [];
    const sitemapLocations = [
      `${companyUrl}/sitemap.xml`,
      `${companyUrl}/sitemap_index.xml`,
      `${companyUrl}/sitemap/sitemap.xml`,
    ];

    // Also try www version if no www
    const url = new URL(companyUrl);
    if (!url.hostname.startsWith('www.')) {
      const protocol = url.protocol;
      const domain = url.hostname;
      const base = `${protocol}//www.${domain}`;
      sitemapLocations.push(
        `${base}/sitemap.xml`,
        `${base}/sitemap_index.xml`,
        `${base}/sitemap/sitemap.xml`
      );
    }

    for (const sitemapUrl of sitemapLocations) {
      try {
        // Rate limiting: delay between attempts
        await new Promise((resolve) => setTimeout(resolve, 500));

        const response = await this.fetchWithTimeout(sitemapUrl);
        if (!response.ok) {
          if ([404, 403, 401].includes(response.status)) {
            logger.debug(`Sitemap not found at ${sitemapUrl}: ${response.status}`);
            continue;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();
        const root = this.parseXml(content);

        // Check if this is a sitemap_index (has sitemaps, not urls)
        const sitemaps = this.findElements(
          root,
          'sitemap',
          'http://www.sitemaps.org/schemas/sitemap/0.9'
        );

        if (sitemaps.length > 0) {
          // This is a sitemap_index, fetch all sub-sitemaps concurrently
          logger.info(
            `Found sitemap_index at ${sitemapUrl}, fetching ${sitemaps.length} sitemaps concurrently`
          );

          const subSitemapUrls = sitemaps
            .map((elem) => this.getTextContent(elem, 'loc'))
            .filter((url): url is string => !!url);

          // Fetch all sub-sitemaps concurrently
          const results = await Promise.allSettled(
            subSitemapUrls.map((url) => this.fetchSubSitemap(url))
          );

          for (const result of results) {
            if (result.status === 'fulfilled') {
              allUrls.push(...result.value);
            } else {
              logger.warn(`Sub-sitemap fetch failed: ${result.reason}`);
            }
          }

          if (allUrls.length > 0) {
            break; // Success, don't try other locations
          }
        } else {
          // This is a regular sitemap with urls
          const urls = this.extractUrls(content);
          allUrls.push(...urls);
          logger.info(`Fetched ${urls.length} URLs from ${sitemapUrl}`);
          break; // Success, don't try other locations
        }
      } catch (e) {
        const error = e as Error;
        logger.debug(`Failed to fetch ${sitemapUrl}: ${error.message}`);
        continue;
      }
    }

    // Deduplicate and return
    return Array.from(new Set(allUrls));
  }

  /**
   * Fetch URLs from a single sub-sitemap.
   */
  private async fetchSubSitemap(subSitemapUrl: string): Promise<string[]> {
    try {
      // Rate limiting: delay between sub-sitemap fetches
      await new Promise((resolve) => setTimeout(resolve, 200));

      const response = await this.fetchWithTimeout(subSitemapUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const content = await response.text();
      const urls = this.extractUrls(content);
      logger.debug(`Fetched ${urls.length} URLs from ${subSitemapUrl}`);
      return urls;
    } catch (e) {
      const error = e as Error;
      logger.warn(`Failed to fetch ${subSitemapUrl}: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract URLs from sitemap XML content.
   */
  private extractUrls(content: string): string[] {
    const urls: string[] = [];
    try {
      const root = this.parseXml(content);
      const urlElements = this.findElements(
        root,
        'url',
        'http://www.sitemaps.org/schemas/sitemap/0.9'
      );

      for (const urlElem of urlElements) {
        const loc = this.getTextContent(urlElem, 'loc');
        if (loc) {
          urls.push(loc);
        }
      }
    } catch (e) {
      const error = e as Error;
      logger.warn(`Failed to parse XML: ${error.message}`);
    }

    return urls;
  }

  /**
   * Simple XML parser using DOMParser (browser) or basic regex (Node.js fallback).
   */
  private parseXml(content: string): any {
    // Try DOMParser first (works in browser and some Node.js environments)
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/xml');
      return doc.documentElement;
    }

    // Fallback: return a simple object that can be queried with regex
    // This is a simplified parser for Node.js environments
    return { content, _isSimpleXml: true };
  }

  /**
   * Find elements by tag name and namespace.
   */
  private findElements(root: any, tagName: string, namespace: string): any[] {
    if (root._isSimpleXml) {
      // Fallback regex-based extraction
      const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'g');
      const matches = root.content.match(pattern) || [];
      return matches.map((match: string) => ({ content: match, _isSimpleXml: true }));
    }

    // Use DOM API
    const elements = root.getElementsByTagNameNS(namespace, tagName);
    return Array.from(elements || []);
  }

  /**
   * Get text content of an element or find child element by tag name.
   */
  private getTextContent(element: any, childTag?: string): string | null {
    if (element._isSimpleXml) {
      // Fallback regex extraction
      if (childTag) {
        const pattern = new RegExp(`<${childTag}[^>]*>([^<]*)</${childTag}>`);
        const match = element.content.match(pattern);
        return match ? match[1].trim() : null;
      }
      // Extract text between tags
      const pattern = /<[^>]*>([^<]*)<\/[^>]*>/;
      const match = element.content.match(pattern);
      return match ? match[1].trim() : null;
    }

    // Use DOM API
    if (childTag) {
      const child = element.getElementsByTagName(childTag)[0];
      return child ? child.textContent : null;
    }
    return element.textContent;
  }

  /**
   * Fetch with timeout.
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeoutId);
      return response;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  /**
   * Validate URL before processing.
   */
  private isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      // Check for dangerous protocols
      const urlLower = url.toLowerCase().trim();
      if (
        SitemapCrawler.DANGEROUS_PROTOCOLS.some((proto) =>
          urlLower.startsWith(proto)
        )
      ) {
        return false;
      }

      const parsed = new URL(url);
      return (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        !!parsed.hostname &&
        parsed.hostname.includes('.')
      );
    } catch {
      return false;
    }
  }

  /**
   * Classify a page based on URL patterns.
   */
  private classifyPage(url: string): SitemapPage {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    // Initialize scores for all labels
    const scores: Record<string, number> = {};
    for (const label in this.patterns) {
      scores[label] = 0.0;
    }
    scores.other = 0.1; // Default base score

    // Score each pattern
    for (const [label, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        const regex = new RegExp(pattern);
        if (regex.test(path)) {
          scores[label] += 0.4; // Increase score for each match
          logger.debug(`Pattern '${pattern}' matched for ${url}`);
        }
      }
    }

    // Determine best label and confidence
    let bestLabel: PageLabel = 'other';
    let bestScore = scores.other;

    for (const [label, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestLabel = label as PageLabel;
        bestScore = score;
      }
    }

    // Confidence: normalize to 0-1 range
    const confidence = Math.min(bestScore, 1.0);

    // Extract title from URL slug
    const title = this.extractTitleFromUrl(url);

    return createSitemapPage(url, bestLabel, path, confidence, title);
  }

  /**
   * Extract a human-readable title from URL.
   */
  private extractTitleFromUrl(url: string): string {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const parts = path.replace(/\/$/, '').split('/');

    // Get the last non-empty part
    let slug: string | null = null;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i]) {
        slug = parts[i];
        break;
      }
    }

    if (!slug) {
      return 'Untitled';
    }

    // Replace hyphens with spaces and capitalize
    const title = slug
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return title || 'Untitled';
  }
}
