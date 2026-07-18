/**
 * ABOUTME: React hook for using the shared Gemini client with grounding
 * ABOUTME: Provides easy integration with React components
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  SharedGeminiClient,
  GenerateOptions,
  GenerateResult,
  GroundingSource,
  GroundingSupport,
} from '../gemini-shared'

interface UseGeminiClientOptions {
  apiKey?: string
  model?: string
  onError?: (error: Error) => void
}

interface UseGeminiClientReturn {
  // State
  isGenerating: boolean
  error: Error | null
  lastResult: GenerateResult | null
  groundingSources: GroundingSource[]
  groundingSupports: GroundingSupport[]

  // Actions
  generate: (options: Omit<GenerateOptions, 'apiKey'>) => Promise<GenerateResult | null>
  generateWithSchema: <T>(
    options: Omit<GenerateOptions, 'apiKey'>
  ) => Promise<{ data: T; sources: GroundingSource[] } | null>
  insertInlineLinks: (content: string) => string
  reset: () => void

  // Utilities
  client: SharedGeminiClient | null
  remainingRequests: number
}

/**
 * React hook for using the shared Gemini client
 *
 * @example
 * ```tsx
 * function KeywordGenerator() {
 *   const { generate, isGenerating, groundingSources } = useGeminiClient()
 *
 *   const handleGenerate = async () => {
 *     const result = await generate({
 *       prompt: 'Generate 10 keywords for...',
 *       enableGrounding: true,
 *     })
 *     console.log(result?.text)
 *     console.log(groundingSources) // URLs from Google Search
 *   }
 *
 *   return (
 *     <button onClick={handleGenerate} disabled={isGenerating}>
 *       {isGenerating ? 'Generating...' : 'Generate'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useGeminiClient(options: UseGeminiClientOptions = {}): UseGeminiClientReturn {
  const { apiKey, model, onError } = options

  // State
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastResult, setLastResult] = useState<GenerateResult | null>(null)
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([])
  const [groundingSupports, setGroundingSupports] = useState<GroundingSupport[]>([])

  // Client ref (persistent across renders)
  const clientRef = useRef<SharedGeminiClient | null>(null)

  // Initialize client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = new SharedGeminiClient()

      // Try to initialize from props or environment
      const key = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY
      const mdl = model || process.env.NEXT_PUBLIC_GEMINI_MODEL

      if (key) {
        try {
          clientRef.current.initialize(key, mdl)
        } catch (err) {
          console.warn('[useGeminiClient] Failed to initialize:', err)
        }
      }
    }
  }, [apiKey, model])

  // Generate content
  const generate = useCallback(
    async (genOptions: Omit<GenerateOptions, 'apiKey'>): Promise<GenerateResult | null> => {
      if (!clientRef.current) {
        const err = new Error('Gemini client not initialized')
        setError(err)
        onError?.(err)
        return null
      }

      setIsGenerating(true)
      setError(null)

      try {
        const result = await clientRef.current.generate(genOptions)

        setLastResult(result)
        setGroundingSources(result.groundingSources)
        setGroundingSupports(result.groundingSupports)

        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        onError?.(error)
        return null
      } finally {
        setIsGenerating(false)
      }
    },
    [onError]
  )

  // Generate with schema and parse JSON
  const generateWithSchema = useCallback(
    async <T>(
      genOptions: Omit<GenerateOptions, 'apiKey'>
    ): Promise<{ data: T; sources: GroundingSource[] } | null> => {
      const result = await generate(genOptions)
      if (!result) return null

      try {
        // If schema was provided, response should be JSON
        let data: T
        if (genOptions.responseSchema) {
          data = JSON.parse(result.text) as T
        } else {
          // Try to extract JSON from text response
          data = clientRef.current!.extractJsonFromResponse<T>(result.text)
        }

        return {
          data,
          sources: result.groundingSources,
        }
      } catch (err) {
        const error = new Error(`Failed to parse response: ${err}`)
        setError(error)
        onError?.(error)
        return null
      }
    },
    [generate, onError]
  )

  // Insert inline links using grounding supports
  const insertInlineLinks = useCallback((content: string): string => {
    if (!clientRef.current) return content
    return clientRef.current.insertInlineLinks(content)
  }, [])

  // Reset state
  const reset = useCallback(() => {
    setIsGenerating(false)
    setError(null)
    setLastResult(null)
    setGroundingSources([])
    setGroundingSupports([])
  }, [])

  // Get remaining requests
  const remainingRequests = clientRef.current?.getRemainingRequests() ?? 60

  return {
    // State
    isGenerating,
    error,
    lastResult,
    groundingSources,
    groundingSupports,

    // Actions
    generate,
    generateWithSchema,
    insertInlineLinks,
    reset,

    // Utilities
    client: clientRef.current,
    remainingRequests,
  }
}

export default useGeminiClient
