import { NextRequest, NextResponse } from 'next/server'
import { PythonBackendClient } from '@/lib/api/python-backend'
import { createClient } from '@/lib/supabase/server'
import { checkUsage, deductCredits } from '@/lib/services/usage-service'

/**
 * POST /api/aeo/company-analysis
 * Analyzes a website URL and extracts company context using Python backend.
 *
 * This route proxies to the Python backend's /api/v1/context/analyze endpoint
 * which uses Gemini with URL Context + Google Search grounding.
 */

export const maxDuration = 120 // Allow longer for AI analysis

// Initialize Python backend client
const pythonBackend = new PythonBackendClient({
  baseUrl: process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000',
  timeout: 120000, // 2 minutes for AI analysis
})

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 20 // requests per minute
const RATE_WINDOW_MS = 60 * 1000 // 1 minute

async function getSupabaseWithUser() {
  try {
    const supabase = await createClient()
    if (supabase) {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) {
        return { supabase, userId: data.user.id }
      }
    }
  } catch (error) {
    console.warn('[company-analysis] Failed to resolve Supabase user:', error)
  }

  return { supabase: null, userId: null }
}

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  // Clean up expired entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key)
      }
    }
  }

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: RATE_WINDOW_MS }
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now }
  }

  record.count++
  return { allowed: true, remaining: RATE_LIMIT - record.count, resetIn: record.resetTime - now }
}

// SSRF Protection: Validate URL
function validateUrl(input: string): { valid: boolean; url?: string; error?: string } {
  const normalized = input.trim().startsWith('http') ? input.trim() : `https://${input.trim()}`

  try {
    const url = new URL(normalized)

    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS URLs allowed' }
    }

    const hostname = url.hostname.toLowerCase()

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return { valid: false, error: 'Localhost URLs not allowed' }
    }

    // Block private IPs
    const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number)
      if (a === 10) return { valid: false, error: 'Private IP addresses not allowed' }
      if (a === 172 && b >= 16 && b <= 31) return { valid: false, error: 'Private IP addresses not allowed' }
      if (a === 192 && b === 168) return { valid: false, error: 'Private IP addresses not allowed' }
      if (a === 127) return { valid: false, error: 'Loopback addresses not allowed' }
    }

    // Block internal hostnames
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return { valid: false, error: 'Internal hostnames not allowed' }
    }

    return { valid: true, url: normalized }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = checkRateLimit(clientIp)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.', resetIn: Math.ceil(rateLimit.resetIn / 1000) },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { 
      url, 
      company_website, 
      client_id,
      system_instructions,
      client_knowledge_base,
      content_instructions,
      research_files,
      assets,
    } = body
    const websiteUrl = url || company_website

    if (!websiteUrl || typeof websiteUrl !== 'string' || websiteUrl.trim().length === 0) {
      return NextResponse.json(
        { error: 'URL or company_website is required' },
        { status: 400 }
      )
    }

    // Validate URL (SSRF protection)
    const urlValidation = validateUrl(websiteUrl)
    if (!urlValidation.valid || !urlValidation.url) {
      return NextResponse.json(
        { error: urlValidation.error || 'Invalid URL' },
        { status: 400 }
      )
    }

    console.log(`[company-analysis] Calling Python backend for: ${urlValidation.url}`)

    // Get user for credit check
    const { userId } = await getSupabaseWithUser()
    
    if (userId) {
      // Check usage limits before proceeding
      const usageCheck = await checkUsage(userId, 'analysis')
      if (!usageCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Credits exhausted',
            message: usageCheck.message || 'Not enough credits for company analysis. Please upgrade your plan.',
            remaining: usageCheck.remaining,
            upgrade: true,
          },
          { status: 429 }
        )
      }
    }

    // Build additional context for enhanced analysis
    const additionalContext: Record<string, any> = {}
    if (system_instructions) additionalContext.system_instructions = system_instructions
    if (client_knowledge_base) additionalContext.client_knowledge_base = client_knowledge_base
    if (content_instructions) additionalContext.content_instructions = content_instructions
    if (research_files?.length) additionalContext.research_files = research_files
    if (assets?.length) additionalContext.assets = assets
    
    const hasAdditionalContext = Object.keys(additionalContext).length > 0
    if (hasAdditionalContext) {
      console.log(`[company-analysis] Including user context: ${Object.keys(additionalContext).join(', ')}`)
    }

    // Call Python backend with additional context
    const result = await pythonBackend.analyzeContext(urlValidation.url, hasAdditionalContext ? additionalContext : undefined)

    console.log(`[company-analysis] Python backend returned: ${result.company_name || 'unknown'}, ai_called: ${result.ai_called}`)
    
    // Log what fields we received for debugging incomplete analyses
    const receivedFields = Object.entries(result)
      .filter(([_, v]) => v !== null && v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true))
      .map(([k]) => k)
    console.log(`[company-analysis] Received fields: ${receivedFields.join(', ')}`)

    // Check if AI analysis actually ran or fell back to basic detection
    const aiCalled = result.ai_called === true
    
    if (!aiCalled) {
      console.warn(`[company-analysis] AI analysis failed, fell back to basic detection for: ${urlValidation.url}`)
      return NextResponse.json(
        { 
          error: 'AI analysis failed', 
          message: 'Could not analyze this website. The AI service may be temporarily unavailable or the website may be blocking automated access. Please try again later.',
          fallback: true,
        },
        { status: 503 }
      )
    }

    // Transform response to match expected format
    const response = {
      company_name: result.company_name,
      company_url: result.company_url || urlValidation.url,
      industry: result.industry,
      description: result.description,
      products: result.products || [],
      services: result.services || [],
      target_audience: result.target_audience,
      target_audiences: result.target_audiences || [],
      competitors: result.competitors || [],
      competitor_categories: result.competitor_categories || [],
      primary_region: result.primary_region || '',
      primary_country: result.primary_country || 'US',
      primary_language: result.primary_language || 'en',
      tone: result.tone,
      pain_points: result.pain_points || [],
      value_propositions: result.value_propositions || [],
      use_cases: result.use_cases || [],
      content_themes: result.content_themes || [],
      voice_persona: result.voice_persona,
      visual_identity: result.visual_identity,
      authors: result.authors,
      eeat: result.eeat,
      gtm_playbook: result.gtm_playbook,
      product_type: result.product_type,
      ai_called: result.ai_called,
    }

    // Convert to camelCase for frontend consistency
    const fullContext = {
      companyName: response.company_name,
      companyWebsite: response.company_url,
      industry: response.industry,
      productDescription: response.description,
      products: Array.isArray(response.products) ? response.products.join(', ') : response.products,
      services: Array.isArray(response.services) ? response.services.join(', ') : response.services,
      targetAudience: response.target_audience,
      targetAudiences: response.target_audiences,
      competitors: Array.isArray(response.competitors) ? response.competitors.join(', ') : response.competitors,
      competitorsData: {
        direct: (response.competitors || []).map((name: string) => ({ name })),
        categories: response.competitor_categories || [],
      },
      primaryRegion: response.primary_region,
      primaryCountry: response.primary_country,
      primaryLanguage: response.primary_language,
      tone: response.tone,
      painPoints: Array.isArray(response.pain_points) ? response.pain_points.join(', ') : response.pain_points,
      valuePropositions: Array.isArray(response.value_propositions) ? response.value_propositions.join(', ') : response.value_propositions,
      useCases: Array.isArray(response.use_cases) ? response.use_cases.join(', ') : response.use_cases,
      contentThemes: Array.isArray(response.content_themes) ? response.content_themes.join(', ') : response.content_themes,
      voicePersona: response.voice_persona ? JSON.stringify(response.voice_persona) : undefined,
      visualIdentity: response.visual_identity,
      authors: response.authors,
      eeat: response.eeat,
      gtmPlaybook: response.gtm_playbook,
      productType: response.product_type,
    }

    let clientRecord: any = null

    try {
      // Reuse existing userId from credit check, just get supabase client
      const { supabase } = await getSupabaseWithUser()

      if (userId && supabase) {
        const clientData = {
          user_id: userId,
          name: response.company_name || urlValidation.url,
          website: response.company_url,
          industry: response.industry || null,
          brand_voice: response.tone || null,
          target_audience: response.target_audience || null,
          competitors: Array.isArray(response.competitors) ? response.competitors.join(', ') : null,
          products: Array.isArray(response.products) ? response.products.join(', ') : null,
          notes: JSON.stringify(fullContext),
          updated_at: new Date().toISOString(),
        }

        let result
        
        // If client_id is provided, update existing record
        // RLS ensures user can only update their own clients
        if (client_id) {
          console.log(`[company-analysis] Updating existing client: ${client_id}`)
          result = await supabase
            .from('clients')
            .update(clientData)
            .eq('id', client_id)
            .select('*')
            .single()
        } else {
          // Check if client with this website already exists (RLS filters to user's clients)
          const { data: existingByWebsite } = await supabase
            .from('clients')
            .select('id')
            .eq('website', response.company_url)
            .single()
          
          if (existingByWebsite) {
            // Update existing client by website
            console.log(`[company-analysis] Updating existing client by website: ${existingByWebsite.id}`)
            result = await supabase
              .from('clients')
              .update(clientData)
              .eq('id', existingByWebsite.id)
              .select('*')
              .single()
          } else {
            // Create new client (RLS INSERT policy validates user_id matches auth.uid())
            console.log(`[company-analysis] Creating new client: ${clientData.name}`)
            result = await supabase
              .from('clients')
              .insert(clientData)
              .select('*')
              .single()
          }
        }

        if (result.error) {
          console.error('[company-analysis] Failed to save client:', result.error)
        } else {
          clientRecord = result.data
        }
      }
    } catch (clientError) {
      console.error('[company-analysis] Error while saving client:', clientError)
    }

    // Deduct credits only after successful AI analysis
    // Note: We only reach here if ai_called is true (fallback cases return early with error)
    if (userId) {
      const deductResult = await deductCredits(userId, 'analysis', 1)
      if (deductResult.success) {
        console.log(`[company-analysis] Credits deducted: ${deductResult.creditsDeducted}, remaining: ${deductResult.creditsRemaining}`)
      } else {
        console.warn(`[company-analysis] Failed to deduct credits: ${deductResult.error}`)
      }
    }

    return NextResponse.json({ ...response, client: clientRecord })

  } catch (error) {
    console.error('[company-analysis] Error:', error)

    if (error instanceof Error) {
      // Check if it's a connection error to Python backend
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        return NextResponse.json(
          { error: 'Python backend is not available. Please ensure it is running on port 8000.' },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { error: 'Analysis failed', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Unknown error', details: String(error) },
      { status: 500 }
    )
  }
}
