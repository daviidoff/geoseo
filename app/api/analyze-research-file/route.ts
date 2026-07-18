import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { logError } from '@/lib/utils/logger'

const BUCKET_NAME = 'context-files'

/**
 * POST /api/analyze-research-file
 * Analyzes a research file (PDF, text) using Gemini
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

    const { fileId, filePath, fileName } = await request.json()

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
    let mimeType = 'application/pdf'

    if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      
      const tmpDir = os.tmpdir()
      const localPath = path.join(tmpDir, 'context-files', storagePath)
      
      if (fs.existsSync(localPath)) {
        const buffer = fs.readFileSync(localPath)
        const ext = path.extname(localPath).toLowerCase()
        const mimeTypes: Record<string, string> = {
          '.pdf': 'application/pdf',
          '.txt': 'text/plain',
          '.md': 'text/markdown',
          '.markdown': 'text/markdown',
        }
        mimeType = mimeTypes[ext] || 'application/pdf'
        fileData = new Blob([buffer], { type: mimeType })
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

    // Get file content as text or base64
    const arrayBuffer = await fileData.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    let textContent = ''
    let base64Content = ''

    // For PDFs, send directly as base64 to Gemini (Gemini 2.0 Flash supports PDFs)
    if (mimeType === 'application/pdf') {
      base64Content = fileBuffer.toString('base64')
      
      // Check file size (Gemini has limits - typically 20MB for PDFs)
      if (fileBuffer.length > 20 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'PDF file too large. Maximum size is 20MB.' },
          { status: 400 }
        )
      }

      // Analyze PDF directly with Gemini using inline_data with timeout
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
                      text: `Analyze this research document (PDF) and provide:
1. A list of 3-5 descriptive labels/tags (e.g., "market-research", "industry-report", "competitor-analysis", "whitepaper", "case-study")
2. A brief summary (2-3 sentences) describing the key content and how it could be used in blog content creation
3. Extract and return the FULL TEXT CONTENT of the document (all readable text from the PDF)

Return your response as JSON with this structure:
{
  "labels": ["label1", "label2", "label3"],
  "summary": "Brief description of the document content and its potential use in content creation",
  "fullText": "Complete extracted text content from the PDF document..."
}`,
                    },
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: base64Content,
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
        logError('Gemini PDF analysis error', { status: geminiResponse.status, error: errorText })
        return NextResponse.json(
          { error: 'Failed to analyze PDF with Gemini' },
          { status: 500 }
        )
      }

      const geminiData = await geminiResponse.json()
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

      try {
        const analysisResult = JSON.parse(analysisText)
        
        // If fullText wasn't extracted in first call, try a second call to extract just the text
        let fullText = analysisResult.fullText || ''
        if (!fullText) {
          // Second call: Extract full text content with timeout
          const textController = new AbortController()
          const textTimeoutId = setTimeout(() => textController.abort(), 30000) // 30s timeout

          try {
            const textExtractionResponse = await fetch(
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
                          text: 'Extract and return ALL readable text content from this PDF document. Return ONLY the text content, no analysis or summary.',
                        },
                        {
                          inline_data: {
                            mime_type: mimeType,
                            data: base64Content,
                          },
                        },
                      ],
                    },
                  ],
                  generationConfig: {
                    temperature: 0.1,
                  },
                }),
                signal: textController.signal,
              }
            )
            clearTimeout(textTimeoutId)

            if (textExtractionResponse.ok) {
              const textData = await textExtractionResponse.json()
              if (textData.candidates?.[0]?.content?.parts?.[0]?.text) {
                fullText = textData.candidates[0].content.parts[0].text
              }
            }
          } catch (error) {
            clearTimeout(textTimeoutId)
            // Silently fail text extraction - we already have labels and summary
            if (!(error instanceof Error && error.name === 'AbortError')) {
              throw error
            }
          }
        }
        
        return NextResponse.json({
          success: true,
          labels: analysisResult.labels || [],
          summary: analysisResult.summary || analysisText,
          fullText: fullText,
        })
      } catch (e) {
        return NextResponse.json({
          success: true,
          labels: [],
          summary: analysisText,
          fullText: '',
        })
      }
    } else {
      // For text files, read directly
      textContent = fileBuffer.toString('utf-8')
      
      // Limit content length (Gemini has token limits)
      const maxLength = 100000 // ~25k tokens
      const truncatedContent = textContent.length > maxLength 
        ? textContent.substring(0, maxLength) + '\n\n[... content truncated ...]'
        : textContent

      // Analyze with Gemini with timeout
      const textFileController = new AbortController()
      const textFileTimeoutId = setTimeout(() => textFileController.abort(), 30000) // 30s timeout

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
                      text: `Analyze this research document and provide:
1. A list of 3-5 descriptive labels/tags (e.g., "market-research", "industry-report", "competitor-analysis", "whitepaper", "case-study")
2. A brief summary (2-3 sentences) describing the key content and how it could be used in blog content creation

Document content:
${truncatedContent}

Return your response as JSON with this structure:
{
  "labels": ["label1", "label2", "label3"],
  "summary": "Brief description of the document content and its potential use in content creation"
}

Note: The full text content is already provided above, so you don't need to return it again.`,
                    },
                  ],
                },
              ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
          signal: textFileController.signal,
        }
        )
        clearTimeout(textFileTimeoutId)
      } catch (error) {
        clearTimeout(textFileTimeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          return NextResponse.json({ error: 'Gemini API timeout' }, { status: 504 })
        }
        throw error
      }

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text()
        logError('Gemini API error', { status: geminiResponse.status, error: errorText })
        return NextResponse.json(
          { error: 'Failed to analyze file with Gemini' },
          { status: 500 }
        )
      }

      const geminiData = await geminiResponse.json()
      
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

      try {
        const analysisResult = JSON.parse(analysisText)
        return NextResponse.json({
          success: true,
          labels: analysisResult.labels || [],
          summary: analysisResult.summary || analysisText,
          fullText: textContent, // For text files, we already have the content
        })
      } catch (e) {
        return NextResponse.json({
          success: true,
          labels: [],
          summary: analysisText,
          fullText: textContent,
        })
      }
    }
  } catch (error) {
    logError('Research file analysis error', error)
    return NextResponse.json(
      {
        error: 'Failed to analyze research file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

