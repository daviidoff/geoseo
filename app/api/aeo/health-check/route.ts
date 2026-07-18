/**
 * AEO Health Check API - Python Backend Integration
 *
 * Routes health check requests to the Python mono-python-service backend.
 * 17 checks across 4 categories: Technical SEO, Structured Data, AI Crawler, Authority
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  healthCheckRequestSchema,
  type HealthCheckResponse,
} from '@/lib/schemas/api'
import { PythonBackendClient } from '@/lib/api/python-backend'
import { checkRateLimit } from '@/lib/api-middleware'
import { createClient } from '@/lib/supabase/server'
import { checkUsage, deductCredits } from '@/lib/services/usage-service'

export const maxDuration = 60 // 1 minute for health check

const pythonBackend = new PythonBackendClient({
  baseUrl: process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000',
  timeout: 60000, // 1 minute
})

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
    const usageCheck = await checkUsage(userId, 'health_check')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Credits exhausted',
          message: usageCheck.message || 'Not enough credits for health check. Please upgrade your plan.',
          remaining: usageCheck.remaining,
          upgrade: true,
        },
        { status: 429 }
      )
    }
  }

  try {
    const rawBody = await request.json()

    // Validate request with Zod schema
    const parseResult = healthCheckRequestSchema.safeParse(rawBody)
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

    const { url } = parseResult.data

    console.log('[API:HEALTH] Running health check via Python backend for:', url)
    const startTime = Date.now()

    try {
      // Call Python backend (sync endpoint for faster response)
      const result = await pythonBackend.checkHealth(url)

      const duration = (Date.now() - startTime) / 1000
      console.log('[API:HEALTH] Health check complete via Python backend in', duration, 's. Score:', result.score)

      // Transform Python backend issue format (passed: bool, severity) to frontend format (status: 'pass' | 'fail' | 'warning')
      const transformIssue = (issue: any): { check: string; category: string; status: 'pass' | 'fail' | 'warning'; message: string; details?: string; impact?: string; recommendation?: string } => {
        let status: 'pass' | 'fail' | 'warning'
        if (issue.passed === true || issue.status === 'pass') {
          status = 'pass'
        } else if (issue.severity === 'warning' || issue.status === 'warning') {
          status = 'warning'
        } else {
          status = 'fail'
        }
        return {
          check: issue.check,
          category: issue.category,
          status,
          message: issue.message,
          details: issue.recommendation || issue.details,
          impact: issue.severity || issue.impact,
          recommendation: issue.recommendation,
        }
      }

      const transformedIssues = result.issues.map(transformIssue)

      // Map to expected response format (compatible with UI expectations)
      const response: HealthCheckResponse = {
        success: result.success,
        url: result.url,
        final_url: result.final_url,
        overall_score: result.score,
        score: result.score,
        grade: result.grade as HealthCheckResponse['grade'],
        visibility_band: result.visibility_band as HealthCheckResponse['visibility_band'],
        visibility_color: result.visibility_color,
        checks: transformedIssues,
        issues: transformedIssues,
        tier_details: result.tier_details,
        summary: result.summary,
        technical_summary: result.technical_summary,
        structured_data_summary: result.structured_data_summary,
        crawler_summary: result.crawler_summary,
        authority_summary: result.authority_summary,
        metadata: result.metadata,
        error: result.error,
      }

      // Deduct credits after successful health check
      if (userId) {
        const deductResult = await deductCredits(userId, 'health_check', 1)
        console.log(`[API:HEALTH] Credits deducted: ${deductResult.creditsDeducted}, remaining: ${deductResult.creditsRemaining}`)
      }

      return NextResponse.json(response)

    } catch (backendError) {
      console.error('[API:HEALTH] Python backend error:', backendError)

      return NextResponse.json(
        {
          success: false,
          error: 'Health check failed',
          message: backendError instanceof Error ? backendError.message : 'Python backend error',
          backend: 'python',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[API:HEALTH] Request error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
