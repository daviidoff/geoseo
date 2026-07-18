'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Globe, CheckCircle, Trash2, AlertTriangle, FileText, Sparkles, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useContextStorage } from '@/hooks/useContextStorage'
import { toast } from 'sonner'
// Assets and Research tabs hidden for now
// import { AssetsDumpTab } from './AssetsDumpTab'
// import { ResearchDumpTab } from './ResearchDumpTab'
import { CreditCostPreview } from '@/components/ui/credit-cost-preview'
import { PageWithTabs } from '@/components/layout/PageWithTabs'

function parseClientContext(client: any) {
  if (!client) return {}
  
  let context: Record<string, any> = {}
  
  if (client.context && typeof client.context === 'object') {
    context = client.context
  } else if (client.notes) {
    try {
      const parsed = typeof client.notes === 'string' ? JSON.parse(client.notes) : client.notes
      context = typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      console.error('[parseClientContext] Failed to parse notes for client:', client.name)
      return {}
    }
  }
  
  // Debug: log what fields are present in the parsed context
  const fields = Object.keys(context).filter(k => context[k] !== null && context[k] !== undefined && context[k] !== '')
  console.log(`[parseClientContext] ${client.name}: ${fields.length} fields - ${fields.slice(0, 10).join(', ')}${fields.length > 10 ? '...' : ''}`)
  
  // Convert snake_case to camelCase for legacy data compatibility
  const snakeToCamel: Record<string, string> = {
    'company_name': 'companyName',
    'company_url': 'companyWebsite',
    'target_audience': 'targetAudience',
    'pain_points': 'painPoints',
    'value_propositions': 'valuePropositions',
    'use_cases': 'useCases',
    'content_themes': 'contentThemes',
    'voice_persona': 'voicePersona',
    'visual_identity': 'visualIdentity',
    'gtm_playbook': 'gtmPlaybook',
    'product_type': 'productType',
    'competitor_categories': 'competitorCategories',
  }
  
  for (const [snake, camel] of Object.entries(snakeToCamel)) {
    if (context[snake] !== undefined && context[camel] === undefined) {
      context[camel] = context[snake]
    }
  }
  
  // Ensure voicePersona is a string (for JSON.parse later)
  if (context.voicePersona && typeof context.voicePersona === 'object') {
    context.voicePersona = JSON.stringify(context.voicePersona)
  } else if (context.voice_persona && typeof context.voice_persona === 'object') {
    context.voicePersona = JSON.stringify(context.voice_persona)
  }
  
  return context
}

// Helper function to get company domain from website URL
function getDomainFromUrl(url: string): string {
  try {
    const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
    return domain.replace('www.', '')
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
  }
}

// Helper component to render comma-separated text as badges
function BadgeList({ text }: { text: string | string[] | unknown }) {
  if (!text) return null
  
  // Handle different input types
  let items: string[] = []
  if (Array.isArray(text)) {
    items = text.filter(Boolean).map(item => String(item).trim())
  } else if (typeof text === 'string') {
    items = text.split(',').map(item => item.trim()).filter(Boolean)
  } else if (typeof text === 'object') {
    // Handle object - try to extract values
    items = Object.values(text).filter(v => typeof v === 'string').map(v => String(v).trim())
  }
  
  if (items.length === 0) return null
  
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span 
          key={index}
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs bg-muted/80 font-medium"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

// Helper component for competitor badges with enhanced logos
// Supports both legacy format (comma-separated string) and new format (object with direct + categories)
function CompetitorBadges({ text, data }: { text?: string, data?: any }) {
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({})

  // Handle legacy format (comma-separated string)
  const legacyCompetitors = text && typeof text === 'string' 
    ? text.split(',').map(item => item.trim()).filter(Boolean) 
    : []

  // Handle new format (object with direct competitors and categories)
  const directCompetitors = data?.direct || []
  const categories = data?.categories || []

  // Combine all for logo fetching
  const allCompetitorNames = [
    ...legacyCompetitors,
    ...directCompetitors.map((c: any) => c.name)
  ]

  // Fetch logos for direct competitors
  useEffect(() => {
    if (allCompetitorNames.length === 0) return

    const fetchLogos = async () => {
      const logoPromises = allCompetitorNames.map(async (name) => {
        // Try to get URL from direct competitor object
        const competitorObj = directCompetitors.find((c: any) => c.name === name)
        const domain = competitorObj?.url || (name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') + '.com')

        try {
          const response = await fetch(`/api/brands/logo?domain=${domain}`)
          const data = await response.json()
          return { name, logoUrl: data.logoUrl }
        } catch (error) {
          return {
            name,
            logoUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
          }
        }
      })

      const results = await Promise.all(logoPromises)
      const logoMap = results.reduce((acc, { name, logoUrl }) => {
        acc[name] = logoUrl
        return acc
      }, {} as Record<string, string>)

      setLogoUrls(logoMap)
    }

    fetchLogos()
  }, [text, data])

  if (legacyCompetitors.length === 0 && directCompetitors.length === 0 && categories.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Direct Competitors - specific companies */}
      {(directCompetitors.length > 0 || legacyCompetitors.length > 0) && (
        <div>
          {categories.length > 0 && (
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Direct Competitors</p>
          )}
          <div className="flex flex-wrap gap-2">
            {(directCompetitors.length > 0 ? directCompetitors : legacyCompetitors.map((name: string) => ({ name }))).map((competitor: any, index: number) => {
              const name = competitor.name || competitor
              const logoUrl = logoUrls[name] || `https://www.google.com/s2/favicons?domain=${competitor.url || (name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') + '.com')}&sz=32`

              return (
                <span
                  key={index}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-muted/70 font-medium cursor-default hover:bg-muted transition-colors border border-border/50"
                  title={competitor.description}
                >
                  <img
                    src={logoUrl}
                    alt={`${name} logo`}
                    className="w-4 h-4 rounded-sm"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  {name}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Competitor Categories - types of competing solutions */}
      {categories.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Alternative Solutions</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((category: string, index: number) => (
              <span
                key={index}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium cursor-default border border-amber-500/20"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                {category}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Context Form Component
 * Allows users to analyze a website domain to extract company context
 * Now organized into tabs for easier navigation
 */

export function ContextForm() {
  const { businessContext, updateContext, replaceContext, clearContext, switchClient, hasContext, isLoading } = useContextStorage()
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [analyzedUrl, setAnalyzedUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showClearConfirmation, setShowClearConfirmation] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [savedCompanies, setSavedCompanies] = useState<any[]>([])
  
  // Ref for aborting analysis request
  const abortControllerRef = useRef<AbortController | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const EXPECTED_ANALYSIS_TIME = 30 // seconds for Gemini 3 Pro Preview
  
  // Set analyzed URL from context when loaded (from Supabase)
  useEffect(() => {
    if (hasContext && businessContext.companyWebsite) {
      setAnalyzedUrl(businessContext.companyWebsite)
    }
  }, [hasContext, businessContext.companyWebsite])

  // Load saved companies from Supabase via API
  // Use ref to track if we've already auto-loaded context
  const hasAutoLoadedRef = useRef(false)
  
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('/api/clients', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error('Failed to load companies')
        }

        const data = await response.json()
        const companies = (data?.clients || []).map((client: any) => ({
          id: client.id,
          name: client.name,
          context: parseClientContext(client),
          createdAt: client.created_at,
        }))

        setSavedCompanies(companies)

        // Auto-load first company if no context and we haven't already
        if (!hasAutoLoadedRef.current && !hasContext && companies.length > 0 && companies[0]?.id) {
          hasAutoLoadedRef.current = true
          console.log('[ContextForm] Auto-loading first company from Supabase:', companies[0].name)
          switchClient(companies[0].id)
          setWebsiteUrl(companies[0].context?.companyWebsite || '')
        }
      } catch (error) {
        console.error('[ContextForm] Failed to load companies:', error)
      }
    }

    fetchCompanies()
  }, []) // Only run on mount
  
  // Re-run when hasContext changes to false (e.g., after sign out/in)
  useEffect(() => {
    if (!hasContext && savedCompanies.length > 0 && savedCompanies[0]?.context) {
      console.log('[ContextForm] Restoring context from saved companies:', savedCompanies[0].name)
      updateContext(savedCompanies[0].context)
      setWebsiteUrl(savedCompanies[0].context.companyWebsite || '')
    }
  }, [hasContext, savedCompanies, updateContext])

  // Auto-populate websiteUrl from businessContext when available
  useEffect(() => {
    if (businessContext?.companyWebsite && !websiteUrl) {
      setWebsiteUrl(businessContext.companyWebsite)
    }
  }, [businessContext?.companyWebsite, websiteUrl])

  const handleAnalyzeWebsite = useCallback(async (urlOverride?: string, clientIdOverride?: string) => {
    const urlToAnalyze = urlOverride || websiteUrl.trim()
    if (!urlToAnalyze) {
      toast.error('Please enter a website URL')
      return
    }
    
    // Update the input field if using override
    if (urlOverride && urlOverride !== websiteUrl) {
      setWebsiteUrl(urlOverride)
    }
    
    // Find existing client ID for re-analysis (update instead of create)
    const existingClientId = clientIdOverride || savedCompanies.find(
      c => c.context?.companyWebsite === urlToAnalyze || c.website === urlToAnalyze
    )?.id

    // Server will handle API key from GEMINI_API_KEY environment variable

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()
    
    setIsAnalyzing(true)
    setAnalysisProgress(0)
    setTimeRemaining(EXPECTED_ANALYSIS_TIME)
    
    // Start progress timer
    const startTime = Date.now()
    progressIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      const progress = Math.min((elapsed / EXPECTED_ANALYSIS_TIME) * 100, 95) // Cap at 95% until complete
      const remaining = Math.max(EXPECTED_ANALYSIS_TIME - Math.floor(elapsed), 0)
      
      setAnalysisProgress(progress)
      setTimeRemaining(remaining)
    }, 100)
    
    try {
      // Call company analysis API endpoint (uses Modal aeo-checks service)
      const requestBody: Record<string, any> = {
        company_name: businessContext?.companyName || 'Unknown Company',
        company_website: urlToAnalyze,
      }
      
      // If re-analyzing, pass client_id to update existing record
      if (existingClientId) {
        requestBody.client_id = existingClientId
        console.log('[ContextForm] Re-analyzing existing company:', existingClientId)
      }
      
      // Include user-provided context for enhanced analysis
      if (businessContext?.systemInstructions) {
        requestBody.system_instructions = businessContext.systemInstructions
      }
      if (businessContext?.clientKnowledgeBase) {
        requestBody.client_knowledge_base = businessContext.clientKnowledgeBase
      }
      if (businessContext?.contentInstructions) {
        requestBody.content_instructions = businessContext.contentInstructions
      }
      // Include research files (text content only)
      if (businessContext?.researchFiles && businessContext.researchFiles.length > 0) {
        requestBody.research_files = businessContext.researchFiles
          .filter(f => f.fullTextContent)
          .map(f => ({ name: f.name, content: f.fullTextContent }))
      }
      // Include asset descriptions
      if (businessContext?.assets && businessContext.assets.length > 0) {
        requestBody.assets = businessContext.assets
          .filter(f => f.aiAnalysis || f.fullDescription)
          .map(f => ({ name: f.name, description: f.aiAnalysis || f.fullDescription }))
      }
      
      const response = await fetch('/api/aeo/company-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to analyze website' }))
        throw new Error(error.message || error.error || 'Failed to analyze website')
      }

      const data = await response.json()

      // Map the simplified response to our context structure
      const contextUpdates: Record<string, any> = {}
      
      // Core info
      if (data.company_name) contextUpdates.companyName = data.company_name
      if (data.company_url) contextUpdates.companyWebsite = data.company_url
      if (data.description) contextUpdates.productDescription = data.description
      if (data.industry) contextUpdates.targetIndustries = data.industry
      if (data.target_audience) contextUpdates.targetAudience = data.target_audience
      if (data.tone) contextUpdates.brandTone = data.tone
      
      // Products/services as comma-separated list
      if (data.products && Array.isArray(data.products) && data.products.length > 0) {
        contextUpdates.products = data.products.join(', ')
      }
      
      // Competitors - handle split format (competitors + competitor_categories)
      const hasCompetitors = data.competitors && Array.isArray(data.competitors) && data.competitors.length > 0
      const hasCategories = data.competitor_categories && Array.isArray(data.competitor_categories) && data.competitor_categories.length > 0

      if (hasCompetitors || hasCategories) {
        // Build competitorsData in the UI format { direct: [...], categories: [...] }
        contextUpdates.competitorsData = {
          direct: hasCompetitors ? data.competitors.map((name: string) => ({ name })) : [],
          categories: hasCategories ? data.competitor_categories : []
        }
        // Also create legacy string format for compatibility
        const allNames = [
          ...(hasCompetitors ? data.competitors : []),
          ...(hasCategories ? data.competitor_categories : [])
        ]
        if (allNames.length > 0) {
          contextUpdates.competitors = allNames.join(', ')
        }
      } else if (data.competitors && typeof data.competitors === 'object' && !Array.isArray(data.competitors)) {
        // Legacy nested format with { direct: [...], categories: [...] }
        contextUpdates.competitorsData = data.competitors
        const allNames = [
          ...(data.competitors.direct?.map((c: any) => c.name) || []),
          ...(data.competitors.categories || [])
        ]
        if (allNames.length > 0) {
          contextUpdates.competitors = allNames.join(', ')
        }
      }
      
      // Pain points as comma-separated list
      if (data.pain_points && Array.isArray(data.pain_points) && data.pain_points.length > 0) {
        contextUpdates.painPoints = data.pain_points.join(', ')
      }
      
      // Value propositions as comma-separated list
      if (data.value_propositions && Array.isArray(data.value_propositions) && data.value_propositions.length > 0) {
        contextUpdates.valuePropositions = data.value_propositions.join(', ')
      }
      
      // Use cases as comma-separated list
      if (data.use_cases && Array.isArray(data.use_cases) && data.use_cases.length > 0) {
        contextUpdates.useCases = data.use_cases.join(', ')
      }
      
      // Content themes as comma-separated list
      if (data.content_themes && Array.isArray(data.content_themes) && data.content_themes.length > 0) {
        contextUpdates.contentThemes = data.content_themes.join(', ')
      }

      // Voice persona (store as JSON string for now - can be expanded later)
      if (data.voice_persona && typeof data.voice_persona === 'object') {
        contextUpdates.voicePersona = JSON.stringify(data.voice_persona)
      }

      // Primary market location (for keyword/blog defaults)
      if (data.primary_region) {
        contextUpdates.primaryRegion = data.primary_region
      }
      if (data.primary_country) {
        contextUpdates.primaryCountry = data.primary_country
      }
      if (data.primary_language) {
        contextUpdates.primaryLanguage = data.primary_language
      }

      // When analyzing a NEW company (not re-analyzing existing), clear old context first
      // to prevent data from previous company (e.g., Discord) bleeding into new analysis
      if (!existingClientId) {
        // Clear AI-extracted fields that should be replaced for new company
        clearContext()
      }
      
      updateContext(contextUpdates)

      const fullContext = existingClientId 
        ? { ...businessContext, ...contextUpdates }
        : contextUpdates // Use only new context for new companies

      // Persist and refresh local list using server response
      const clientRecord = data.client
        ? { ...data.client, context: fullContext }
        : null

      setSavedCompanies(prev => {
        const existingIndex = clientRecord
          ? prev.findIndex((c: any) => c.id === clientRecord.id)
          : prev.findIndex((c: any) => c.name?.toLowerCase() === contextUpdates.companyName?.toLowerCase())

        const updatedEntry = clientRecord || {
          id: existingIndex >= 0 ? prev[existingIndex].id : 'company-' + Date.now(),
          name: contextUpdates.companyName,
          context: fullContext,
          createdAt: existingIndex >= 0 ? prev[existingIndex].createdAt : new Date().toISOString()
        }

        if (existingIndex >= 0) {
          const clone = [...prev]
          clone[existingIndex] = updatedEntry
          return clone
        }

        return [updatedEntry, ...prev]
      })

      // Store the analyzed URL (now saved in Supabase via context)
      const normalizedUrl = websiteUrl.trim().startsWith('http') ? websiteUrl.trim() : `https://${websiteUrl.trim()}`
      setAnalyzedUrl(normalizedUrl)

      // Complete progress
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      setAnalysisProgress(100)
      setTimeRemaining(0)

      // Log to History (Supabase) as a context run
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'context',
            company: contextUpdates.companyName || businessContext?.companyName || urlToAnalyze,
            url: contextUpdates.companyWebsite || urlToAnalyze,
            payload: {
              language: contextUpdates.primaryLanguage || businessContext?.primaryLanguage || '',
              country: contextUpdates.primaryCountry || businessContext?.primaryCountry || '',
              products: contextUpdates.products || '',
              competitors: contextUpdates.competitors || '',
              painPoints: contextUpdates.painPoints || '',
              useCases: contextUpdates.useCases || '',
              source: 'context-analysis',
            },
          }),
        })
      } catch (err) {
        console.warn('[ContextForm] Failed to write history log:', err)
      }

      toast.success('Website analyzed successfully')
    } catch (error) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      
      // Check if it was cancelled by user
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Analysis cancelled by user')
        setAnalysisProgress(0)
        setTimeRemaining(0)
        toast.info('Analysis cancelled')
      } else {
        console.error('Analysis error:', error)
        setAnalysisProgress(0)
        setTimeRemaining(0)
        toast.error(error instanceof Error ? error.message : 'Failed to analyze website')
      }
    } finally {
      setIsAnalyzing(false)
      abortControllerRef.current = null
    }
  }, [websiteUrl, updateContext, businessContext, savedCompanies])

  const handleCancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
  }, [])

  const handleClearAll = useCallback(async () => {
    const currentCompany = savedCompanies.find(
      company => company.name?.toLowerCase() === businessContext?.companyName?.toLowerCase()
    )

    if (currentCompany?.id) {
      try {
        await fetch(`/api/clients?id=${currentCompany.id}`, { method: 'DELETE' })
        
        // Get remaining companies after deletion
        const remainingCompanies = savedCompanies.filter(company => company.id !== currentCompany.id)
        setSavedCompanies(remainingCompanies)
        
        // If there are other companies, switch to the first one instead of clearing
        if (remainingCompanies.length > 0) {
          const nextCompany = remainingCompanies[0]
          switchClient(nextCompany.id)
          toast.success(`Deleted ${currentCompany.name}. Switched to ${nextCompany.name}`)
          setShowClearConfirmation(false)
          return
        }
      } catch (error) {
        console.error('[ContextForm] Failed to delete company:', error)
        toast.error('Failed to delete company')
        return
      }
    }

    // Only clear context if no companies remain
    clearContext()
    setAnalyzedUrl(null)
    setShowClearConfirmation(false)
    toast.success('Context cleared')
  }, [clearContext, updateContext, savedCompanies, businessContext?.companyName])



  if (isLoading) {
    return (
      <div className="h-full flex bg-background">
        {/* Sidebar Skeleton */}
        <div className="w-72 border-r border-border bg-background flex-shrink-0 overflow-y-auto">
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted/60 rounded animate-pulse w-2/3" />
            </div>
            <div className="space-y-3">
              <div className="h-16 bg-muted rounded animate-pulse" />
              <div className="h-16 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
        
        {/* Main Content Skeleton */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="space-y-6">
              <div className="h-10 bg-muted rounded animate-pulse" />
              <div className="space-y-4">
                <div className="h-32 bg-muted rounded animate-pulse" />
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="h-20 bg-muted rounded animate-pulse" />
                  <div className="h-20 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex relative">
      {/* Subtle top accent bar matching Keywords page */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500/60 via-blue-500/60 to-purple-500/60 z-10" />

      {/* Left Sidebar - Company Profile Switcher */}
      <div className="w-72 border-r border-border/60 bg-card flex-shrink-0 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Company Profiles</h2>
            <p className="text-xs text-muted-foreground/70">
              {savedCompanies.length > 0 ? `${savedCompanies.length} saved` : 'No profiles yet'}
            </p>
          </div>
          
          {/* Company List */}
          {savedCompanies.length > 0 && (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {/* Current company first - visually dominant */}
              {savedCompanies
                .filter((company: any) => businessContext?.companyName === company.name)
                .map((company: any) => (
                <button
                  key={company.id}
                  onClick={() => {
                    console.log('[ContextForm] Switching to company:', company.name, 'with context:', company.context)

                    // Warn if voice persona is missing
                    if (!company.context.voicePersona) {
                      console.warn('[ContextForm] Company missing voice persona - may need re-analysis:', company.name)
                      toast.warning(`${company.name} needs re-analysis to get voice persona`, { duration: 5000 })
                    }

                    // Switch client in Supabase and update local state
                    switchClient(company.id)
                    // Clear URL input to prevent using stale URL on re-analyze
                    setWebsiteUrl('')
                    toast.success(`Switched to ${company.name}`)
                  }}
                  className="w-full text-left p-4 rounded-lg bg-muted/40 border border-border/60 cursor-pointer hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="font-medium text-sm text-foreground">{company.name}</div>
                  </div>
                  <div className="text-xs text-muted-foreground pl-4">
                    {company.context?.companyWebsite || 'No website'}
                  </div>
                </button>
              ))}
              
              {/* Other companies - faded */}
              {savedCompanies
                .filter((company: any) => businessContext?.companyName !== company.name)
                .map((company: any) => (
                <button
                  key={company.id}
                  onClick={() => {
                    console.log('[ContextForm] Switching to company:', company.name, 'with context:', company.context)

                    // Warn if voice persona is missing
                    if (!company.context.voicePersona) {
                      console.warn('[ContextForm] Company missing voice persona - may need re-analysis:', company.name)
                      toast.warning(`${company.name} needs re-analysis to get voice persona`, { duration: 5000 })
                    }

                    // Switch client in Supabase and update local state
                    switchClient(company.id)
                    // Clear URL input to prevent using stale URL on re-analyze
                    setWebsiteUrl('')
                    toast.success(`Switched to ${company.name}`)
                  }}
                  className="w-full text-left p-3 rounded-md hover:bg-background/60 transition-colors cursor-pointer opacity-70 hover:opacity-100"
                >
                  <div className="font-medium text-sm text-muted-foreground">{company.name}</div>
                  <div className="text-xs text-muted-foreground/70 mt-1">
                    {company.context?.companyWebsite || 'No website'}
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* Add Company Form */}
          <div className="space-y-4 pt-4 border-t border-border/60">
            <div className="space-y-3">
              <Input
              type="text"
              placeholder="scaile.tech"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAnalyzing && websiteUrl.trim()) {
                    handleAnalyzeWebsite()
                  }
                }}
                disabled={isAnalyzing}
                className="border-0 bg-muted/50 focus:bg-muted/70"
              />
              
              {/* Credit Cost Preview */}
              <div className="flex items-center justify-center">
                <CreditCostPreview 
                  serviceType="COMPANY_ANALYSIS" 
                  compact={true}
                  showBalance={false}
                  className="text-xs"
                />
              </div>
              
              <Button
                onClick={() => handleAnalyzeWebsite()}
                disabled={!websiteUrl.trim() || isAnalyzing}
                className="w-full cursor-pointer"
                variant="outline"
              >
                {isAnalyzing ? 'Analyzing...' : 'Add Company'}
              </Button>
            </div>
            
            {/* Progress indicator */}
            {isAnalyzing && (
              <div className="space-y-3">
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {timeRemaining > 0 ? `${timeRemaining}s remaining` : 'Almost done...'}
                </p>
                <Button
                  onClick={handleCancelAnalysis}
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground hover:text-destructive"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="bg-card">
          <PageWithTabs
          defaultValue="analyze"
          tabs={[
            {
              value: 'analyze',
              label: 'Analyze Website',
              icon: <Globe className="h-3.5 w-3.5" />,
              content: (
                <>
                  {hasContext ? (
                  <div className="space-y-6">
                    {/* Borderless Entity Header */}
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              {businessContext?.companyWebsite && (
                                <img
                                  src={`https://www.google.com/s2/favicons?domain=${getDomainFromUrl(businessContext.companyWebsite)}&sz=32`}
                                  alt={`${businessContext?.companyName} logo`}
                                  className="w-8 h-8 rounded-md"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              )}
                              <h1 className="text-2xl font-semibold tracking-tight">
                                {businessContext?.companyName}
                              </h1>
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={() => {
                                    // Always use stored company website for re-analysis (not the input field which may be stale)
                                    const urlToUse = businessContext?.companyWebsite
                                    // Find current company's ID for update
                                    const currentClientId = savedCompanies.find(
                                      c => c.name?.toLowerCase() === businessContext?.companyName?.toLowerCase()
                                    )?.id
                                    if (urlToUse) {
                                      handleAnalyzeWebsite(urlToUse, currentClientId)
                                    }
                                  }}
                                  disabled={!businessContext?.companyWebsite || isAnalyzing}
                                  size="sm"
                                  variant="outline"
                                  className="cursor-pointer"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                  Re-analyze
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setShowClearConfirmation(true)}
                                  className="cursor-pointer h-8 w-8"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {businessContext?.companyWebsite && (
                                <a 
                                  href={businessContext.companyWebsite} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5"
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                  {businessContext.companyWebsite}
                                </a>
                              )}
                              
                              {businessContext?.linkedInUrl && (
                                <a 
                                  href={businessContext.linkedInUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5"
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                  </svg>
                                  LinkedIn
                                </a>
                              )}
                              
                              {businessContext?.contactEmail && (
                                <a 
                                  href={`mailto:${businessContext.contactEmail}`}
                                  className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5"
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="m4 4 16 0c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                    <polyline points="22,6 12,13 2,6"/>
                                  </svg>
                                  {businessContext.contactEmail}
                                </a>
                              )}
                            </div>
                          </div>
                          {businessContext.productDescription && (
                            <p className="text-base leading-relaxed text-muted-foreground max-w-2xl">
                              {businessContext.productDescription}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Competitors right under header */}
                      {(businessContext.competitors || businessContext.competitorsData || businessContext.competitorKeywords) && (
                        <div className="pt-4">
                          <h3 className="text-sm font-medium text-foreground mb-2">Competitors</h3>
                          <CompetitorBadges
                            text={businessContext.competitors}
                            data={businessContext.competitorsData}
                          />
                          {!businessContext.competitors && !businessContext.competitorsData && businessContext.competitorKeywords && (
                            <BadgeList text={Array.isArray(businessContext.competitorKeywords) ? businessContext.competitorKeywords.join(', ') : businessContext.competitorKeywords} />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border/40 pt-6"></div>

                    {/* Content Sections with Grid Lines */}
                    <div className="grid gap-0">
                      {/* 1. Overview Section */}
                      {(businessContext.targetIndustries || businessContext.targetAudience) && (
                        <div className="border-b border-border/30 pb-6 mb-6">
                          <h2 className="text-lg font-medium tracking-tight text-foreground mb-4">Overview</h2>
                          <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 relative">
                            {businessContext.targetIndustries && (
                              <div className="relative">
                                <dt className="text-sm font-medium text-foreground mb-2">Industry</dt>
                                <dd className="text-sm text-muted-foreground leading-relaxed">
                                  {businessContext.targetIndustries}
                                </dd>
                              </div>
                            )}
                            
                            {/* Vertical divider line */}
                            {businessContext.targetIndustries && businessContext.targetAudience && (
                              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30 transform -translate-x-1/2 hidden md:block"></div>
                            )}
                            
                            {businessContext.targetAudience && (
                              <div className="relative">
                                <dt className="text-sm font-medium text-foreground mb-2">Target Audience</dt>
                                <dd className="text-sm text-muted-foreground leading-relaxed">
                                  {(() => {
                                    const audience = businessContext.targetAudience as unknown
                                    if (typeof audience === 'string') {
                                      return audience.split(',').map(item => item.trim()).join(' • ')
                                    }
                                    if (Array.isArray(audience)) {
                                      return audience.join(' • ')
                                    }
                                    return String(audience)
                                  })()}
                                </dd>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* 2. Products & Services Section */}
                      {businessContext.products && (
                        <div className="border-b border-border/30 pb-6 mb-6">
                          <h2 className="text-lg font-medium tracking-tight text-foreground mb-4">Products & Services</h2>
                          <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 relative">
                            {(() => {
                              const products = businessContext.products
                              const productArray: string[] = Array.isArray(products)
                                ? products
                                : typeof products === 'string'
                                  ? (products as string).split(',')
                                  : []
                              return productArray.map((product, index) => (
                                <div key={index} className="flex items-start gap-3 text-sm">
                                  <span className="text-muted-foreground mt-1 text-xs">•</span>
                                  <span className="leading-relaxed text-foreground">{typeof product === 'string' ? product.trim() : product}</span>
                                </div>
                              ))
                            })()}
                            {/* Vertical divider for products */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30 transform -translate-x-1/2 hidden md:block"></div>
                          </div>
                        </div>
                      )}
                      
                      {/* 3. Pain Points Section - Emotional Weight */}
                      {businessContext.painPoints && (
                        <div className="border-b border-border/30 pb-6 mb-6">
                          <h2 className="text-lg font-medium tracking-tight text-foreground mb-4">Pain Points</h2>
                          <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 relative">
                            {(typeof businessContext.painPoints === 'string' 
                              ? businessContext.painPoints.split(',') 
                              : Array.isArray(businessContext.painPoints) 
                                ? businessContext.painPoints 
                                : []
                            ).map((point, index) => (
                              <div key={index} className="flex items-start gap-3 text-sm">
                                <span className="text-red-500 mt-1 text-xs font-bold">▸</span>
                                <span className="leading-relaxed text-foreground font-medium">{typeof point === 'string' ? point.trim() : String(point)}</span>
                              </div>
                            ))}
                            {/* Vertical divider for pain points */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30 transform -translate-x-1/2 hidden md:block"></div>
                          </div>
                        </div>
                      )}
                      
                      {/* 4. Value Propositions Section */}
                      {(businessContext.valuePropositions || businessContext.valueProposition) && (
                        <div className="border-b border-border/30 pb-6 mb-6">
                          <h2 className="text-lg font-medium tracking-tight text-foreground mb-4">Value Propositions</h2>
                          <div className="grid md:grid-cols-2 gap-x-8 gap-y-3 relative">
                            {businessContext.valuePropositions ? 
                              (typeof businessContext.valuePropositions === 'string'
                                ? businessContext.valuePropositions.split(',')
                                : Array.isArray(businessContext.valuePropositions)
                                  ? businessContext.valuePropositions
                                  : []
                              ).map((prop, index) => (
                                <div key={index} className="flex items-start gap-3 text-sm">
                                  <span className="text-green-500 mt-1.5 text-xs">•</span>
                                  <span className="leading-relaxed text-foreground">{typeof prop === 'string' ? prop.trim() : String(prop)}</span>
                                </div>
                              )) :
                              <div className="flex items-start gap-3 text-sm">
                                <span className="text-green-500 mt-1.5 text-xs">•</span>
                                <span className="leading-relaxed text-foreground">{businessContext.valueProposition}</span>
                              </div>
                            }
                            {/* Vertical divider for value props */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30 transform -translate-x-1/2 hidden md:block"></div>
                          </div>
                        </div>
                      )}
                      
                      {/* 5. Target Keywords Section */}
                      {businessContext.targetKeywords && businessContext.targetKeywords.length > 0 && (
                        <div className="border-b border-border/30 pb-6 mb-6">
                          <h2 className="text-lg font-medium tracking-tight text-foreground mb-4">Target Keywords</h2>
                          <div className="grid md:grid-cols-2 gap-x-8 gap-y-3 relative">
                            <BadgeList text={Array.isArray(businessContext.targetKeywords) ? businessContext.targetKeywords.join(', ') : businessContext.targetKeywords} />
                            {/* Vertical divider for keywords */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30 transform -translate-x-1/2 hidden md:block"></div>
                          </div>
                        </div>
                      )}
                      
                      {/* 6. Marketing Goals Section */}
                      {businessContext.marketingGoals && businessContext.marketingGoals.length > 0 && (
                        <div className="border-b border-border/30 pb-6 mb-6">
                          <h2 className="text-lg font-medium tracking-tight text-foreground mb-4">Marketing Goals</h2>
                          <div className="grid md:grid-cols-2 gap-x-8 gap-y-3 relative">
                            <BadgeList text={Array.isArray(businessContext.marketingGoals) ? businessContext.marketingGoals.join(', ') : businessContext.marketingGoals} />
                            {/* Vertical divider for goals */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30 transform -translate-x-1/2 hidden md:block"></div>
                          </div>
                        </div>
                      )}

                      {/* 7. Use Cases Section */}
                      {businessContext.useCases && (
                        <div className="border-b border-border/30 pb-6 mb-6">
                          <h2 className="text-lg font-medium tracking-tight text-foreground mb-4">Use Cases</h2>
                          <div className="grid md:grid-cols-2 gap-x-8 gap-y-3 relative">
                            {(typeof businessContext.useCases === 'string'
                              ? businessContext.useCases.split(',')
                              : Array.isArray(businessContext.useCases)
                                ? businessContext.useCases
                                : []
                            ).map((useCase, index) => (
                              <div key={index} className="flex items-start gap-3 text-sm">
                                <span className="text-blue-500 mt-1.5 text-xs">•</span>
                                <span className="leading-relaxed text-foreground">{typeof useCase === 'string' ? useCase.trim() : String(useCase)}</span>
                              </div>
                            ))}
                            {/* Vertical divider for use cases */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30 transform -translate-x-1/2 hidden md:block"></div>
                          </div>
                        </div>
                      )}
                      
                      {/* 9. Content Themes Section */}
                      {businessContext.contentThemes && businessContext.contentThemes.length > 0 && (
                        <div className="border-b border-border/30 pb-6 mb-6">
                          <h2 className="text-lg font-medium tracking-tight text-foreground mb-4">Content Themes</h2>
                          <div className="grid md:grid-cols-2 gap-x-8 gap-y-3 relative">
                            <BadgeList text={Array.isArray(businessContext.contentThemes) ? businessContext.contentThemes.join(', ') : businessContext.contentThemes} />
                            {/* Vertical divider for content themes */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30 transform -translate-x-1/2 hidden md:block"></div>
                          </div>
                        </div>
                      )}
                      
                      {/* 10. Brand Tone & Voice Section */}
                      {businessContext.tone && (
                        <div className="border-b border-border/30 pb-6 mb-6">
                          <h2 className="text-lg font-medium tracking-tight text-foreground mb-4">Brand Tone & Voice</h2>
                          <div className="text-sm text-foreground bg-muted/30 rounded-lg p-4">
                            {businessContext.tone}
                          </div>
                        </div>
                      )}

                      {/* 11. Voice Persona Section */}
                      {!businessContext.voicePersona && businessContext.companyName && (
                        <div className="border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 rounded-lg p-4 mb-6">
                          <div className="flex items-start gap-3">
                            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">Voice Persona Available</h3>
                              <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                                This company was analyzed before Voice Persona was added. Re-analyze to get AI-generated writing guidelines tailored to your target audience.
                              </p>
                              <button
                                onClick={() => setIsAnalyzing(true)}
                                className="text-xs font-medium text-amber-900 dark:text-amber-100 hover:underline"
                              >
                                Click "Re-analyze" button above →
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {businessContext.voicePersona && (() => {
                        try {
                          const persona = typeof businessContext.voicePersona === 'string'
                            ? JSON.parse(businessContext.voicePersona)
                            : businessContext.voicePersona

                          return (
                            <div className="border-b border-border/30 pb-6 mb-6">
                              <h2 className="text-lg font-medium tracking-tight text-foreground mb-4">Voice Persona</h2>
                              <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 relative">
                                {/* ICP Profile */}
                                {persona.icp_profile && (
                                  <div className="relative">
                                    <dt className="text-sm font-medium text-foreground mb-2">ICP Profile</dt>
                                    <dd className="text-sm text-muted-foreground leading-relaxed">
                                      {persona.icp_profile}
                                    </dd>
                                  </div>
                                )}

                                {/* Voice Style */}
                                {persona.voice_style && (
                                  <div className="relative">
                                    <dt className="text-sm font-medium text-foreground mb-2">Voice Style</dt>
                                    <dd className="text-sm text-muted-foreground leading-relaxed">
                                      {persona.voice_style}
                                    </dd>
                                  </div>
                                )}

                                {/* Language Style */}
                                {persona.language_style && (
                                  <div className="relative">
                                    <dt className="text-sm font-medium text-foreground mb-2">Language Style</dt>
                                    <dd className="text-sm text-muted-foreground leading-relaxed">
                                      {[
                                        persona.language_style.formality && `Formality: ${persona.language_style.formality}`,
                                        persona.language_style.complexity && `Complexity: ${persona.language_style.complexity}`,
                                        persona.language_style.sentence_length && `Sentence Length: ${persona.language_style.sentence_length}`,
                                        persona.language_style.perspective && `Perspective: ${persona.language_style.perspective}`
                                      ].filter(Boolean).join(' • ')}
                                    </dd>
                                  </div>
                                )}

                                {/* Vocabulary Level */}
                                {persona.vocabulary_level && (
                                  <div className="relative">
                                    <dt className="text-sm font-medium text-foreground mb-2">Vocabulary Level</dt>
                                    <dd className="text-sm text-muted-foreground leading-relaxed">
                                      {persona.vocabulary_level}
                                    </dd>
                                  </div>
                                )}

                                {/* Sentence Patterns */}
                                {persona.sentence_patterns?.length > 0 && (
                                  <div className="relative">
                                    <dt className="text-sm font-medium text-foreground mb-2">Sentence Patterns</dt>
                                    <dd className="space-y-2">
                                      {persona.sentence_patterns.map((pattern: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                          <span className="text-muted-foreground mt-1 text-xs">•</span>
                                          <span className="leading-relaxed text-muted-foreground">{pattern}</span>
                                        </div>
                                      ))}
                                    </dd>
                                  </div>
                                )}

                                {/* Authority Signals */}
                                {persona.authority_signals?.length > 0 && (
                                  <div className="relative">
                                    <dt className="text-sm font-medium text-foreground mb-2">Authority Signals</dt>
                                    <dd className="space-y-2">
                                      {persona.authority_signals.map((signal: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                          <span className="text-muted-foreground mt-1 text-xs">•</span>
                                          <span className="leading-relaxed text-muted-foreground">{signal}</span>
                                        </div>
                                      ))}
                                    </dd>
                                  </div>
                                )}

                                {/* Opening Styles */}
                                {persona.opening_styles?.length > 0 && (
                                  <div className="relative">
                                    <dt className="text-sm font-medium text-foreground mb-2">Opening Styles</dt>
                                    <dd className="space-y-2">
                                      {persona.opening_styles.map((style: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                          <span className="text-muted-foreground mt-1 text-xs">•</span>
                                          <span className="leading-relaxed text-muted-foreground">{style}</span>
                                        </div>
                                      ))}
                                    </dd>
                                  </div>
                                )}

                                {/* Example Phrases */}
                                {persona.example_phrases?.length > 0 && (
                                  <div className="relative">
                                    <dt className="text-sm font-medium text-foreground mb-2">Example Phrases</dt>
                                    <dd className="space-y-2">
                                      {persona.example_phrases.map((phrase: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                          <span className="text-muted-foreground mt-1 text-xs">•</span>
                                          <span className="leading-relaxed text-muted-foreground">"{phrase}"</span>
                                        </div>
                                      ))}
                                    </dd>
                                  </div>
                                )}

                                {/* Do's */}
                                {persona.do_list?.length > 0 && (
                                  <div className="relative">
                                    <dt className="text-sm font-medium text-foreground mb-2">Do's</dt>
                                    <dd className="space-y-2">
                                      {persona.do_list.map((item: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                          <span className="text-green-500 mt-1 text-xs">•</span>
                                          <span className="leading-relaxed text-muted-foreground">{item}</span>
                                        </div>
                                      ))}
                                    </dd>
                                  </div>
                                )}

                                {/* Don'ts */}
                                {persona.dont_list?.length > 0 && (
                                  <div className="relative">
                                    <dt className="text-sm font-medium text-foreground mb-2">Don'ts</dt>
                                    <dd className="space-y-2">
                                      {persona.dont_list.map((item: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                          <span className="text-red-500 mt-1 text-xs">•</span>
                                          <span className="leading-relaxed text-muted-foreground">{item}</span>
                                        </div>
                                      ))}
                                    </dd>
                                  </div>
                                )}

                                {/* Vertical divider */}
                                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30 transform -translate-x-1/2 hidden md:block"></div>
                              </div>
                            </div>
                          )
                        } catch (e) {
                          return null
                        }
                      })()}

                      {/* Missing Data Notice */}
                      {!businessContext.competitors && !businessContext.competitorKeywords && (
                        <div className="border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 rounded-lg p-4 mt-8">
                          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">💡 Enhance Your Context</h3>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Add competitors, pain points, and other rich context data to get more comprehensive analysis results.
                            Use the "Add Company" button or the business context form to enrich this profile.
                          </p>
                        </div>
                      )}
                    </div>
                      
                  </div>
                ) : (
                  <div className="text-center py-20 px-8">
                    <div className="max-w-md mx-auto">
                      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center">
                        <Sparkles className="h-8 w-8 text-purple-500" />
                      </div>
                      <h2 className="text-xl font-semibold text-foreground mb-2">Get started with AEO</h2>
                      <p className="text-muted-foreground mb-6">
                        Add your company to unlock AI-optimized content that ranks in ChatGPT, Perplexity, and Claude.
                      </p>
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <span className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Set up in 5 minutes
                          </span>
                          <span className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            No technical skills needed
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/70">
                          ← Enter your website URL in the sidebar to begin
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                </>
              ),
            },
            {
              value: 'instructions',
              label: 'Instructions',
              icon: <FileText className="h-3.5 w-3.5" />,
              content: (
                <div className="space-y-8">
                  <div className="space-y-6">
                    <div>
                      <Label className="text-base font-medium">System Instructions</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Global prompts applied to all content generation
                      </p>
                    </div>
                    
                    <Textarea
                      placeholder="Example: Always mention sustainability. Focus on B2B audiences. Use technical language..."
                      value={businessContext.systemInstructions || ''}
                      onChange={(e) => updateContext({ systemInstructions: e.target.value })}
                      className="min-h-[100px] border-0 bg-muted/50 focus:bg-muted/70"
                      rows={4}
                    />
                  </div>

                  <div className="space-y-6">
                    <div>
                      <Label className="text-base font-medium">Knowledge Base</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Key facts about your company (one per line)
                      </p>
                    </div>
                    
                    <Textarea
                      placeholder="We target Fortune 500 companies&#10;We specialize in security solutions&#10;Founded in 2020"
                      value={businessContext.clientKnowledgeBase || ''}
                      onChange={(e) => updateContext({ clientKnowledgeBase: e.target.value })}
                      className="min-h-[80px] border-0 bg-muted/50 focus:bg-muted/70"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-6">
                    <div>
                      <Label className="text-base font-medium">Content Guidelines</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Writing style and format requirements
                      </p>
                    </div>
                    
                    <Textarea
                      placeholder="Include statistics, add case studies, use conversational tone..."
                      value={businessContext.contentInstructions || ''}
                      onChange={(e) => updateContext({ contentInstructions: e.target.value })}
                      className="min-h-[80px] border-0 bg-muted/50 focus:bg-muted/70"
                      rows={3}
                    />
                  </div>
                </div>
              ),
            },
          ]}
          />
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirmation && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <h3 className="text-sm font-semibold">Clear all context?</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              This will clear all extracted context. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearConfirmation(false)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAll}
                className="text-xs cursor-pointer"
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
