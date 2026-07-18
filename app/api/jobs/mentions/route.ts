/**
 * ABOUTME: Mentions Job API - Create job and get ID for polling
 * ABOUTME: POST /api/jobs/mentions - Create a new mentions check job
 */

import { NextRequest, NextResponse } from 'next/server'

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()

    // Forward to Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/v1/mentions/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || error.message || 'Failed to create job')
    }

    const jobResponse = await response.json()

    return NextResponse.json({
      job_id: jobResponse.job_id,
      status: jobResponse.status,
      message: jobResponse.message,
      created_at: jobResponse.created_at,
    })
  } catch (error) {
    console.error('[API:JOBS/MENTIONS] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create job',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
