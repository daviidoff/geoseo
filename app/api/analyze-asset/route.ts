import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { logError } from '@/lib/utils/logger'

const BUCKET_NAME = 'context-files'

/**
 * POST /api/analyze-asset
 * Analyzes an image asset using Gemini vision API
 */
export async function POST(request: NextRequest): Promise<Response> {
  let userId: string | null = null

  try {
    userId = await authenticateRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    const { assetId, filePath } = await request.json()

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path required' },
        { status: 400 }
      )
    }

    // filePath should be in format: userId/timestamp-filename
    // Ensure it's a valid storage path
    const storagePath = filePath.includes('/') ? filePath : `${userId}/${filePath}`

    // Get Gemini API key from environment
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // DEV MODE: Use local file storage
    let fileData: Blob | null = null
    let fileType: string | null = null

    if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
      // Dynamic import Node.js modules only when needed (dev mode)
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      
      const tmpDir = os.tmpdir()
      const localPath = path.join(tmpDir, 'context-files', storagePath)
      
      if (fs.existsSync(localPath)) {
        const buffer = fs.readFileSync(localPath)
        const ext = path.extname(localPath).toLowerCase()
        const mimeTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
        }
        fileType = mimeTypes[ext] || 'image/png'
        fileData = new Blob([buffer], { type: fileType })
      } else {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        )
      }
    } else {
      // Production: Storage not configured without Supabase
      return NextResponse.json(
        { error: 'File storage not configured. Enable dev mode or configure storage.' },
        { status: 500 }
      )
    }

    // Convert file to base64
    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    
    // Detect MIME type - try multiple sources
    let mimeType = fileType || fileData.type
    
    // If type not set, try to infer from filename
    if (!mimeType || mimeType === 'application/octet-stream') {
      const fileName = storagePath.toLowerCase()
      if (fileName.match(/\.(jpg|jpeg)$/i)) {
        mimeType = 'image/jpeg'
      } else if (fileName.match(/\.png$/i)) {
        mimeType = 'image/png'
      } else if (fileName.match(/\.gif$/i)) {
        mimeType = 'image/gif'
      } else if (fileName.match(/\.webp$/i)) {
        mimeType = 'image/webp'
      } else if (fileName.match(/\.svg$/i)) {
        mimeType = 'image/svg+xml'
      } else {
        mimeType = 'image/png' // Default fallback
      }
    }
    
    // Normalize JPEG MIME type (ensure it's image/jpeg, not image/jpg)
    if (mimeType === 'image/jpg') {
      mimeType = 'image/jpeg'
    }

    // Analyze with Gemini Vision API with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

    let geminiResponse: Response
    try {
      geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze this image and provide:
1. A list of 3-5 descriptive labels/tags (e.g., "product-screenshot", "dashboard", "ui-design", "infographic", "chart")
2. A brief summary (1-2 sentences) describing what the image shows and how it could be used in blog content
3. A comprehensive detailed description of everything visible in the image, including:
   - All text, numbers, and data visible
   - Visual elements, colors, layout, design
   - Context and meaning
   - How it could be used in blog content creation

Return your response as JSON with this structure:
{
  "labels": ["label1", "label2", "label3"],
  "summary": "Brief 1-2 sentence description",
  "fullDescription": "Comprehensive detailed description of all visible elements, text, data, and context in the image..."
}`
                  },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        }
      )
      clearTimeout(timeoutId)
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json({ error: 'Gemini API timeout' }, { status: 504 })
      }
      throw error
    }

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      logError('Gemini API error', { status: geminiResponse.status, error: errorText })
      return NextResponse.json(
        { error: 'Failed to analyze image with Gemini' },
        { status: 500 }
      )
    }

    const geminiData = await geminiResponse.json()
    
    // Extract text from response
    let analysisText = ''
    if (geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      analysisText = geminiData.candidates[0].content.parts[0].text
    }

    if (!analysisText) {
      return NextResponse.json(
        { error: 'Empty response from Gemini' },
        { status: 500 }
      )
    }

    // Parse JSON response
    let analysisResult
    try {
      analysisResult = JSON.parse(analysisText)
    } catch (e) {
      // If not JSON, try to extract labels and summary from text
      analysisResult = {
        labels: [],
        summary: analysisText,
        fullDescription: analysisText, // Use full text as description if parsing fails
      }
    }

    // If fullDescription wasn't extracted, try a second call for detailed description
    let fullDescription = analysisResult.fullDescription || ''
    if (!fullDescription) {
      const detailedResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Provide a comprehensive, detailed description of everything visible in this image. Include all text, numbers, data, visual elements, colors, layout, design, and context. Describe it as if you were explaining it to someone who cannot see the image.',
                  },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
            },
          }),
        }
      )
      
      if (detailedResponse.ok) {
        const detailedData = await detailedResponse.json()
        if (detailedData.candidates?.[0]?.content?.parts?.[0]?.text) {
          fullDescription = detailedData.candidates[0].content.parts[0].text
        }
      }
    }

    return NextResponse.json({
      success: true,
      labels: analysisResult.labels || [],
      summary: analysisResult.summary || analysisText,
      fullDescription: fullDescription || analysisResult.summary || analysisText,
    })
  } catch (error) {
    logError('Asset analysis error', error)
    return NextResponse.json(
      {
        error: 'Failed to analyze asset',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

