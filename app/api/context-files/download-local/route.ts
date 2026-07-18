import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

/**
 * GET /api/context-files/download-local
 * Downloads a file from local storage (dev mode only)
 */
export async function GET(request: NextRequest): Promise<Response> {
  // Only allow in dev mode
  if (process.env.NEXT_PUBLIC_DEV_MODE !== 'true') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const storagePath = searchParams.get('path')

  if (!storagePath) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 })
  }

  // Build local file path from storage path (userId/timestamp-filename)
  const tmpDir = os.tmpdir()
  const localPath = path.join(tmpDir, 'context-files', storagePath)
  
  // Security: Ensure resolved path is within tmp directory
  const resolvedPath = path.resolve(localPath)
  const resolvedTmpDir = path.resolve(tmpDir)
  if (!resolvedPath.startsWith(resolvedTmpDir)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 403 })
  }

  if (!fs.existsSync(localPath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const fileBuffer = fs.readFileSync(localPath)
  const ext = path.extname(localPath).toLowerCase()
  
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
  }

  const contentType = mimeTypes[ext] || 'application/octet-stream'

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': fileBuffer.length.toString(),
    },
  })
}

