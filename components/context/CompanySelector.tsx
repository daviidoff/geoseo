// ABOUTME: Company selector dropdown for Keywords/Blogs pages
// ABOUTME: Loads saved companies from Supabase and stores selection in user profile

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Plus, ChevronDown, Loader2 } from 'lucide-react'
import { useContextStorage, BusinessContext } from '@/hooks/useContextStorage'
import { toast } from 'sonner'

interface SavedCompany {
  id: string
  name: string
  website: string | null
  context: BusinessContext | null
  createdAt: string
}

// Get favicon URL from company website
function getLogoUrl(website: string | null): string | null {
  if (!website) return null
  try {
    // Clean the URL to get just the domain
    let domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    // Use Google's favicon service (reliable, fast CDN)
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch {
    return null
  }
}

// Company logo component with fallback
function CompanyLogo({ website, name, className = '' }: { website: string | null; name: string; className?: string }) {
  const [hasError, setHasError] = useState(false)
  const logoUrl = getLogoUrl(website)
  
  if (!logoUrl || hasError) {
    // Fallback: Show first letter of company name
    return (
      <div className={`flex items-center justify-center rounded bg-foreground/10 text-foreground font-semibold text-xs ${className}`}>
        {name.charAt(0).toUpperCase()}
      </div>
    )
  }
  
  return (
    <img 
      src={logoUrl} 
      alt={`${name} logo`}
      className={`rounded object-contain ${className}`}
      onError={() => setHasError(true)}
    />
  )
}

interface CompanySelectorProps {
  className?: string
  onCompanyChange?: (clientId: string | null) => void
}

// Parse client data from Supabase into BusinessContext format
function parseClientContext(client: any): BusinessContext | null {
  if (!client) return null
  
  try {
    // Try to parse notes field which contains full context
    if (client.notes) {
      const notes = typeof client.notes === 'string' ? JSON.parse(client.notes) : client.notes
      return {
        companyName: notes.companyName || client.name,
        companyWebsite: notes.companyWebsite || client.website,
        productDescription: notes.productDescription || notes.description,
        targetIndustries: notes.targetIndustries || notes.industry,
        targetAudience: notes.targetAudience || notes.target_audience || client.target_audience,
        tone: notes.brandTone || notes.tone || client.brand_voice,
        products: notes.products,
        competitors: notes.competitors || client.competitors,
        competitorsData: notes.competitorsData,
        painPoints: notes.painPoints || notes.pain_points,
        valuePropositions: notes.valuePropositions || notes.value_propositions,
        useCases: notes.useCases || notes.use_cases,
        contentThemes: notes.contentThemes || notes.content_themes,
        voicePersona: notes.voicePersona || notes.voice_persona,
        primaryRegion: notes.primaryRegion,
        primaryCountry: notes.primaryCountry,
        primaryLanguage: notes.primaryLanguage,
      }
    }

    // Fallback to basic client fields
    return {
      companyName: client.name,
      companyWebsite: client.website,
      targetAudience: client.target_audience,
      tone: client.brand_voice,
      targetIndustries: client.industry,
      competitors: client.competitors,
      products: client.products,
    }
  } catch (e) {
    console.error('Failed to parse client context:', e)
    return null
  }
}

export function CompanySelector({ className = '', onCompanyChange }: CompanySelectorProps) {
  const { businessContext, updateContext, replaceContext } = useContextStorage()
  const [savedCompanies, setSavedCompanies] = useState<SavedCompany[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSelector, setShowSelector] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)

  // Fetch the user's selected client from Supabase
  const fetchSelectedClient = useCallback(async () => {
    try {
      const response = await fetch('/api/user/selected-client')
      if (response.ok) {
        const data = await response.json()
        return data.selected_client_id
      }
    } catch (error) {
      console.error('[CompanySelector] Failed to fetch selected client:', error)
    }
    return null
  }, [])

  // Save the selected client to Supabase
  const saveSelectedClient = useCallback(async (clientId: string | null) => {
    try {
      const response = await fetch('/api/user/selected-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId })
      })
      if (!response.ok) {
        console.error('[CompanySelector] Failed to save selected client')
      }
    } catch (error) {
      console.error('[CompanySelector] Failed to save selected client:', error)
    }
  }, [])

  // Load saved companies from Supabase API
  // Note: Does NOT set isLoading=false - that's done in init() after selection
  const loadCompanies = useCallback(async () => {
    try {
      const response = await fetch('/api/clients')
      if (!response.ok) {
        throw new Error('Failed to load companies')
      }
      const data = await response.json()
      const clients = data.clients || []
      
      const companies: SavedCompany[] = clients.map((client: any) => ({
        id: client.id,
        name: client.name,
        website: client.website,
        context: parseClientContext(client),
        createdAt: client.created_at,
      }))
      
      setSavedCompanies(companies)
      return companies
    } catch (error) {
      console.error('Failed to load companies:', error)
      return []
    }
  }, [])

  // Initialize: load companies and selected client from Supabase
  useEffect(() => {
    const init = async () => {
      try {
        const [companies, savedClientId] = await Promise.all([
          loadCompanies(),
          fetchSelectedClient()
        ])
        
        console.log('[CompanySelector] Init - companies:', companies.length, 'savedClientId:', savedClientId)
        
        if (savedClientId && companies.length > 0) {
          // Use the saved selection from Supabase
          const savedCompany = companies.find((c: SavedCompany) => c.id === savedClientId)
          if (savedCompany) {
            console.log('[CompanySelector] Restoring saved selection:', savedCompany.name)
            setSelectedCompanyId(savedClientId)
            if (savedCompany.context) {
              replaceContext(savedCompany.context)
            }
            onCompanyChange?.(savedClientId)
            return
          }
        }
        
        // No saved selection - try to match by businessContext
        if (businessContext.companyName && companies.length > 0) {
          const matchingCompany = companies.find((c: SavedCompany) => 
            c.name === businessContext.companyName || 
            c.website === businessContext.companyWebsite
          )
          if (matchingCompany) {
            console.log('[CompanySelector] Matching by businessContext:', matchingCompany.name)
            setSelectedCompanyId(matchingCompany.id)
            saveSelectedClient(matchingCompany.id)
            onCompanyChange?.(matchingCompany.id)
            return
          }
        }
        
        // Default to first company if available
        if (companies.length > 0) {
          const firstCompany = companies[0]
          console.log('[CompanySelector] Defaulting to first company:', firstCompany.name)
          setSelectedCompanyId(firstCompany.id)
          if (firstCompany.context) {
            replaceContext(firstCompany.context)
          }
          saveSelectedClient(firstCompany.id)
          onCompanyChange?.(firstCompany.id)
        }
      } finally {
        // Always set loading to false when init completes
        setIsLoading(false)
      }
    }
    
    init()
  }, []) // Only run once on mount

  // Switch to a different company
  const switchCompany = async (company: SavedCompany) => {
    if (!company.context) {
      toast.error('Company context not available. Please re-analyze.')
      return
    }

    console.log('[CompanySelector] Switching to:', company.name, company.id)
    
    // Update state immediately for responsive UI
    setSelectedCompanyId(company.id)
    // Use replaceContext to fully replace (not merge) - prevents old company data bleeding through
    replaceContext(company.context)
    setShowSelector(false)
    
    // Save to Supabase (async, non-blocking)
    saveSelectedClient(company.id)
    
    // Notify parent components
    onCompanyChange?.(company.id)
    
    toast.success(`Switched to ${company.name}`)
  }

  // Get current company info - use savedCompanies directly once loaded
  const currentCompany = savedCompanies.find(c => c.id === selectedCompanyId)
  
  // Display logic: Show Loading only when isLoading is true (our local state)
  // Once isLoading is false, show the selected company or "No company selected"
  let displayName: string
  let displayUrl: string | undefined
  
  if (isLoading) {
    displayName = 'Loading...'
    displayUrl = undefined
  } else if (currentCompany) {
    displayName = currentCompany.name
    displayUrl = currentCompany.website || undefined
  } else if (businessContext.companyName) {
    displayName = businessContext.companyName
    displayUrl = businessContext.companyWebsite
  } else {
    displayName = 'No company selected'
    displayUrl = undefined
  }

  return (
    <div className={`${className}`}>
      <div className="border border-foreground/20 rounded-lg p-3 bg-card">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Company Context
          </Label>
        </div>
        
        {/* Company Display / Dropdown Trigger */}
        <button
          onClick={() => setShowSelector(!showSelector)}
          className="w-full flex items-center justify-between gap-2 p-2 rounded-md border border-foreground/20 bg-background hover:bg-foreground/5 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            {isLoading ? (
              <Loader2 className="h-8 w-8 flex-shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <CompanyLogo website={displayUrl || null} name={displayName} className="h-8 w-8 flex-shrink-0" />
            )}
            <div className="text-left min-w-0">
              <div className="text-sm font-medium truncate">{displayName}</div>
              {!isLoading && displayUrl && (
                <div className="text-xs text-muted-foreground truncate">{displayUrl}</div>
              )}
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showSelector ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {showSelector && (
          <div className="mt-2 border border-foreground/20 rounded-lg bg-background shadow-lg overflow-hidden">
            {isLoading ? (
              <div className="p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading companies...
              </div>
            ) : savedCompanies.length > 0 ? (
              <div className="max-h-[200px] overflow-y-auto">
                {savedCompanies.map(company => (
                  <button
                    key={company.id}
                    onClick={() => switchCompany(company)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-foreground/5 transition-colors border-b border-border last:border-0 text-left ${
                      selectedCompanyId === company.id ? 'bg-foreground/5' : ''
                    }`}
                  >
                    <CompanyLogo website={company.website} name={company.name} className="h-6 w-6 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{company.name}</div>
                      {company.website && (
                        <div className="text-xs text-muted-foreground truncate">{company.website}</div>
                      )}
                    </div>
                    {selectedCompanyId === company.id && (
                      <div className="w-2 h-2 rounded-full bg-foreground/60 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">No companies found</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.location.href = '/context'
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Company
                </Button>
              </div>
            )}
            
            {/* Footer Actions */}
            {savedCompanies.length > 0 && (
              <div className="border-t border-border p-2 bg-muted/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => {
                    window.location.href = '/context'
                  }}
                >
                  <Plus className="h-3 w-3 mr-2" />
                  Add or manage companies
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
