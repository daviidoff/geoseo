'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PlatformCard } from './PlatformCard'
import { QueryCard } from './QueryCard'
import {
  Search,
  RefreshCw,
  Download,
  FileText,
  TrendingUp,
  Filter,
  LayoutGrid,
  List,
  ChevronDown,
  Activity,
  Target,
  Award,
  Loader2,
  AlertCircle,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useContextStorage } from '@/hooks/useContextStorage'
import { CreditCostPreview } from '@/components/ui/credit-cost-preview'
import { generateMentionsReportPdf } from '@/lib/exports/aeo-report-generator'
import { generateMentionsExcel, downloadBlob } from '@/lib/exports/aeo-excel-generator'
import type {
  MentionsCheckResult,
  AIPlatform,
  MentionsFilterOptions,
  MentionsSortOptions,
  QueryResult,
  PlatformStats,
  DimensionStats,
} from '@/lib/types/mentions'

/**
 * Visibility band styling
 */
const BAND_STYLES: Record<string, string> = {
  Dominant: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Strong: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Moderate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Weak: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  Minimal: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

/**
 * Get visibility score color
 */
function getVisibilityColor(visibility: number): string {
  if (visibility >= 80) return 'text-green-600 dark:text-green-400'
  if (visibility >= 60) return 'text-blue-600 dark:text-blue-400'
  if (visibility >= 40) return 'text-yellow-600 dark:text-yellow-400'
  if (visibility >= 20) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

/**
 * Raw API response interface - matches the snake_case API response
 */
interface RawMentionsApiResponse {
  companyName: string
  visibility: number
  band: string
  mentions: number
  presence_rate: number
  quality_score: number
  max_quality: number
  platform_stats: Record<string, {
    mentions: number
    quality_score: number
    responses: number
    errors: number
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    cost?: number
  }>
  dimension_stats: Record<string, {
    mentions: number
    quality_score: number
    queries: number
  }>
  query_results: Array<{
    query: string
    dimension: string
    platform: string
    raw_mentions: number
    capped_mentions: number
    quality_score: number
    mention_type: string
    position?: number
    source_urls: string[]
    competitor_mentions: Array<{ name: string; count: number }>
    response_text: string
  }>
  actualQueriesProcessed: number
  execution_time_seconds: number
  total_cost: number
  total_tokens: number
  mode: string
}

interface MentionsDashboardProps {
  /** Additional className */
  className?: string
}

/**
 * Transform raw API response to component types
 */
function transformApiResponse(raw: RawMentionsApiResponse): MentionsCheckResult {
  // Transform platform stats
  const platformStats: Record<AIPlatform, PlatformStats> = {} as Record<AIPlatform, PlatformStats>
  Object.entries(raw.platform_stats).forEach(([platform, stats]) => {
    platformStats[platform as AIPlatform] = {
      platform: platform as AIPlatform,
      totalMentions: stats.mentions,
      averageQuality: stats.quality_score,
      presenceRate: (stats.mentions / stats.responses) * 100,
      queriesChecked: stats.responses,
      successfulQueries: stats.responses - stats.errors,
      failedQueries: stats.errors,
      tokensUsed: stats.total_tokens || 0,
      cost: stats.cost || 0,
    }
  })

  // Transform query results
  const queryResults: QueryResult[] = raw.query_results.map((qr, index) => ({
    queryId: `query-${index}`,
    query: qr.query,
    dimension: qr.dimension,
    platform: qr.platform as AIPlatform,
    status: 'completed' as const,
    rawMentions: qr.raw_mentions,
    cappedMentions: qr.capped_mentions,
    qualityScore: qr.quality_score,
    mentionType: qr.mention_type as any,
    position: qr.position || null,
    sourceUrls: qr.source_urls,
    competitorMentions: qr.competitor_mentions,
    responseText: qr.response_text,
    checkedAt: new Date().toISOString(),
  }))

  // Transform dimension stats
  const dimensionStats: Record<string, DimensionStats> = {}
  Object.entries(raw.dimension_stats).forEach(([dimension, stats]) => {
    dimensionStats[dimension] = {
      dimension,
      totalMentions: stats.mentions,
      averageQuality: stats.quality_score,
      queriesCount: stats.queries,
    }
  })

  return {
    companyName: raw.companyName,
    visibility: raw.visibility,
    band: raw.band as any,
    mentions: raw.mentions,
    presenceRate: raw.presence_rate,
    qualityScore: raw.quality_score,
    maxQuality: raw.max_quality,
    platformStats,
    dimensionStats,
    queryResults,
    queriesProcessed: raw.actualQueriesProcessed,
    executionTimeSeconds: raw.execution_time_seconds,
    totalCost: raw.total_cost,
    totalTokens: raw.total_tokens,
    mode: raw.mode as 'fast' | 'comprehensive',
    checkedAt: new Date().toISOString(),
  }
}

/**
 * MentionsDashboard Component
 *
 * Main dashboard for displaying AI mention tracking results.
 * Shows visibility score, platform breakdown, and query results.
 * Fetches data from the mentions-check API and displays it with filters and sorting.
 */
export function MentionsDashboard({
  className,
}: MentionsDashboardProps) {
  const { businessContext } = useContextStorage()

  // Form state
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [apiKey, setApiKey] = useState('')

  // API state
  const [result, setResult] = useState<MentionsCheckResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Export state
  const [exportingPDF, setExportingPDF] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  // Filter and sort state
  const [filters, setFilters] = useState<MentionsFilterOptions>({
    platform: 'all',
    dimension: 'all',
    mentionStatus: 'all',
    searchQuery: '',
  })
  const [sort, setSort] = useState<MentionsSortOptions>({
    column: 'quality',
    direction: 'desc',
  })
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [expandedQueries, setExpandedQueries] = useState<Set<string>>(new Set())
  const [selectedPlatform, setSelectedPlatform] = useState<AIPlatform | null>(null)

  // Auto-populate from context and settings on mount
  useEffect(() => {
    // Load OpenRouter API key from settings
    if (typeof window !== 'undefined') {
      const storedKey = localStorage.getItem('openrouter-api-key')
      if (storedKey && !apiKey) {
        setApiKey(storedKey)
      }
    }

    // Auto-populate company name from context
    if (businessContext?.companyName && !companyName) {
      setCompanyName(businessContext.companyName)
    }

    // Auto-populate industry from context
    if (!industry) {
      const industryFromContext = businessContext?.targetIndustries || businessContext?.icp
      if (industryFromContext) {
        setIndustry(industryFromContext)
      }
    }
  }, [businessContext, apiKey, companyName, industry])

  /**
   * Run mentions check
   */
  const runCheck = useCallback(async (isRefresh = false) => {
    if (!companyName) {
      setError('Company name is required')
      return
    }

    if (!apiKey) {
      setError('OpenRouter API key is required. Set it in Settings or paste it above.')
      return
    }

    // Build company_analysis from business context
    const companyAnalysis = {
      companyInfo: {
        name: companyName,
        website: businessContext?.companyWebsite || '',
        description: businessContext?.valueProposition || businessContext?.productDescription || `${companyName} is a ${industry || 'company'}`,
        industry: industry || businessContext?.targetIndustries || businessContext?.icp || '',
        target_audience: businessContext?.icp ? [businessContext.icp] : [],
        products: businessContext?.products || [],
        services: [],
        pain_points: [],
        use_cases: [],
        key_features: businessContext?.targetKeywords || [],
        solution_keywords: businessContext?.targetKeywords || [],
        value_propositions: businessContext?.valueProposition ? [businessContext.valueProposition] : [],
        differentiators: [],
        customer_problems: [],
        product_category: businessContext?.productType || undefined,
        primary_region: businessContext?.countries?.[0] || undefined,
      },
      competitors: businessContext?.competitors
        ? businessContext.competitors.split(',').map(c => ({ name: c.trim() }))
        : []
    }

    // Validate we have products or services
    const hasProducts = companyAnalysis.companyInfo.products.length > 0
    if (!hasProducts) {
      setError('Please add products to your Business Context first. This is required to generate relevant queries.')
      return
    }

    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const response = await fetch('/api/aeo/mentions-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          company_analysis: companyAnalysis,
          language: 'english',
          country: businessContext?.countries?.[0] || 'US',
          num_queries: 10,
          mode: 'fast',
          api_key: apiKey,
        }),
      })

      const data: RawMentionsApiResponse = await response.json()

      if (!response.ok) {
        throw new Error((data as any).error || (data as any).message || 'Mentions check failed')
      }

      const transformedResult = transformApiResponse(data)
      setResult(transformedResult)

      // Expand all queries by default
      setExpandedQueries(new Set(transformedResult.queryResults.map(qr => qr.queryId)))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check mentions')
      console.error('Mentions check error:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [companyName, apiKey, industry, businessContext])

  /**
   * Export handlers
   */
  const handleExportPDF = useCallback(async () => {
    if (!result) return
    setExportingPDF(true)
    try {
      const blob = await generateMentionsReportPdf(result as any, result.companyName)
      const filename = `aeo-mentions-${result.companyName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
      downloadBlob(blob, filename)
    } catch (error) {
      console.error('PDF export failed:', error)
      setError('Failed to generate PDF. Please try again.')
    } finally {
      setExportingPDF(false)
    }
  }, [result])

  const handleExportExcel = useCallback(async () => {
    if (!result) return
    setExportingExcel(true)
    try {
      const blob = await generateMentionsExcel(result as any, result.companyName)
      const filename = `aeo-mentions-${result.companyName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`
      downloadBlob(blob, filename)
    } catch (error) {
      console.error('Excel export failed:', error)
      setError('Failed to generate Excel. Please try again.')
    } finally {
      setExportingExcel(false)
    }
  }, [result])

  // Get unique platforms and dimensions for filter options
  const { platforms, dimensions } = useMemo(() => {
    if (!result) return { platforms: [], dimensions: [] }

    const platformSet = new Set<AIPlatform>()
    const dimensionSet = new Set<string>()

    result.queryResults.forEach((qr) => {
      platformSet.add(qr.platform)
      dimensionSet.add(qr.dimension)
    })

    return {
      platforms: Array.from(platformSet),
      dimensions: Array.from(dimensionSet),
    }
  }, [result])

  // Filter and sort query results
  const filteredResults = useMemo(() => {
    if (!result) return []

    let filtered = result.queryResults.filter((qr) => {
      // Platform filter
      if (filters.platform !== 'all' && qr.platform !== filters.platform) {
        return false
      }
      // Selected platform from card click
      if (selectedPlatform && qr.platform !== selectedPlatform) {
        return false
      }
      // Dimension filter
      if (filters.dimension !== 'all' && qr.dimension !== filters.dimension) {
        return false
      }
      // Mention status filter
      if (filters.mentionStatus === 'mentioned' && qr.cappedMentions === 0) {
        return false
      }
      if (filters.mentionStatus === 'not-mentioned' && qr.cappedMentions > 0) {
        return false
      }
      // Search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        return (
          qr.query.toLowerCase().includes(query) ||
          qr.dimension.toLowerCase().includes(query) ||
          qr.responseText.toLowerCase().includes(query)
        )
      }
      return true
    })

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0
      switch (sort.column) {
        case 'query':
          comparison = a.query.localeCompare(b.query)
          break
        case 'platform':
          comparison = a.platform.localeCompare(b.platform)
          break
        case 'dimension':
          comparison = a.dimension.localeCompare(b.dimension)
          break
        case 'mentions':
          comparison = a.cappedMentions - b.cappedMentions
          break
        case 'quality':
          comparison = a.qualityScore - b.qualityScore
          break
      }
      return sort.direction === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [result, filters, sort, selectedPlatform])

  // Toggle query expansion
  const toggleQueryExpand = useCallback((queryId: string) => {
    setExpandedQueries((prev) => {
      const next = new Set(prev)
      if (next.has(queryId)) {
        next.delete(queryId)
      } else {
        next.add(queryId)
      }
      return next
    })
  }, [])

  // Expand/collapse all
  const expandAll = useCallback(() => {
    if (!result) return
    setExpandedQueries(new Set(result.queryResults.map((qr) => qr.queryId)))
  }, [result])

  const collapseAll = useCallback(() => {
    setExpandedQueries(new Set())
  }, [])

  // Clear platform selection
  const clearPlatformSelection = useCallback(() => {
    setSelectedPlatform(null)
  }, [])

  // Check if we have additional context that will enhance the check
  const hasAdditionalContext = !!(
    businessContext?.products?.length ||
    businessContext?.valueProposition ||
    businessContext?.targetKeywords?.length ||
    businessContext?.competitors
  )

  const fromContext = {
    name: businessContext?.companyName === companyName,
    industry: businessContext?.targetIndustries === industry || businessContext?.icp === industry,
    apiKey: apiKey && typeof window !== 'undefined' && localStorage.getItem('openrouter-api-key') === apiKey,
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Input Form */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-4">AEO Mentions Check</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Check how your brand appears across AI platforms like ChatGPT, Perplexity, Claude, and Gemini.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openrouter-key" className="flex items-center gap-2">
                OpenRouter API Key *
                {fromContext.apiKey && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    From settings
                  </span>
                )}
              </Label>
              <Input
                id="openrouter-key"
                type="password"
                placeholder="sk-or-v1-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isLoading || isRefreshing}
              />
              <p className="text-xs text-muted-foreground">
                Set in{' '}
                <a href="/settings" className="text-primary hover:underline">
                  Settings
                </a>
                {' '}or paste here. Get your key from{' '}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  openrouter.ai/keys
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-2">
                Company Name *
                {fromContext.name && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    From context
                  </span>
                )}
              </Label>
              <Input
                id="company"
                type="text"
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isLoading || isRefreshing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry" className="flex items-center gap-2">
                Industry (Optional)
                {fromContext.industry && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    From context
                  </span>
                )}
              </Label>
              <Input
                id="industry"
                type="text"
                placeholder="B2B SaaS"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={isLoading || isRefreshing}
              />
              <p className="text-xs text-muted-foreground">
                Helps generate more relevant test queries
              </p>
            </div>

            {hasAdditionalContext && (
              <Card className="p-3 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-green-800 dark:text-green-400 space-y-1">
                    <p className="font-medium">Using context data to enhance mentions check:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-green-700 dark:text-green-500">
                      {businessContext?.products?.length > 0 && (
                        <li>Products: {businessContext.products.slice(0, 2).join(', ')}{businessContext.products.length > 2 && ` +${businessContext.products.length - 2} more`}</li>
                      )}
                      {businessContext?.valueProposition && (
                        <li>Value proposition</li>
                      )}
                      {businessContext?.targetKeywords?.length > 0 && (
                        <li>Target keywords</li>
                      )}
                      {businessContext?.competitors && (
                        <li>Competitors</li>
                      )}
                    </ul>
                  </div>
                </div>
              </Card>
            )}

            <CreditCostPreview 
              serviceType="AEO_MENTIONS_CHECK" 
              compact
            />

            <Button
              onClick={() => runCheck(false)}
              disabled={isLoading || isRefreshing || !companyName || !apiKey}
              className="w-full min-h-[48px]"
              size="lg"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Checking Mentions...' : 'Check AEO Mentions'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Tests visibility across 4 AI platforms with 10 queries (Fast mode)
            </p>
          </div>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-destructive bg-destructive/10">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <h3 className="font-semibold">Checking AI Mentions</h3>
              <p className="text-sm text-muted-foreground">
                Querying ChatGPT, Perplexity, Claude, and Gemini...
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Results Section */}
      {result && (
        <>
          {/* Header with actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{result.companyName}</h2>
              <p className="text-sm text-muted-foreground">
                Last checked: {new Date(result.checkedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => runCheck(true)}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={exportingPDF}
              >
                {exportingPDF ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={exportingExcel}
              >
                {exportingExcel ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Excel
              </Button>
            </div>
          </div>

          {/* Visibility Score Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-6 lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">AEO Visibility Score</h3>
              </div>
              <div className="text-center">
                <div
                  className={cn(
                    'text-5xl font-bold mb-2',
                    getVisibilityColor(result.visibility)
                  )}
                >
                  {result.visibility}%
                </div>
                <Badge className={cn('text-sm', BAND_STYLES[result.band])}>
                  {result.band}
                </Badge>
                <Progress value={result.visibility} className="mt-4 h-3" />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold">{result.presenceRate}%</div>
                  <div className="text-xs text-muted-foreground">Presence Rate</div>
                </div>
                <div className="text-center">
                  <div className={cn('text-2xl font-bold', getVisibilityColor(result.qualityScore * 10))}>
                    {result.qualityScore.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Quality</div>
                </div>
              </div>
            </Card>

            <Card className="p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Platform Performance</h3>
                </div>
                {selectedPlatform && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearPlatformSelection}
                  >
                    Clear filter
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {platforms.map((platform) => {
                  const stats = result.platformStats[platform]
                  if (!stats) return null

                  return (
                    <PlatformCard
                      key={platform}
                      platform={platform}
                      stats={stats}
                      isSelected={selectedPlatform === platform}
                      onClick={() =>
                        setSelectedPlatform(
                          selectedPlatform === platform ? null : platform
                        )
                      }
                    />
                  )
                })}
              </div>
            </Card>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold text-primary">{result.mentions}</div>
              <div className="text-sm text-muted-foreground">Total Mentions</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold">{result.queriesProcessed}</div>
              <div className="text-sm text-muted-foreground">Queries Checked</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold">{result.executionTimeSeconds}s</div>
              <div className="text-sm text-muted-foreground">Execution Time</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold">${result.totalCost.toFixed(4)}</div>
              <div className="text-sm text-muted-foreground">Total Cost</div>
            </Card>
          </div>

          {/* Filters and View Toggle */}
          <Card className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search queries, responses..."
                    value={filters.searchQuery}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
                    }
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Filter dropdowns */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filters.platform}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      platform: e.target.value as AIPlatform | 'all',
                    }))
                  }
                  className="h-10 px-3 py-2 border border-input rounded-md text-sm bg-background"
                >
                  <option value="all">All Platforms</option>
                  {platforms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.dimension}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dimension: e.target.value }))
                  }
                  className="h-10 px-3 py-2 border border-input rounded-md text-sm bg-background"
                >
                  <option value="all">All Dimensions</option>
                  {dimensions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.mentionStatus}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      mentionStatus: e.target.value as 'all' | 'mentioned' | 'not-mentioned',
                    }))
                  }
                  className="h-10 px-3 py-2 border border-input rounded-md text-sm bg-background"
                >
                  <option value="all">All Results</option>
                  <option value="mentioned">Mentioned</option>
                  <option value="not-mentioned">Not Mentioned</option>
                </select>

                {/* View toggle */}
                <div className="flex border border-input rounded-md">
                  <button
                    className={cn(
                      'p-2 transition-colors',
                      viewMode === 'list' && 'bg-primary text-primary-foreground'
                    )}
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    className={cn(
                      'p-2 transition-colors',
                      viewMode === 'grid' && 'bg-primary text-primary-foreground'
                    )}
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Results count and expand/collapse */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Showing {filteredResults.length} of {result.queryResults.length} results
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={expandAll}>
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll}>
                  Collapse All
                </Button>
              </div>
            </div>
          </Card>

          {/* Query Results */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Query Results</h3>
            </div>

            {filteredResults.length === 0 ? (
              <EmptyState
                variant="filtered"
                title="No matching results"
                description="Try adjusting your filters or search query"
                clearFilter={{
                  label: 'Clear filters',
                  onClick: () => {
                    setFilters({
                      platform: 'all',
                      dimension: 'all',
                      mentionStatus: 'all',
                      searchQuery: '',
                    })
                    setSelectedPlatform(null)
                  },
                }}
                size="sm"
              />
            ) : (
              <div
                className={cn(
                  viewMode === 'grid' && 'grid grid-cols-1 md:grid-cols-2 gap-3',
                  viewMode === 'list' && 'space-y-3'
                )}
              >
                {filteredResults.map((qr) => (
                  <QueryCard
                    key={qr.queryId}
                    result={qr}
                    companyName={result.companyName}
                    isExpanded={expandedQueries.has(qr.queryId)}
                    onToggleExpand={() => toggleQueryExpand(qr.queryId)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
