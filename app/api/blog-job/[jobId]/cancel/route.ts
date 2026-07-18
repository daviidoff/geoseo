/**
 * ABOUTME: Cancel Blog Job API - Cancels a running blog generation job
 * ABOUTME: POST /api/blog-job/[jobId]/cancel - Sends cancel request to Python backend
 */

import { NextRequest, NextResponse } from 'next/server'

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  try {
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/v1/blog/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        )
      }
      throw new Error(`Backend returned ${response.status}`)
    }

    const result = await response.json()

    return NextResponse.json({
      job_id: result.job_id,
      status: result.status,
      cancelled: result.cancelled,
      message: result.message,
    })
  } catch (error) {
    console.error('[API:BLOG-JOB-CANCEL] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to cancel job',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
