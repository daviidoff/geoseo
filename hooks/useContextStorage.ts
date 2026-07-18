/**
 * ABOUTME: Hook for managing business context stored in Supabase
 * ABOUTME: Syncs with the clients table, persists across devices
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// File reference for context files (assets and research documents)
export interface ContextFileReference {
  id: string
  name: string
  type: string
  path: string
  url?: string
  size: number
  uploadedAt: string
  aiLabels?: string[]
  aiAnalysis?: string
  fullDescription?: string
  fullTextContent?: string
}

export interface BusinessContext {
  // Core fields
  companyName?: string
  companyWebsite?: string
  website?: string  // Alias for companyWebsite (used in AEO Health Check)
  icp?: string
  valueProposition?: string

  // System instructions (reusable prompts)
  systemInstructions?: string

  // Blog-specific fields
  clientKnowledgeBase?: string  // Client Knowledge Base (facts about company)
  contentInstructions?: string   // Content Instructions (how to write)

  // Arrays
  countries?: string[]
  products?: string[]
  targetKeywords?: string[]
  competitorKeywords?: string[]
  marketingGoals?: string[]

  // Legacy context fields
  tone?: string
  targetCountries?: string  // Used in BulkProcessor and PromptSection
  productDescription?: string
  competitors?: string
  competitorsData?: any  // Structured competitor data (used in ContextForm)
  targetIndustries?: string
  complianceFlags?: string
  productType?: string
  gtmPlaybook?: string

  // Company info
  legalEntity?: string
  vatNumber?: string
  registrationNumber?: string
  imprintUrl?: string
  contactEmail?: string
  contactPhone?: string
  linkedInUrl?: string
  twitterUrl?: string
  githubUrl?: string

  // OpenContext fields (from company analysis API)
  targetAudience?: string
  painPoints?: string  // Comma-separated
  valuePropositions?: string  // Comma-separated
  useCases?: string  // Comma-separated
  contentThemes?: string  // Comma-separated
  voicePersona?: string  // JSON string
  visualIdentity?: string  // JSON string for visual identity
  primaryRegion?: string  // e.g., "DACH", "North America"
  primaryCountry?: string  // ISO code e.g., "DE", "US"
  primaryLanguage?: string  // ISO code e.g., "de", "en"

  // File references
  assets?: ContextFileReference[]  // Image assets for blog content
  researchFiles?: ContextFileReference[]  // Research documents (PDFs, docs, etc.)
}

// Parse context from Supabase client record
function parseClientContext(client: any): BusinessContext {
  if (!client) return {}
  
  let context: Record<string, any> = {}
  
  // Try to parse from notes field (JSON string with full context)
  if (client.notes) {
    try {
      const parsed = typeof client.notes === 'string' ? JSON.parse(client.notes) : client.notes
      context = typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      // Fall back to basic fields
    }
  }
  
  // Merge with top-level client fields as fallback
  return {
    companyName: context.companyName || client.name,
    companyWebsite: context.companyWebsite || client.website,
    productDescription: context.productDescription || context.description,
    targetIndustries: context.targetIndustries || context.industry || client.industry,
    targetAudience: context.targetAudience || client.target_audience,
    tone: context.tone || context.brandTone || client.brand_voice,
    products: context.products,
    competitors: context.competitors || client.competitors,
    competitorsData: context.competitorsData,
    painPoints: context.painPoints,
    valuePropositions: context.valuePropositions,
    useCases: context.useCases,
    contentThemes: context.contentThemes,
    voicePersona: context.voicePersona,
    visualIdentity: context.visualIdentity,
    primaryRegion: context.primaryRegion,
    primaryCountry: context.primaryCountry,
    primaryLanguage: context.primaryLanguage,
    systemInstructions: context.systemInstructions,
    clientKnowledgeBase: context.clientKnowledgeBase,
    contentInstructions: context.contentInstructions,
    assets: context.assets,
    researchFiles: context.researchFiles,
    // Additional fields
    icp: context.icp,
    valueProposition: context.valueProposition,
    countries: context.countries,
    targetKeywords: context.targetKeywords,
    competitorKeywords: context.competitorKeywords,
    marketingGoals: context.marketingGoals,
    targetCountries: context.targetCountries,
    complianceFlags: context.complianceFlags,
    productType: context.productType,
    gtmPlaybook: context.gtmPlaybook,
    legalEntity: context.legalEntity,
    vatNumber: context.vatNumber,
    registrationNumber: context.registrationNumber,
    imprintUrl: context.imprintUrl,
    contactEmail: context.contactEmail,
    contactPhone: context.contactPhone,
    linkedInUrl: context.linkedInUrl,
    twitterUrl: context.twitterUrl,
    githubUrl: context.githubUrl,
  }
}

export function useContextStorage() {
  const [businessContext, setBusinessContext] = useState<BusinessContext>({})
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitializedRef = useRef(false)

  // Load selected client and its context from Supabase on mount
  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    const loadContext = async () => {
      try {
        // Get selected client ID
        const selectedRes = await fetch('/api/user/selected-client')
        if (!selectedRes.ok) {
          setIsLoading(false)
          return
        }
        const { selected_client_id } = await selectedRes.json()
        
        if (!selected_client_id) {
          // No selected client - try to get first available
          const clientsRes = await fetch('/api/clients')
          if (clientsRes.ok) {
            const { clients } = await clientsRes.json()
            if (clients && clients.length > 0) {
              const firstClient = clients[0]
              setSelectedClientId(firstClient.id)
              setBusinessContext(parseClientContext(firstClient))
              // Save as selected
              await fetch('/api/user/selected-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: firstClient.id })
              })
            }
          }
          setIsLoading(false)
          return
        }

        setSelectedClientId(selected_client_id)

        // Load full client data
        const clientsRes = await fetch('/api/clients')
        if (clientsRes.ok) {
          const { clients } = await clientsRes.json()
          const selectedClient = clients?.find((c: any) => c.id === selected_client_id)
          if (selectedClient) {
            setBusinessContext(parseClientContext(selectedClient))
          }
        }
      } catch (error) {
        console.error('[useContextStorage] Failed to load context:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadContext()
  }, [])

  // Save context to Supabase (debounced)
  const saveToSupabase = useCallback(async (context: BusinessContext, clientId: string | null) => {
    if (!clientId) return

    try {
      // Update the client's notes field with the full context
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: JSON.stringify(context),
          name: context.companyName,
          website: context.companyWebsite,
        })
      })

      if (!response.ok) {
        console.error('[useContextStorage] Failed to save to Supabase')
      }
    } catch (error) {
      console.error('[useContextStorage] Failed to save:', error)
    }
  }, [])

  // Update context (merge with existing)
  const updateContext = useCallback((updates: Partial<BusinessContext>) => {
    setBusinessContext(prev => {
      const newContext = { ...prev, ...updates }
      
      // Debounced save to Supabase
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveToSupabase(newContext, selectedClientId)
      }, 1000) // Save after 1 second of no changes
      
      return newContext
    })
  }, [selectedClientId, saveToSupabase])

  // Replace context entirely (for switching companies)
  const replaceContext = useCallback((newContext: BusinessContext) => {
    setBusinessContext(newContext)
    
    // Immediate save for company switch
    if (selectedClientId) {
      saveToSupabase(newContext, selectedClientId)
    }
  }, [selectedClientId, saveToSupabase])

  // Clear context
  const clearContext = useCallback(() => {
    setBusinessContext({})
    setSelectedClientId(null)
    
    // Clear selection in Supabase
    fetch('/api/user/selected-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: null })
    }).catch(console.error)
  }, [])

  // Switch to a different client
  const switchClient = useCallback(async (clientId: string) => {
    try {
      // Save selection to Supabase
      await fetch('/api/user/selected-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId })
      })

      setSelectedClientId(clientId)

      // Load the client's context
      const clientsRes = await fetch('/api/clients')
      if (clientsRes.ok) {
        const { clients } = await clientsRes.json()
        const client = clients?.find((c: any) => c.id === clientId)
        if (client) {
          setBusinessContext(parseClientContext(client))
        }
      }
    } catch (error) {
      console.error('[useContextStorage] Failed to switch client:', error)
    }
  }, [])

  // Check if we have meaningful context
  const hasContext = Boolean(
    (businessContext.companyName && businessContext.companyName.trim()) ||
    (businessContext.companyWebsite && businessContext.companyWebsite.trim()) ||
    (businessContext.clientKnowledgeBase && businessContext.clientKnowledgeBase.trim()) ||
    (businessContext.systemInstructions && businessContext.systemInstructions.trim())
  )

  return {
    context: businessContext, // Legacy alias
    businessContext,
    updateContext,
    updateBusinessContext: updateContext, // Alias for compatibility
    replaceContext,
    clearContext,
    switchClient,
    selectedClientId,
    hasContext,
    isLoading,
  }
}
