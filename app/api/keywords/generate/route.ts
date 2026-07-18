/**
 * ABOUTME: API Route for keyword generation (localStorage-based auth)
 * ABOUTME: Uses local user - no Supabase auth
 */

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/debug/cto-logger'
import { checkRateLimit } from '@/lib/api-middleware'
import { checkUsage, deductCredits } from '@/lib/services/usage-service'
import { getKeywordCreditUnits } from '@/lib/config/pricing.config'
import { getDevModeUser } from '@/lib/dev-mode-helper'
import { ResearchEngine } from '@/lib/openkeyword/core/researcher'
import { GeminiSerpAnalyzer } from '@/lib/openkeyword/analyzers/gemini-serp-analyzer'
import { SemanticDeduplicator } from '@/lib/openkeyword/core/deduplicator'
import { CompanyFitScorer } from '@/lib/openkeyword/core/scorer'
import { SemanticClusterer } from '@/lib/openkeyword/core/clusterer'

export const maxDuration = 1800 // 30 minutes for generation

interface KeywordRequest {
  company_name: string
  company_url: string
  language: string
  country: string
  num_keywords: number
  analyze_first?: boolean
  description?: string
  industry?: string
  products?: string
  services?: string
  target_audience?: string
  competitors?: string
  pain_points?: string
  value_propositions?: string
  use_cases?: string
  content_themes?: string
  tone?: string
}

export async function POST(request: NextRequest): Promise<Response> {
  // Rate limiting - generation endpoints are expensive
  const rateLimitResponse = await checkRateLimit(request, 'generation')
  if (rateLimitResponse) return rateLimitResponse

  const logger = createLogger('keywords-api', 'generate')
  const startTime = Date.now()
  let user: any = null
  let company_name: string = 'unknown'

  try {
    const body: KeywordRequest = await request.json()
    const { company_name: companyName, company_url } = body
    company_name = companyName || 'unknown'

    logger.info('Request received', {
      company_name: companyName,
      company_url,
      num_keywords: body.num_keywords,
      language: body.language,
      country: body.country,
      has_description: !!body.description,
      has_industry: !!body.industry,
      request_size_bytes: JSON.stringify(body).length
    })

    if (!companyName) {
      logger.warn('Request validation failed', { error: 'company_name missing' })
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    // Get user from localStorage-based auth (always returns mock user)
    const devUser = getDevModeUser()
    user = { id: devUser.id, email: devUser.email }
    logger.info('Using localStorage auth', { user_id: user.id })

    // Check usage limits before proceeding
    const usageCheck = await checkUsage(user.id, 'keyword')
    if (!usageCheck.allowed) {
      logger.warn('Usage limit reached', {
        user_id: user.id,
        message: usageCheck.message,
        limit: usageCheck.limit,
        used: usageCheck.used
      })

      return NextResponse.json(
        {
          error: 'Limit reached',
          message: usageCheck.message,
          limit: usageCheck.limit,
          used: usageCheck.used,
          upgrade: usageCheck.upgrade
        },
        { status: 429 }
      )
    }

    logger.info('Usage check passed', {
      user_id: user.id,
      limit: usageCheck.limit,
      used: usageCheck.used,
      remaining: usageCheck.remaining
    })

    // Use server environment variable
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      logger.critical('Configuration error', null, { error: 'gemini_api_key_missing' })
      return NextResponse.json(
        { error: 'Gemini API key not configured on server. Please contact administrator.' },
        { status: 500 }
      )
    }

    logger.info('Configuration validated', {
      has_api_key: true,
      api_key_length: apiKey.length,
      key_prefix: apiKey.substring(0, 10) + '...'
    })

    logger.info('Starting local TypeScript keyword generation', {
      company: company_name,
      target_keywords: body.num_keywords,
      execution_mode: 'local_gemini'
    })

    // Initialize all engines
    const researcher = new ResearchEngine({ apiKey })
    const serpAnalyzer = new GeminiSerpAnalyzer({ geminiApiKey: apiKey })
    const deduplicator = new SemanticDeduplicator({ apiKey })
    const scorer = new CompanyFitScorer({ apiKey })
    const clusterer = new SemanticClusterer({ apiKey })

    // Helper to handle both string and array inputs
    const toArray = (value: string | string[] | undefined): string[] => {
      if (!value) return []
      return Array.isArray(value) ? value : value.split(',').map(s => s.trim())
    }

    // Phase 1: Research keywords from forums
    const researchStartTime = Date.now()
    const targetCount = body.num_keywords || 30
    const coreKeywordCount = Math.min(20, Math.max(10, Math.floor(targetCount * 0.4)))

    logger.info('Phase 1: Research keywords from forums', {
      target_count: targetCount,
      core_keyword_count: coreKeywordCount
    })

    const researchKeywords = await researcher.discoverKeywords({
      companyName: company_name,
      industry: body.industry || 'technology',
      products: toArray(body.products),
      services: toArray(body.services),
      language: body.language || 'en',
      targetCount: coreKeywordCount,
    })
    const researchDuration = (Date.now() - researchStartTime) / 1000

    logger.info('Phase 1 complete', {
      keywords_found: researchKeywords.length,
      duration_seconds: researchDuration
    })

    // Phase 2: Analyze top keywords with SERP data
    const serpStartTime = Date.now()
    const topKeywords = researchKeywords.slice(0, 20)

    logger.info('Phase 2: SERP analysis with Gemini Search', {
      analyzing_keywords: topKeywords.length
    })

    const [serpAnalysesDict, bonusKeywords] = await serpAnalyzer.analyzeKeywords(
      topKeywords.map(k => k.keyword),
      true
    )
    const serpDuration = (Date.now() - serpStartTime) / 1000

    logger.info('Phase 2 complete', {
      serp_analyzed: Object.keys(serpAnalysesDict).length,
      bonus_keywords_found: bonusKeywords.length,
      duration_seconds: serpDuration
    })

    // Phase 3: Semantic deduplication
    const dedupStartTime = Date.now()
    const allRawKeywords = [
      ...researchKeywords.map(k => k.keyword),
      ...bonusKeywords
    ]

    logger.info('Phase 3: Semantic deduplication', {
      raw_keywords: allRawKeywords.length
    })

    const dedupResult = await deduplicator.deduplicateKeywords(allRawKeywords)
    const dedupDuration = (Date.now() - dedupStartTime) / 1000

    logger.info('Phase 3 complete', {
      unique_keywords: dedupResult.unique_keywords.length,
      duplicates_removed: dedupResult.removed_duplicates.length,
      dedup_rate: dedupResult.dedup_rate.toFixed(1) + '%',
      duration_seconds: dedupDuration
    })

    // Merge research keywords with SERP data (using only deduplicated keywords)
    const dedupSet = new Set(dedupResult.unique_keywords)
    const enrichedKeywords = researchKeywords
      .filter(kw => dedupSet.has(kw.keyword))
      .map(kw => {
        const serpData = serpAnalysesDict[kw.keyword]
        if (serpData) {
          return {
            ...kw,
            aeo_opportunity: serpData.features.aeo_opportunity,
            has_featured_snippet: serpData.features.has_featured_snippet,
            has_paa: serpData.features.has_paa,
            serp_analyzed: true,
            serp_data: {
              featured_snippet_text: serpData.features.featured_snippet_text,
              featured_snippet_url: serpData.features.featured_snippet_url,
              paa_questions: serpData.features.paa_questions,
              related_searches: serpData.features.related_searches,
              top_domains: serpData.features.top_domains,
              organic_results_count: serpData.features.organic_results_count,
            }
          }
        }
        return kw
      })

    // Limit to target count before scoring/clustering (performance optimization)
    const preScoreKeywords = enrichedKeywords.slice(0, targetCount)

    // Phase 4: Company-fit scoring
    const scoringStartTime = Date.now()

    logger.info('Phase 4: Company-fit scoring', {
      keywords_to_score: preScoreKeywords.length
    })

    const scoringContext = {
      companyName: company_name,
      industry: body.industry || 'technology',
      products: toArray(body.products),
      services: toArray(body.services),
      targetAudience: body.target_audience,
      valuePropositions: toArray(body.value_propositions),
      competitors: toArray(body.competitors),
    }

    const scoredKeywords = await scorer.scoreKeywords(
      preScoreKeywords.map(k => k.keyword),
      scoringContext
    )
    const scoringDuration = (Date.now() - scoringStartTime) / 1000

    logger.info('Phase 4 complete', {
      keywords_scored: scoredKeywords.length,
      avg_score: (scoredKeywords.reduce((sum, k) => sum + k.company_fit_score, 0) / scoredKeywords.length).toFixed(1),
      duration_seconds: scoringDuration
    })

    // Merge scoring data
    const scoringMap = new Map(scoredKeywords.map(s => [s.keyword, s]))
    const keywordsWithScores = preScoreKeywords.map(kw => ({
      ...kw,
      company_fit_score: scoringMap.get(kw.keyword)?.company_fit_score || 50,
      recommended_priority: scoringMap.get(kw.keyword)?.recommended_priority || 'medium',
    }))

    // Phase 5: Semantic clustering
    const clusteringStartTime = Date.now()

    logger.info('Phase 5: Semantic clustering', {
      keywords_to_cluster: keywordsWithScores.length
    })

    const clusteringResult = await clusterer.clusterKeywords(
      keywordsWithScores.map(k => k.keyword),
      {
        name: company_name,
        industry: body.industry || 'technology',
        products: toArray(body.products),
        services: toArray(body.services),
      }
    )
    const clusteringDuration = (Date.now() - clusteringStartTime) / 1000

    logger.info('Phase 5 complete', {
      total_clusters: clusteringResult.total_clusters,
      clustering_quality: clusteringResult.clustering_quality_score,
      unclustered: clusteringResult.unclustered.length,
      duration_seconds: clusteringDuration
    })

    const finalKeywords = keywordsWithScores

    const generationTime = (Date.now() - startTime) / 1000
    const coreCount = Math.min(enrichedKeywords.length, targetCount)
    const bonusCount = finalKeywords.length - coreCount

    // Deduct credits based on keyword count (1 credit per 10 keywords, min 1)
    const creditUnits = getKeywordCreditUnits(finalKeywords.length)
    const deductResult = await deductCredits(user.id, 'keyword', creditUnits)
    if (deductResult.success) {
      logger.info('Credits deducted', {
        keywords_generated: finalKeywords.length,
        credit_units: creditUnits,
        credits_deducted: deductResult.creditsDeducted,
        credits_remaining: deductResult.creditsRemaining,
      })
    } else {
      logger.warn('Failed to deduct credits', { error: deductResult.error })
    }

    logger.info('Local keyword generation completed successfully', {
      user_id: user.id,
      keywords_generated: finalKeywords.length,
      core_keywords: coreCount,
      bonus_keywords: bonusCount,
      generation_time_seconds: generationTime
    })

    logger.metric('keywords_generated', finalKeywords.length, 'count', {
      source: 'local_typescript',
      company: company_name,
      generation_time: generationTime
    })

    logger.perf('keyword_generation', startTime, {
      keywords_count: finalKeywords.length,
      service: 'local_gemini'
    })

    return NextResponse.json({
      keywords: finalKeywords,
      clusters: clusteringResult.clusters,
      deduplication: {
        original_count: dedupResult.original_count,
        final_count: dedupResult.final_count,
        removed_count: dedupResult.removed_duplicates.length,
        dedup_rate: dedupResult.dedup_rate,
        duplicate_groups: dedupResult.duplicate_groups,
      },
      statistics: {
        avg_company_fit_score: (scoredKeywords.reduce((sum, k) => sum + k.company_fit_score, 0) / scoredKeywords.length).toFixed(1),
        high_priority_count: keywordsWithScores.filter(k => k.recommended_priority === 'high').length,
        medium_priority_count: keywordsWithScores.filter(k => k.recommended_priority === 'medium').length,
        low_priority_count: keywordsWithScores.filter(k => k.recommended_priority === 'low').length,
        clustering_quality_score: clusteringResult.clustering_quality_score,
        total_clusters: clusteringResult.total_clusters,
      },
      metadata: {
        company_name,
        company_url,
        total_keywords: finalKeywords.length,
        generation_time: generationTime,
        source: 'local_typescript',
        research_keywords: coreCount,
        serp_analyzed_count: Object.keys(serpAnalysesDict).length,
        bonus_keywords_count: bonusCount,
        model: 'gemini-3-flash-preview',
        language: body.language,
        country: body.country,
        used_context: !!body.description,
        execution_mode: 'local_typescript_full_parity',
        features_enabled: {
          deep_research: true,
          serp_analysis: true,
          semantic_deduplication: true,
          company_fit_scoring: true,
          semantic_clustering: true,
        },
        phases: {
          research_duration: researchDuration,
          serp_analysis_duration: serpDuration,
          deduplication_duration: dedupDuration,
          scoring_duration: scoringDuration,
          clustering_duration: clusteringDuration,
          total_duration: generationTime,
          total_research_found: researchKeywords.length,
          total_bonus_available: bonusKeywords.length,
        }
      }
    })
  } catch (error) {
    logger.critical('Unhandled request error', error, {
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      total_duration_ms: Date.now() - startTime,
      company_name: company_name
    })

    // Usage is only tracked on success, so no need to refund on failure

    return NextResponse.json(
      {
        error: 'Failed to generate keywords',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
