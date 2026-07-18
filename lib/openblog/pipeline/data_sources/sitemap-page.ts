/**
 * Sitemap Page Model
 *
 * Represents a single URL from the company's sitemap with automatic classification.
 *
 * Structure:
 * - url: Full or relative URL
 * - label: Auto-detected page type (blog, product, service, docs, resource, other)
 * - title: Page title (optional)
 * - path: URL path for analysis
 * - confidence: Confidence score for label classification (0-1)
 */

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
  debug: (msg: string) => console.debug(`[DEBUG] ${msg}`),
};

export type PageLabel =
  | 'blog'
  | 'product'
  | 'service'
  | 'docs'
  | 'resource'
  | 'company' // About, team, careers, culture
  | 'legal' // Imprint, privacy, terms, legal
  | 'contact' // Contact, support, help desk
  | 'landing' // Landing pages, campaigns
  | 'other';

/**
 * Single URL entry from company's sitemap with automatic classification.
 *
 * Attributes:
 *   url: Full or relative URL from sitemap
 *   label: Auto-detected page type
 *   title: Page title (extracted from URL or metadata if available)
 *   path: URL path for pattern analysis
 *   confidence: Confidence score for label (0-1, where 1 = very confident)
 */
export interface SitemapPage {
  url: string;
  label: PageLabel;
  title?: string;
  path: string;
  confidence: number;
}

/**
 * Check if page is a blog.
 */
export function isPageBlog(page: SitemapPage): boolean {
  return page.label === 'blog';
}

/**
 * Check if page is a blog with minimum confidence threshold.
 */
export function isPageBlogConfident(
  page: SitemapPage,
  minConfidence: number = 0.7
): boolean {
  return isPageBlog(page) && page.confidence >= minConfidence;
}

/**
 * Collection of sitemap pages.
 *
 * Manages the complete labeled sitemap and provides filtering/access methods.
 */
export interface SitemapPageList {
  pages: SitemapPage[];
  companyUrl: string;
  totalUrls: number;
  fetchTimestamp?: string;
}

/**
 * Get all blog pages above confidence threshold.
 */
export function getBlogs(
  pageList: SitemapPageList,
  minConfidence: number = 0.7
): SitemapPage[] {
  return pageList.pages.filter((page) =>
    isPageBlogConfident(page, minConfidence)
  );
}

/**
 * Get all pages with specific label.
 */
export function getPagesByLabel(
  pageList: SitemapPageList,
  label: PageLabel,
  minConfidence: number = 0.0
): SitemapPage[] {
  return pageList.pages.filter(
    (page) => page.label === label && page.confidence >= minConfidence
  );
}

/**
 * Get list of blog URLs.
 */
export function getBlogUrls(
  pageList: SitemapPageList,
  minConfidence: number = 0.7
): string[] {
  return getBlogs(pageList, minConfidence).map((page) => page.url);
}

/**
 * Get list of all URLs.
 */
export function getAllUrls(pageList: SitemapPageList): string[] {
  return pageList.pages.map((page) => page.url);
}

/**
 * Get list of URLs by label.
 */
export function getUrlsByLabel(
  pageList: SitemapPageList,
  label: PageLabel,
  minConfidence: number = 0.0
): string[] {
  return getPagesByLabel(pageList, label, minConfidence).map(
    (page) => page.url
  );
}

/**
 * Remove duplicate URLs, keeping first occurrence.
 */
export function deduplicate(pageList: SitemapPageList): SitemapPageList {
  const seen = new Set<string>();
  const uniquePages: SitemapPage[] = [];

  for (const page of pageList.pages) {
    if (!seen.has(page.url)) {
      uniquePages.push(page);
      seen.add(page.url);
    }
  }

  return {
    ...pageList,
    pages: uniquePages,
  };
}

/**
 * Get total page count.
 */
export function count(pageList: SitemapPageList): number {
  return pageList.pages.length;
}

/**
 * Get count of pages by label.
 */
export function countByLabel(
  pageList: SitemapPageList,
  label: PageLabel
): number {
  return getPagesByLabel(pageList, label).length;
}

/**
 * Get summary of page counts by label.
 */
export function getLabelSummary(
  pageList: SitemapPageList
): Record<PageLabel, number> {
  const summary: Record<PageLabel, number> = {
    blog: 0,
    product: 0,
    service: 0,
    docs: 0,
    resource: 0,
    company: 0,
    legal: 0,
    contact: 0,
    landing: 0,
    other: 0,
  };

  for (const page of pageList.pages) {
    summary[page.label] += 1;
  }

  return summary;
}

/**
 * Create an empty SitemapPageList.
 */
export function createEmptySitemapPageList(
  companyUrl: string
): SitemapPageList {
  return {
    pages: [],
    companyUrl,
    totalUrls: 0,
    fetchTimestamp: new Date().toISOString(),
  };
}

/**
 * Create a SitemapPage.
 */
export function createSitemapPage(
  url: string,
  label: PageLabel,
  path: string,
  confidence: number,
  title?: string
): SitemapPage {
  return {
    url,
    label,
    path,
    confidence: Math.max(0, Math.min(1, confidence)), // Clamp to 0-1
    title,
  };
}
