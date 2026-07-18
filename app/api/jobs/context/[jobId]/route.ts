/**
 * ABOUTME: Context Job Status API - Poll job progress from Python backend
 * ABOUTME: GET /api/jobs/context/[jobId] - Get job status and progress
 */

import { NextRequest, NextResponse } from 'next/server'

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000'

export async function GET(
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

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/v1/context/jobs/${jobId}`, {
      method: 'GET',
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

    const job = await response.json()

    return NextResponse.json({
      job_id: job.job_id,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      created_at: job.created_at,
      updated_at: job.updated_at,
    })
  } catch (error) {
    console.error('[API:JOBS/CONTEXT] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get job status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/v1/context/jobs/${jobId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`)
    }

    return NextResponse.json({ message: 'Job cancelled', job_id: jobId })
  } catch (error) {
    console.error('[API:JOBS/CONTEXT] Error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    )
  }
}
