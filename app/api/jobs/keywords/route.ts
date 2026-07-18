/**
 * ABOUTME: Keywords Job API - Create job and get ID for polling
 * ABOUTME: POST /api/jobs/keywords - Create a new keyword generation job
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkUsage, deductCredits } from '@/lib/services/usage-service'
import { getKeywordCreditUnits } from '@/lib/config/pricing.config'

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000'

// Helper to convert string or array to array
const toArray = (val: string | string[] | null | undefined): string[] | undefined => {
  if (!val) return undefined
  if (Array.isArray(val)) return val
  return val.split(',').map(s => s.trim()).filter(Boolean)
}

async function getSupabaseWithUser() {
  try {
    const supabase = await createClient()
    if (supabase) {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) {
        return { supabase, userId: data.user.id }
      }
    }
  } catch (error) {
    console.warn('[API:JOBS/KEYWORDS] Failed to resolve Supabase user:', error)
  }

  return { supabase: null, userId: null }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()
    const { business_context, ...rest } = body

    // Get user for credit check
    const { userId } = await getSupabaseWithUser()

    if (userId) {
      // Check usage limits before proceeding
      const usageCheck = await checkUsage(userId, 'keyword')
      if (!usageCheck.allowed) {
        console.log(`[API:JOBS/KEYWORDS] Usage limit reached for user ${userId}`)
        return NextResponse.json(
          {
            error: 'Credits exhausted',
            message: usageCheck.message || 'Not enough credits for keyword generation. Please upgrade your plan.',
            remaining: usageCheck.remaining,
            upgrade: true,
          },
          { status: 429 }
        )
      }
      console.log(`[API:JOBS/KEYWORDS] Usage check passed for user ${userId}, remaining: ${usageCheck.remaining}`)
    }

    // Transform business_context (frontend format) to company_context (backend format)
    let companyContext = undefined
    if (business_context && typeof business_context === 'object') {
      companyContext = {
        company_name: business_context.companyName,
        company_url: business_context.companyWebsite,
        industry: business_context.industry || business_context.targetIndustries,
        description: business_context.productDescription || business_context.companyDescription,
        products: toArray(business_context.products),
        services: toArray(business_context.services),
        target_audience: business_context.targetAudience,
        tone: business_context.tone || business_context.brandTone,
        competitors: toArray(business_context.competitors),
        pain_points: toArray(business_context.painPoints),
        value_propositions: toArray(business_context.valuePropositions),
        use_cases: toArray(business_context.useCases),
        content_themes: toArray(business_context.contentThemes),
        voice_persona: business_context.voicePersona ?
          (typeof business_context.voicePersona === 'string' ? JSON.parse(business_context.voicePersona) : business_context.voicePersona) : undefined,
        research_files: business_context.researchFiles?.map((file: Record<string, unknown>) => ({
          name: file.name,
          content: file.content || file.fullTextContent,
          fullTextContent: file.fullTextContent,
          aiLabels: file.aiLabels,
          labels: file.labels || file.aiLabels,
          aiAnalysis: file.aiAnalysis,
          summary: file.aiAnalysis || file.fullDescription,
        })),
      }
    }

    // Build request for Python backend
    const pythonRequest = {
      ...rest,
      company_context: companyContext,
    }

    // Forward to Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/v1/keywords/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pythonRequest),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || error.message || 'Failed to create job')
    }

    const jobResponse = await response.json()

    // Deduct credits after successful job creation
    // Use target_count to determine credit cost (1 credit per 10 keywords, min 1)
    if (userId) {
      const targetCount = rest.target_count || 50
      const creditUnits = getKeywordCreditUnits(targetCount)
      const deductResult = await deductCredits(userId, 'keyword', creditUnits)
      if (deductResult.success) {
        console.log(`[API:JOBS/KEYWORDS] Credits deducted: ${deductResult.creditsDeducted}, remaining: ${deductResult.creditsRemaining}`)
      } else {
        console.warn(`[API:JOBS/KEYWORDS] Failed to deduct credits: ${deductResult.error}`)
      }
    }

    return NextResponse.json({
      job_id: jobResponse.job_id,
      status: jobResponse.status,
      message: jobResponse.message,
      created_at: jobResponse.created_at,
    })
  } catch (error) {
    console.error('[API:JOBS/KEYWORDS] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create job',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
