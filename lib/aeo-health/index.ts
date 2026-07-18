/**
 * AEO Health Check Service - Main Entry Point
 *
 * Complete AEO health analysis combining:
 * - 16 technical SEO checks
 * - 6 structured data checks
 * - 4 AI crawler access checks
 * - 3 authority/E-E-A-T checks
 * - Tiered objective scoring (v4.0)
 */

import * as cheerio from 'cheerio'
import { fetchWebsite } from './core/fetcher'
import { runTechnicalChecks, extractTechnicalSummary } from './checks/technical'
import { runStructuredDataChecks, extractStructuredDataSummary, extractSchemaData } from './checks/structured-data'
import { runAeoCrawlerChecks, extractCrawlerSummary } from './checks/crawler'
import { runAuthorityChecks, extractAuthoritySummary } from './checks/authority'
import { calculateTieredScore, calculateGrade, calculateVisibilityBand, countIssuesBySeverity } from './core/scoring'
import type { CheckResult } from './checks/technical'
import type { TierDetails } from './core/scoring'

export interface HealthCheckResult {
  success: boolean
  url: string
  final_url: string
  score: number
  grade: string
  visibility_band: string
  visibility_color: string
  issues: CheckResult[]
  tier_details: TierDetails
  summary: {
    total_checks: number
    passed: number
    errors: number
    warnings: number
    notices: number
  }
  technical_summary?: any
  structured_data_summary?: any
  crawler_summary?: any
  authority_summary?: any
  metadata: {
    fetch_time_ms: number
    response_time_ms: number
    status_code: number
    sitemap_found: boolean
    robots_txt_found: boolean
  }
  error?: string
}

export async function performHealthCheck(url: string): Promise<HealthCheckResult> {
  try {
    // Step 1: Fetch website content
    const fetchResult = await fetchWebsite(url)

    if (fetchResult.error || !fetchResult.html) {
      return {
        success: false,
        url,
        final_url: fetchResult.finalUrl,
        score: 0,
        grade: 'F',
        visibility_band: 'Critical',
        visibility_color: '#ef4444',
        issues: [],
        tier_details: {
          tier0: { passed: false, cap: 0, reason: 'Failed to fetch website' },
          tier1: { passed: false, cap: 0, reason: 'Failed to fetch website' },
          tier2: { passed: false, cap: 0, reason: 'Failed to fetch website' },
          base_score: 0,
          limiting_tier: 'tier0',
          limiting_reason: 'Failed to fetch website',
        },
        summary: {
          total_checks: 0,
          passed: 0,
          errors: 1,
          warnings: 0,
          notices: 0,
        },
        metadata: {
          fetch_time_ms: fetchResult.totalFetchTimeMs,
          response_time_ms: fetchResult.htmlResponseTimeMs,
          status_code: fetchResult.statusCode,
          sitemap_found: fetchResult.sitemapFound,
          robots_txt_found: fetchResult.robotsTxt !== null,
        },
        error: fetchResult.error || 'Failed to fetch website',
      }
    }

    // Step 2: Parse HTML
    const $ = cheerio.load(fetchResult.html)

    // Step 3: Extract schema data for cross-check usage
    const { schemaTypes, allSchemas, orgSchema } = extractSchemaData($)
    const sameAsUrls = orgSchema?.sameAs
      ? Array.isArray(orgSchema.sameAs)
        ? orgSchema.sameAs
        : [orgSchema.sameAs]
      : []

    // Step 4: Run all checks IN PARALLEL (they're independent)
    const [technicalIssues, structuredDataIssues, crawlerIssues, authorityIssues] = await Promise.all([
      Promise.resolve(runTechnicalChecks({
        $,
        finalUrl: fetchResult.finalUrl,
        sitemapFound: fetchResult.sitemapFound,
        responseTimeMs: fetchResult.htmlResponseTimeMs,
      })),
      Promise.resolve(runStructuredDataChecks($)),
      Promise.resolve(runAeoCrawlerChecks(fetchResult.robotsTxt)),
      Promise.resolve(runAuthorityChecks($, sameAsUrls)),
    ])

    // Combine all issues
    const allIssues = [
      ...technicalIssues,
      ...structuredDataIssues,
      ...crawlerIssues,
      ...authorityIssues,
    ]

    // Step 5: Calculate scores
    const [score, tierDetails] = calculateTieredScore(allIssues)
    const grade = calculateGrade(score)
    const [visibilityBand, visibilityColor] = calculateVisibilityBand(score)
    const severityCounts = countIssuesBySeverity(allIssues)

    // Step 6: Extract summaries
    const technicalSummary = extractTechnicalSummary($, fetchResult.finalUrl)
    const structuredDataSummary = extractStructuredDataSummary($)
    const crawlerSummary = extractCrawlerSummary(fetchResult.robotsTxt)
    const authoritySummary = extractAuthoritySummary($, sameAsUrls)

    return {
      success: true,
      url,
      final_url: fetchResult.finalUrl,
      score,
      grade,
      visibility_band: visibilityBand,
      visibility_color: visibilityColor,
      issues: allIssues,
      tier_details: tierDetails,
      summary: {
        total_checks: allIssues.length,
        passed: severityCounts.passed,
        errors: severityCounts.errors,
        warnings: severityCounts.warnings,
        notices: severityCounts.notices,
      },
      technical_summary: technicalSummary,
      structured_data_summary: structuredDataSummary,
      crawler_summary: crawlerSummary,
      authority_summary: authoritySummary,
      metadata: {
        fetch_time_ms: fetchResult.totalFetchTimeMs,
        response_time_ms: fetchResult.htmlResponseTimeMs,
        status_code: fetchResult.statusCode,
        sitemap_found: fetchResult.sitemapFound,
        robots_txt_found: fetchResult.robotsTxt !== null,
      },
    }
  } catch (error: any) {
    return {
      success: false,
      url,
      final_url: url,
      score: 0,
      grade: 'F',
      visibility_band: 'Critical',
      visibility_color: '#ef4444',
      issues: [],
      tier_details: {
        tier0: { passed: false, cap: 0, reason: 'Internal error' },
        tier1: { passed: false, cap: 0, reason: 'Internal error' },
        tier2: { passed: false, cap: 0, reason: 'Internal error' },
        base_score: 0,
        limiting_tier: 'tier0',
        limiting_reason: 'Internal error',
      },
      summary: {
        total_checks: 0,
        passed: 0,
        errors: 1,
        warnings: 0,
        notices: 0,
      },
      metadata: {
        fetch_time_ms: 0,
        response_time_ms: 0,
        status_code: 0,
        sitemap_found: false,
        robots_txt_found: false,
      },
      error: error.message || 'Internal server error',
    }
  }
}

// Re-export types and utilities for external use
export type { CheckResult } from './checks/technical'
export type { TierDetails } from './core/scoring'
export { calculateGrade, calculateVisibilityBand } from './core/scoring'
