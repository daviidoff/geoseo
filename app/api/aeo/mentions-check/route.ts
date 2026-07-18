/**
 * Mentions Check API - Python Backend Integration
 *
 * Routes mentions check requests to the Python backend's stage_mentions.
 * Uses Gemini + Google Search grounding for real-time AI visibility checks.
 *
 * Modes:
 * - Fast: 10 queries (~30 seconds)
 * - Full: 50 queries (~2-3 minutes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/api-middleware'
import { createClient } from '@/lib/supabase/server'
import { checkUsage, deductCredits } from '@/lib/services/usage-service'

export const maxDuration = 300 // 5 minutes for mentions check

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000'

interface MentionsCheckRequest {
  company_name: string
  company_analysis?: {
    companyInfo?: {
      industry?: string
      products?: string[]
      services?: string[]
      description?: string
      pain_points?: string[]
      use_cases?: string[]
      targetAudience?: string
    }
    product_categories?: string[]
    competitors?: Array<{ name: string }>
  }
  company_website?: string
  industry?: string
  language?: string
  country?: string
  num_queries?: number
  mode?: 'fast' | 'full'
}

export async function POST(request: NextRequest): Promise<Response> {
  // Rate limiting - generation endpoints are expensive
  const rateLimitResponse = await checkRateLimit(request, 'generation')
  if (rateLimitResponse) return rateLimitResponse

  // Get authenticated user
  const supabase = await createClient()
  let userId: string | null = null
  
  if (supabase) {
    const { data: userData } = await supabase.auth.getUser()
    userId = userData?.user?.id || null
  }

  if (userId) {
    // Check usage limits before proceeding
    const usageCheck = await checkUsage(userId, 'mentions_check')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Credits exhausted',
          message: usageCheck.message || 'Not enough credits for mentions check. Please upgrade your plan.',
          remaining: usageCheck.remaining,
          upgrade: true,
        },
        { status: 429 }
      )
    }
  }

  try {
    const body: MentionsCheckRequest = await request.json()
    const {
      company_name,
      company_analysis,
      industry,
      num_queries,
      mode = 'fast',
    } = body

    if (!company_name) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    console.log('[API:MENTIONS] Forwarding to Python backend:', company_name, 'mode:', mode)
    const startTime = Date.now()

    // Build request for Python backend
    const backendRequest = {
      company_name,
      company_analysis: company_analysis || null,
      num_queries: num_queries || (mode === 'full' ? 50 : 10),
      mode,
    }

    // Call Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/v1/mentions/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendRequest),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API:MENTIONS] Python backend error:', response.status, errorText)
      
      // Check if Python backend is unavailable
      if (response.status === 503 || response.status === 502) {
        return NextResponse.json(
          {
            error: 'Python backend is not available',
            message: 'Please ensure the Python backend is running on port 8000',
          },
          { status: 503 }
        )
      }
      
      return NextResponse.json(
        {
          error: 'Mentions check failed',
          message: errorText,
        },
        { status: response.status }
      )
    }

    const result = await response.json()
    const duration = (Date.now() - startTime) / 1000

    console.log(
      '[API:MENTIONS] Complete via Python backend in',
      duration.toFixed(1),
      's. Visibility:',
      result.visibility?.toFixed(1) || 'N/A',
      '%'
    )

    // Transform response to match frontend expectations
    const transformedResponse = {
      companyName: result.company_name,
      visibility: result.visibility,
      band: result.band,
      mentions: result.mentions,
      presence_rate: result.presence_rate,
      quality_score: result.quality_score,
      max_quality: result.max_quality || 10.0,
      platform_stats: {
        gemini: {
          mentions: result.mentions,
          quality_score: result.quality_score,
          responses: result.queries_processed || 0,
          errors: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          cost: 0,
        },
      },
      dimension_stats: {},
      query_results: result.query_results || [],
      actualQueriesProcessed: result.queries_processed || 0,
      execution_time_seconds: result.execution_time_seconds || duration,
      total_cost: 0,
      total_tokens: 0,
      mode: result.mode || mode,
      execution_mode: 'python_backend',
    }

    // Deduct credits after successful mentions check
    if (userId) {
      const deductResult = await deductCredits(userId, 'mentions_check', 1)
      console.log(`[API:MENTIONS] Credits deducted: ${deductResult.creditsDeducted}, remaining: ${deductResult.creditsRemaining}`)
    }

    return NextResponse.json(transformedResponse)

  } catch (error) {
    console.error('[API:MENTIONS] Error:', error)
    
    // Check for network errors (Python backend not running)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        {
          error: 'Python backend is not available',
          message: 'Please ensure the Python backend is running on port 8000',
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      {
        error: 'Failed to process mentions check',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
