/**
 * Generate Keywords API - Python Backend Integration
 *
 * Routes keyword generation requests to the Python mono-python-service backend.
 * The Python backend runs a 5-stage pipeline with AI-powered keyword generation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { keywordRequestSchema, type Keyword } from '@/lib/schemas/api'
import { PythonBackendClient } from '@/lib/api/python-backend'
import { checkUsage, deductCredits } from '@/lib/services/usage-service'
import { getKeywordCreditUnits } from '@/lib/config/pricing.config'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300 // 5 minutes for generation

const pythonBackend = new PythonBackendClient({
  baseUrl: process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000',
  timeout: 300000, // 5 minutes
})

export async function POST(request: NextRequest): Promise<Response> {
  // Get authenticated user from Supabase
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not available' },
      { status: 503 }
    )
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user?.id) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        message: 'Please sign in to generate keywords.',
      },
      { status: 401 }
    )
  }

  const userId = userData.user.id

  try {
    const rawBody = await request.json()

    // Validate request with Zod schema
    const parseResult = keywordRequestSchema.safeParse(rawBody)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.errors,
        },
        { status: 400 }
      )
    }

    const body = parseResult.data
    const { company_name, company_url, business_context, system_instructions, custom_instructions } = body

    // Helper to convert string or array to array (always returns array or undefined)
    const toArray = (val: string | string[] | null | undefined): string[] | undefined => {
      if (!val) return undefined
      if (Array.isArray(val)) return val
      return val.split(',').map(s => s.trim()).filter(Boolean)
    }

    // Build company_context for Python backend
    // Handle both frontend (camelCase) and backend (snake_case) field names
    // business_context from frontend uses: companyName, researchFiles, etc.
    // business_context from schema uses: company_name, research_files, etc.
    const bc = business_context || {}
    const companyContext = {
      company_name: (bc.company_name ?? bc.companyName ?? company_name) as string | undefined,
      company_url: (bc.company_url ?? bc.companyWebsite ?? company_url) as string | undefined,
      industry: (bc.industry ?? bc.targetIndustries ?? body.industry) as string | undefined,
      description: (bc.description ?? bc.productDescription ?? bc.companyDescription ?? body.description) as string | undefined,
      products: toArray(bc.products) ?? toArray(body.products),
      services: toArray(bc.services) ?? toArray(body.services),
      target_audience: (bc.target_audience ?? bc.targetAudience ?? body.target_audience) as string | undefined,
      tone: (bc.tone ?? bc.brandTone ?? body.tone) as string | undefined,
      competitors: toArray(bc.competitors) ?? toArray(body.competitors),
      pain_points: toArray(bc.pain_points) ?? toArray(bc.painPoints) ?? toArray(body.pain_points),
      value_propositions: toArray(bc.value_propositions) ?? toArray(bc.valuePropositions) ?? toArray(body.value_propositions),
      use_cases: toArray(bc.use_cases) ?? toArray(bc.useCases) ?? toArray(body.use_cases),
      content_themes: toArray(bc.content_themes) ?? toArray(bc.contentThemes) ?? toArray(body.content_themes),
      voice_persona: (() => {
        const vp = bc.voice_persona ?? bc.voicePersona
        if (!vp) return undefined
        if (typeof vp === 'string') {
          try { return JSON.parse(vp) } catch { return undefined }
        }
        return vp as Record<string, unknown>
      })(),
      research_files: (bc.research_files ?? bc.researchFiles)?.map((file: Record<string, unknown>) => ({
        name: file.name as string,
        content: (file.content || file.fullTextContent) as string | undefined,
        fullTextContent: file.fullTextContent as string | undefined,
        aiLabels: file.aiLabels as string[] | undefined,
        labels: (file.labels || file.aiLabels) as string[] | undefined,
        aiAnalysis: file.aiAnalysis as string | undefined,
        summary: (file.aiAnalysis || file.fullDescription) as string | undefined,
      })),
    }

    // Check if we have meaningful context to pass
    const hasContext = Boolean(
      companyContext.industry ||
      companyContext.description ||
      (companyContext.products && companyContext.products.length > 0) ||
      (companyContext.services && companyContext.services.length > 0) ||
      (companyContext.pain_points && companyContext.pain_points.length > 0) ||
      (companyContext.research_files && companyContext.research_files.length > 0)
    )

    // Check usage limits before proceeding
    const usageCheck = await checkUsage(userId, 'keyword')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Limit reached',
          message: usageCheck.message,
          limit: usageCheck.limit,
          used: usageCheck.used,
          upgrade: usageCheck.upgrade,
        },
        { status: 429 }
      )
    }

    console.log('[API:KEYWORDS] Generating keywords via Python backend for:', company_name)
    const startTime = Date.now()

    try {
      // Call Python backend with SERP analysis and volume lookup enabled
      const result = await pythonBackend.generateKeywords({
        company_name,
        company_url: company_url || `https://${company_name.toLowerCase().replace(/\s+/g, '')}.com`,
        target_count: body.num_keywords || 30,
        language: body.language || 'en',
        region: body.country || 'us',
        enable_research: true, // Enable deep research for Research tab data
        enable_clustering: true,
        enable_serp_analysis: true, // Enable SERP analysis for AEO opportunity
        enable_volume_lookup: true, // Enable DataForSEO volume lookup
        serp_sample_size: 15, // Analyze top 15 keywords for SERP features
        // Pre-provided company context (enhances keyword generation)
        company_context: hasContext ? companyContext : undefined,
        // Custom instructions for keyword generation
        system_instructions: system_instructions,
        custom_instructions: custom_instructions,
      })

      const generationTime = (Date.now() - startTime) / 1000

      // Transform Python backend response to match frontend schema
      const keywords: Keyword[] = result.keywords.map(kw => ({
        keyword: kw.keyword,
        intent: kw.intent,
        score: kw.score,
        is_question: kw.is_question,
        source: kw.source,
        cluster_name: kw.cluster_name || kw.cluster,
        volume: kw.volume || 0,
        difficulty: kw.difficulty || 0,
        aeo_opportunity: kw.aeo_opportunity || 0,
        has_featured_snippet: kw.has_featured_snippet || false,
        has_paa: kw.has_paa || false,
        serp_analyzed: kw.serp_analyzed || false,
        serp_data: kw.serp_data || null,
        content_brief: kw.content_brief || null,
      }))

      console.log('[API:KEYWORDS] Generated', keywords.length, 'keywords via Python backend in', generationTime, 's')

      // Deduct credits based on keyword count (1 credit per 10 keywords, min 1)
      const creditUnits = getKeywordCreditUnits(keywords.length)
      const deductResult = await deductCredits(userId, 'keyword', creditUnits)
      if (deductResult.success) {
        console.log('[API:KEYWORDS] Credits deducted:', deductResult.creditsDeducted, `(${keywords.length} keywords = ${creditUnits} units), remaining:`, deductResult.creditsRemaining)
      } else {
        console.warn('[API:KEYWORDS] Failed to deduct credits:', deductResult.error)
      }

      // Count keywords with SERP data
      const serpAnalyzedCount = keywords.filter(kw => kw.serp_analyzed).length
      const volumeEnrichedCount = keywords.filter(kw => (kw.volume || 0) > 0).length

      return NextResponse.json({
        keywords,
        metadata: {
          company_name,
          company_url: company_url || '',
          generation_time: generationTime,
          total_keywords: keywords.length,
          research_keywords: keywords.length,
          serp_analyzed_count: serpAnalyzedCount,
          volume_enriched_count: volumeEnrichedCount,
          bonus_keywords_count: 0,
          model: 'gemini-3-flash-preview',
          language: body.language,
          country: body.country,
          used_context: !!body.description,
          execution_mode: 'python_backend',
          phases: {
            research_duration: result.statistics.duration_seconds,
            serp_analysis_duration: 0,
            total_research_found: result.statistics.total_keywords,
            total_bonus_available: 0,
          },
          clusters: result.clusters,
          python_backend: {
            ai_calls: result.statistics.ai_calls,
            avg_score: result.statistics.avg_score,
            total_clusters: result.statistics.total_clusters,
          }
        }
      })
    } catch (backendError) {
      console.error('[API:KEYWORDS] Python backend error:', backendError)

      // Return error from Python backend
      return NextResponse.json(
        {
          error: 'Failed to generate keywords',
          message: backendError instanceof Error ? backendError.message : 'Python backend error',
          backend: 'python',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[API:KEYWORDS] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate keywords',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
