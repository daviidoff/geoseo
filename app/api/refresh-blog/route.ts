/**
 * ABOUTME: Refresh Blog API - Python Backend Integration
 * ABOUTME: Routes content refresh requests to Python backend with usage tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { PythonBackendClient } from '@/lib/api/python-backend'
import { checkUsage, deductCredits } from '@/lib/services/usage-service'
import { getDevModeUser } from '@/lib/dev-mode-helper'

export const maxDuration = 300 // 5 minutes

const pythonBackend = new PythonBackendClient({
  baseUrl: process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000',
  timeout: 300000, // 5 minutes
})

interface RefreshRequest {
  // Python backend format
  article?: Record<string, unknown>
  keyword?: string
  // Legacy format (for backwards compatibility)
  content?: string
  content_format?: 'html' | 'markdown' | 'json' | 'text'
  instructions?: string[]
  target_sections?: number[]
  output_format?: 'json' | 'html' | 'markdown'
  include_diff?: boolean
}

export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now()
  const user = getDevModeUser()

  try {
    const body: RefreshRequest = await request.json()

    // Check usage limits before proceeding
    const usageCheck = await checkUsage(user.id, 'blog_refresh')
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

    console.log('[REFRESH] Starting content refresh via Python backend')

    try {
      // Handle both formats
      let article: Record<string, unknown>
      let keyword: string

      if (body.article) {
        // New format: direct article object
        article = body.article
        keyword = body.keyword || 'content'
      } else if (body.content) {
        // Legacy format: convert content to article structure
        article = {
          html_content: body.content,
          content_format: body.content_format || 'html',
          instructions: body.instructions || [],
        }
        keyword = 'content-refresh'
      } else {
        return NextResponse.json(
          { error: 'Either article or content is required' },
          { status: 400 }
        )
      }

      // Call Python backend
      const result = await pythonBackend.refreshBlog(article, keyword)

      const duration = (Date.now() - startTime) / 1000
      console.log('[REFRESH] Completed via Python backend in', duration, 's')
      console.log('[REFRESH] Fixes applied:', result.fixes_applied)

      // Deduct credits after successful refresh (also tracks usage internally)
      await deductCredits(user.id, 'blog_refresh', 1)

      // Build response
      const response_data: Record<string, unknown> = {
        success: true,
        article: result.article,
        fixes_applied: result.fixes_applied,
        fixes: result.fixes,
        duration_seconds: duration,
        execution_mode: 'python_backend',
      }

      // For legacy format, extract content from article
      // Frontend expects 'refreshed_html' field for the updated content
      if (body.content && !body.article) {
        const refreshedContent = result.article.html_content || result.article
        response_data.content = refreshedContent
        response_data.refreshed_html = refreshedContent
        response_data.sections_updated = result.fixes_applied
      }

      return NextResponse.json(response_data)

    } catch (backendError) {
      console.error('[REFRESH] Python backend error:', backendError)

      // Check if Python backend is unavailable
      if (backendError instanceof Error && backendError.message.includes('fetch')) {
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
          error: 'Failed to refresh content',
          message: backendError instanceof Error ? backendError.message : 'Python backend error',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[REFRESH] Request error:', error)
    return NextResponse.json(
      {
        error: 'Invalid request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    )
  }
}
