/**
 * Blog Job API - Create job and get ID for polling
 *
 * POST /api/blog-job - Create a new blog generation job
 * Returns job_id immediately, frontend polls for progress
 */

import { NextRequest, NextResponse } from 'next/server'
import { blogRequestSchema } from '@/lib/schemas/api'

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const rawBody = await request.json()

    // Input validation with Zod schema
    const parseResult = blogRequestSchema.safeParse(rawBody)
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
    const {
      keyword,
      company_url,
      language = 'en',
      country = 'US',
      batch_mode = false,
      batch_keywords = [],
      word_count = 1500,
      tone,
      additional_instructions,
      system_prompts = [],
    } = body

    // Combine system_prompts and additional_instructions into custom_instructions
    const customInstructions = [
      ...system_prompts,
      additional_instructions,
    ].filter(Boolean).join('\n').trim() || undefined

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

    // Build request for Python backend
    const pythonRequest = {
      keywords: batch_mode 
        ? batch_keywords.map((item: { keyword: string }) => item.keyword)
        : [keyword],
      company_url,
      language,
      market: country,
      skip_images: false,
      max_parallel: batch_mode ? 3 : undefined,
      word_count,
      tone,
      custom_instructions: customInstructions,
      keyword_configs: keywordConfigs.length > 0 ? keywordConfigs : undefined,
    }

    // Create job in Python backend (returns immediately)
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/v1/blog/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pythonRequest),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || error.message || 'Failed to create job')
    }

    const jobResponse = await response.json()

    // Return job_id for polling
    return NextResponse.json({
      job_id: jobResponse.job_id,
      status: jobResponse.status,
      message: jobResponse.message,
      created_at: jobResponse.created_at,
    })
  } catch (error) {
    console.error('[API:BLOG-JOB] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create job',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
