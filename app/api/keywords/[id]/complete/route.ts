/**
 * ABOUTME: API Route for keyword completion (localStorage-based auth)
 * ABOUTME: Returns mock data - no database storage
 *
 * PUT /api/keywords/[id]/complete
 * Called by Python services to report keyword generation completion
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * PUT /api/keywords/[id]/complete
 * Report keyword generation completion with costs (mock - not persisted)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  // AUTHENTICATION: Verify API key
  const COMPLETION_API_KEY = process.env.COMPLETION_API_KEY || process.env.CRON_SECRET || 'dev-secret-change-in-production'
  const authHeader = request.headers.get('authorization')
  const providedKey = authHeader?.replace('Bearer ', '')

  if (!providedKey || providedKey !== COMPLETION_API_KEY) {
    console.error('[API:KEYWORDS] Unauthorized completion request - invalid API key')
    return NextResponse.json(
      { error: 'Unauthorized - invalid API key' },
      { status: 401 }
    )
  }

  try {
    const { id } = params
    const body = await request.json()

    const {
      status = 'completed',
      keywords,
      input_tokens,
      output_tokens,
      api_cost,
    } = body

    // Validate required fields
    if (status === 'completed' && (!keywords || !Array.isArray(keywords))) {
      return NextResponse.json(
        { error: 'keywords array is required when status is completed' },
        { status: 400 }
      )
    }

    if (status === 'completed' && (!input_tokens || !output_tokens || !api_cost)) {
      return NextResponse.json(
        { error: 'input_tokens, output_tokens, and api_cost are required when status is completed' },
        { status: 400 }
      )
    }

    // No database - return mock success
    console.log(`[API:KEYWORDS] Mock completion for generation ${id} (local mode - no database)`)

    return NextResponse.json({
      success: true,
      task: {
        id,
        status,
        keywords,
        input_tokens,
        output_tokens,
        api_cost,
        updated_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[API:KEYWORDS] Request error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
