/**
 * ABOUTME: Context Files Upload API (localStorage-based auth)
 * ABOUTME: Mock upload - files are stored client-side only
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_FILE_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/html',
  'text/markdown',
]

/**
 * POST /api/context-files/upload
 * Mock upload endpoint - returns success without storing
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Authenticate request
    const userId = await authenticateRequest(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const fileType = formData.get('fileType') as string | null // 'input' | 'output' | 'manual'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    // Validate file type (also check by extension for HTML/MD files)
    const fileName = file.name.toLowerCase()
    const isHtmlOrMd = fileName.endsWith('.html') || fileName.endsWith('.htm') ||
                       fileName.endsWith('.md') || fileName.endsWith('.markdown')

    if (!ALLOWED_FILE_TYPES.includes(file.type) && !isHtmlOrMd) {
      return NextResponse.json(
        { error: 'File type not allowed. Supported: CSV, XLSX, PDF, DOCX, HTML, MD' },
        { status: 400 }
      )
    }

    // Generate unique file path (mock - no actual storage)
    const timestamp = Date.now()
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${userId}/${timestamp}-${sanitizedFilename}`

    // Return mock success response
    return NextResponse.json({
      id: filePath,
      name: file.name,
      type: file.type,
      size: file.size,
      path: filePath,
      url: `/api/context-files/download-local?path=${encodeURIComponent(filePath)}`,
      uploadedAt: new Date().toISOString(),
      fileType: fileType || 'manual',
    })
  } catch (error) {
    console.error('File upload error', error)
    return NextResponse.json(
      {
        error: 'Failed to upload file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
