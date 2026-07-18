/**
 * Shared Context Panel Component
 * Used by both KeywordGenerator and BlogGenerator for consistent context handling
 */

'use client'

import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CompanySelector } from '@/components/context/CompanySelector'
import { useContextStorage } from '@/hooks/useContextStorage'
import { COUNTRIES, LANGUAGES } from '@/lib/constants/countries-languages'

interface ContextPanelProps {
  country: string
  language: string
  onCountryChange: (value: string) => void
  onLanguageChange: (value: string) => void
  onCompanyChange?: (clientId: string | null) => void
  disabled?: boolean
  showCompanySelector?: boolean
  showWarning?: boolean
}

export function ContextPanel({
  country,
  language,
  onCountryChange,
  onLanguageChange,
  onCompanyChange,
  disabled = false,
  showCompanySelector = true,
  showWarning = true
}: ContextPanelProps) {
  const { hasContext, isLoading } = useContextStorage()

  return (
    <div className="space-y-4">
      {/* Company Context Selector */}
      {showCompanySelector && <CompanySelector onCompanyChange={onCompanyChange} />}

      {/* Loading State */}
      {showWarning && isLoading && (
        <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Loading company context...</p>
        </div>
      )}

      {/* No Context Warning - only show when not loading */}
      {showWarning && !isLoading && !hasContext && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium text-blue-500">No Company Context Set</p>
          <p className="text-xs text-muted-foreground">
            Go to{' '}
            <a href="/context" className="text-primary hover:underline">
              CONTEXT
            </a>
            {' '}tab to analyze a company website first.
          </p>
        </div>
      )}

      {/* Country/Language Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="country" className="text-xs font-medium text-foreground">
            Country
          </Label>
          <SearchableSelect
            options={COUNTRIES}
            value={country}
            onValueChange={onCountryChange}
            placeholder="Type to search countries..."
            disabled={disabled}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="language" className="text-xs font-medium text-foreground">
            Language
          </Label>
          <SearchableSelect
            options={LANGUAGES}
            value={language}
            onValueChange={onLanguageChange}
            placeholder="Type to search languages..."
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}