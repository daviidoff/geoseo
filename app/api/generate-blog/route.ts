/**
 * Generate Blog API - Python Backend Integration
 *
 * Routes blog generation requests to the Python mono-python-service backend.
 * The Python backend runs a 5-stage pipeline with AI-powered blog generation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { blogRequestSchema } from '@/lib/schemas/api'
import { PythonBackendClient } from '@/lib/api/python-backend'
import { createClient } from '@/lib/supabase/server'
import { checkUsage, deductCredits } from '@/lib/services/usage-service'

export const maxDuration = 600 // 10 minutes for comprehensive blog generation

const pythonBackend = new PythonBackendClient({
  baseUrl: process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000',
  timeout: 600000, // 10 minutes
})

export async function POST(request: NextRequest): Promise<Response> {
  // Get authenticated user
  const supabase = await createClient()
  let userId: string | null = null
  
  if (supabase) {
    const { data: userData } = await supabase.auth.getUser()
    userId = userData?.user?.id || null
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required', message: 'Please sign in to generate blogs.' },
      { status: 401 }
    )
  }

  // Check usage limits before proceeding
  const usageCheck = await checkUsage(userId, 'blog')
  if (!usageCheck.allowed) {
    return NextResponse.json(
      {
        error: 'Credits exhausted',
        message: usageCheck.message || 'Not enough credits for blog generation. Please upgrade your plan.',
        remaining: usageCheck.remaining,
        upgrade: true,
      },
      { status: 429 }
    )
  }

  try {
    const rawBody = await request.json()

    // Input validation with Zod schema
    const parseResult = blogRequestSchema.safeParse(rawBody)
    if (!parseResult.success) {
      console.error('[API:BLOG] Validation failed:', JSON.stringify(parseResult.error.errors, null, 2))
      console.error('[API:BLOG] Request body:', JSON.stringify(rawBody, null, 2))
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
    const {
      keyword,
      company_name,
      company_url,
      language = 'en',
      country = 'US',
      batch_mode = false,
      batch_keywords = [],
      word_count = 1500,
      tone,
      additional_instructions,
      system_prompts = [],
      business_context,
    } = body

    // Combine system_prompts and additional_instructions into custom_instructions
    const customInstructions = [
      ...system_prompts,
      additional_instructions,
    ].filter(Boolean).join('\n').trim() || undefined

    // Helper to convert string or array to array
    const toArray = (val: string | string[] | null | undefined): string[] | undefined => {
      if (!val) return undefined
      if (Array.isArray(val)) return val
      return val.split(',').map(s => s.trim()).filter(Boolean)
    }

    // Helper to parse voicePersona if it's a string
    const parseVoicePersona = (val: string | Record<string, unknown> | null | undefined): Record<string, unknown> | undefined => {
      if (!val) return undefined
      if (typeof val === 'string') {
        try {
          return JSON.parse(val)
        } catch {
          return undefined
        }
      }
      return val
    }

    // Transform business_context to company_context for Python backend
    const companyContext = business_context ? {
      company_name: business_context.companyName ?? undefined,
      company_url: business_context.companyWebsite ?? undefined,
      industry: business_context.industry ?? undefined,
      description: business_context.companyDescription ?? undefined,
      products: toArray(business_context.products),
      services: toArray(business_context.services),
      target_audience: business_context.targetAudience ?? undefined,
      tone: business_context.tone ?? undefined,
      competitors: toArray(business_context.competitors),
      pain_points: toArray(business_context.painPoints),
      value_propositions: toArray(business_context.valuePropositions),
      use_cases: toArray(business_context.useCases),
      voice_persona: parseVoicePersona(business_context.voicePersona),
      visual_identity: business_context.visualIdentity ?? undefined,
      authors: business_context.authors ?? undefined,
      research_files: business_context.researchFiles?.map((file: Record<string, unknown>) => ({
        name: file.name as string,
        content: file.content as string | undefined,
        fullTextContent: file.fullTextContent as string | undefined,
        aiLabels: file.aiLabels as string[] | undefined,
        labels: file.labels as string[] | undefined,
        aiAnalysis: file.aiAnalysis as string | undefined,
        summary: file.summary as string | undefined,
      })),
    } : undefined

    const startTime = Date.now()

    try {
      // BATCH MODE: Process multiple keywords
      if (batch_mode && batch_keywords.length > 0) {
        console.log(`[API:BLOG] Batch mode via Python backend: Processing ${batch_keywords.length} keywords`)

        // Build keyword_configs for per-keyword settings from CSV
        const keywordConfigs = batch_keywords
          .filter((item: { keyword: string; word_count?: number; instructions?: string }) => 
            item.word_count || item.instructions
          )
          .map((item: { keyword: string; word_count?: number; instructions?: string }) => ({
            keyword: item.keyword,
            word_count: item.word_count,
            instructions: item.instructions,
          }))

        const result = await pythonBackend.generateBlogs({
          keywords: batch_keywords.map((item: { keyword: string }) => item.keyword),
          company_url,
          language,
          market: country,
          skip_images: false,
          max_parallel: 3,
          word_count,
          tone,
          custom_instructions: customInstructions,
          keyword_configs: keywordConfigs.length > 0 ? keywordConfigs : undefined,
          company_context: companyContext,
        })

        const generationTime = (Date.now() - startTime) / 1000

        // Transform Python backend response to match frontend schema
        const results = result.articles.map(article => ({
          keyword: article.keyword,
          success: true,
          title: article.headline,
          content: article.html_content,
          metadata: {
            word_count: article.word_count,
            aeo_score: article.aeo_score,
            job_id: article.slug,
            slug: article.slug,
            meta_title: article.meta_title,
            meta_description: article.meta_description,
            read_time: article.read_time,
            sources: article.sources,
          }
        }))

        // Deduct credits for batch mode (one credit per successful blog)
        const deductResult = await deductCredits(userId, 'blog', results.length)
        console.log(`[API:BLOG] Batch credits deducted: ${deductResult.creditsDeducted}, remaining: ${deductResult.creditsRemaining}`)

        return NextResponse.json({
          batch_mode: true,
          total: batch_keywords.length,
          successful: results.length,
          failed: batch_keywords.length - results.length,
          generation_time: generationTime,
          results,
          execution_mode: 'python_backend',
        })
      }

      // SINGLE MODE: Process single keyword
      console.log('[API:BLOG] Single mode via Python backend for:', keyword)

      const result = await pythonBackend.generateBlogs({
        keywords: [keyword],
        company_url,
        language,
        market: country,
        skip_images: false,
        word_count,
        tone,
        custom_instructions: customInstructions,
        company_context: companyContext,
      })

      const generationTime = (Date.now() - startTime) / 1000

      console.log('[API:BLOG] Python backend response:', JSON.stringify(result, null, 2))

      if (!result.articles || result.articles.length === 0) {
        throw new Error('No article generated - backend returned: ' + JSON.stringify(result))
      }

      const article = result.articles[0]

      console.log('[API:BLOG] Generated blog via Python backend in', generationTime, 's')

      // Deduct credits for single blog generation
      const deductResult = await deductCredits(userId, 'blog', 1)
      console.log(`[API:BLOG] Credits deducted: ${deductResult.creditsDeducted}, remaining: ${deductResult.creditsRemaining}`)

      return NextResponse.json({
        title: article.headline,
        content: article.html_content,
        metadata: {
          keyword,
          word_count: article.word_count,
          generation_time: generationTime,
          company_name,
          company_url,
          aeo_score: article.aeo_score,
          job_id: article.slug,
          slug: article.slug,
          meta_title: article.meta_title,
          meta_description: article.meta_description,
          read_time: article.read_time,
          sources: article.sources,
          execution_mode: 'python_backend',
        },
      })
    } catch (backendError) {
      console.error('[API:BLOG] Python backend error:', backendError)

      return NextResponse.json(
        {
          error: 'Failed to generate blog',
          message: backendError instanceof Error ? backendError.message : 'Python backend error',
          backend: 'python',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[API:BLOG] Request error:', error)
    return NextResponse.json(
      {
        error: 'Invalid request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    )
  }
}
