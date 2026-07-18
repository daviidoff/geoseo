/**
 * ABOUTME: AEO Mentions Check Generator with RunningState UI
 * ABOUTME: Matches KeywordGenerator and HealthCheckGenerator style - tests AI platform visibility
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Target, FileText, Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useContextStorage } from '@/hooks/useContextStorage'
import { toast } from 'sonner'
import { RunningState, type Stage, type ActivityLogEntry } from '@/components/shared/RunningState'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ContextPanel } from '@/components/shared/ContextPanel'
import { CreditCostPreview } from '@/components/ui/credit-cost-preview'

// Stage configurations for the new (openanalytics) mentions pipeline
const STAGE_CONFIGURATIONS = {
  analysis: {
    name: '🏢 Company Context',
    duration: 3,
    icon: '🏢',
    description: 'Analyzing company context..',
    color: 'text-blue-600',
    substeps: ['Loading company info', 'Validating inputs'],
  },
  query_generation: {
    name: '🎯 Hyperniche Queries',
    duration: 5,
    icon: '🎯',
    description: 'Generating hyperniche queries (70/20/10)',
    color: 'text-purple-600',
    substeps: ['Unbranded queries', 'Competitive queries', 'Branded queries'],
  },
  gemini: {
    name: '✨ Gemini Checks',
    duration: 25,
    icon: '✨',
    description: 'Checking responses with Gemini',
    color: 'text-teal-600',
    substeps: ['Send queries', 'Collect responses', 'Detect mentions'],
  },
  scoring: {
    name: '📊 Calculating Score',
    duration: 3,
    icon: '📊',
    description: 'Computing visibility metrics',
    color: 'text-pink-600',
    substeps: ['Presence rate', 'Mention rate', 'Visibility/quality score'],
  },
}

// Only fast mode supported (10 queries)
const STAGE_ORDER = ['analysis', 'query_generation', 'gemini', 'scoring'] as const

interface MentionsResult {
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

export function MentionsCheckGenerator() {
  const { businessContext, hasContext } = useContextStorage()
  const [country, setCountry] = useState('US')
  const [language, setLanguage] = useState('en')
  // Always use fast mode (10 queries)
  const mode = 'fast'
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MentionsResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // AbortController for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null)
  const cancelledRef = useRef(false)

  // Cleanup: abort request on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Derive company name from context
  const companyName = businessContext?.companyName || 'Company'

  // RunningState tracking
  const [runningStatus, setRunningStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [currentStageId, setCurrentStageId] = useState<string>('')
  const [stages, setStages] = useState<Stage[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const [estimate, setEstimate] = useState(0)

  const initializeStages = useCallback(() => {
    const initialStages: Stage[] = STAGE_ORDER.map(id => ({
      id,
      name: STAGE_CONFIGURATIONS[id].name,
      status: 'pending',
      duration: STAGE_CONFIGURATIONS[id].duration,
    }))
    setStages(initialStages)
    return initialStages
  }, [mode])

  const addActivityLog = useCallback((message: string, icon?: string) => {
    setActivityLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      message,
      icon,
    }])
  }, [])

  const updateStageStatus = useCallback((stageId: string, status: Stage['status']) => {
    setStages(prev => prev.map(s =>
      s.id === stageId ? { ...s, status } : s
    ))
  }, [])

  const handleGenerate = async () => {
    // Re-fetch the latest context from API to ensure we have current selection
    // (fixes issue where CompanySelector updates don't sync to this component's state)
    let currentContext = businessContext
    let currentCompanyName = companyName
    try {
      const selectedRes = await fetch('/api/user/selected-client')
      if (selectedRes.ok) {
        const { selected_client_id } = await selectedRes.json()
        if (selected_client_id) {
          const clientsRes = await fetch('/api/clients')
          if (clientsRes.ok) {
            const { clients } = await clientsRes.json()
            const selectedClient = clients?.find((c: any) => c.id === selected_client_id)
            if (selectedClient) {
              // Parse the notes field for full context
              const notes = selectedClient.notes 
                ? (typeof selectedClient.notes === 'string' ? JSON.parse(selectedClient.notes) : selectedClient.notes)
                : {}
              currentContext = {
                companyName: notes.companyName || selectedClient.name,
                companyWebsite: notes.companyWebsite || selectedClient.website,
                products: notes.products || [],
                valueProposition: notes.valueProposition,
                productDescription: notes.productDescription,
                targetIndustries: notes.targetIndustries,
                icp: notes.icp,
                targetKeywords: notes.targetKeywords,
                competitors: notes.competitors,
                countries: notes.countries,
                productType: notes.productType,
              }
              currentCompanyName = currentContext.companyName || 'Company'
            }
          }
        }
      }
    } catch (e) {
      console.error('[MentionsCheck] Failed to refresh context:', e)
      // Continue with existing context
    }

    if (!currentCompanyName) {
      toast.error('Company name is required')
      return
    }

    // Validate business context has products
    if (!currentContext?.products || currentContext.products.length === 0) {
      toast.error('Please add products to your Business Context first. This is required to generate relevant queries.')
      return
    }

    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController()
    cancelledRef.current = false

    setLoading(true)
    setError(null)
    setResult(null)
    setRunningStatus('running')
    setProgress(0)
    setActivityLogs([])

    const numQueries = 10 // fast mode only
    const initialStages = initializeStages()
    const totalDuration = initialStages.reduce((sum, s) => sum + (s.duration || 0), 0)
    setEstimate(totalDuration)

    addActivityLog(`🚀 Starting mentions check for ${currentCompanyName} (${numQueries} queries)`)

    try {
      // Build company analysis from refreshed context
      const companyAnalysis = {
        companyInfo: {
          name: currentCompanyName,
          website: currentContext?.companyWebsite || '',
          description: currentContext?.valueProposition || currentContext?.productDescription || `${currentCompanyName} is a company`,
          industry: currentContext?.targetIndustries || currentContext?.icp || '',
          target_audience: currentContext?.icp ? [currentContext.icp] : [],
          products: currentContext?.products || [],
          services: [],
          pain_points: [],
          use_cases: [],
          key_features: currentContext?.targetKeywords || [],
          solution_keywords: currentContext?.targetKeywords || [],
          value_propositions: currentContext?.valueProposition ? [currentContext.valueProposition] : [],
          differentiators: [],
          customer_problems: [],
          product_category: currentContext?.productType || undefined,
          primary_region: currentContext?.countries?.[0] || undefined,
        },
        competitors: currentContext?.competitors
          ? currentContext.competitors.split(',').map(c => ({ name: c.trim() }))
          : []
      }

      let currentProgress = 0

      // Simulate initial stages
      for (let i = 0; i < 2; i++) { // analysis and query_generation
        const stageId = STAGE_ORDER[i]
        const stageDuration = STAGE_CONFIGURATIONS[stageId].duration

        setCurrentStageId(stageId)
        updateStageStatus(stageId, 'running')
        addActivityLog(`${STAGE_CONFIGURATIONS[stageId].icon} ${STAGE_CONFIGURATIONS[stageId].description}`)

        await new Promise(resolve => setTimeout(resolve, stageDuration * 1000))

        currentProgress += (stageDuration / totalDuration) * 100
        setProgress(Math.min(currentProgress, 100))
        updateStageStatus(stageId, 'complete')
        setEstimate(totalDuration - (currentProgress / 100 * totalDuration))
      }

      // Make actual API call (standalone, using only GEMINI_API_KEY from server)
      const response = await fetch('/api/aeo/mentions-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: currentCompanyName,
          company_analysis: companyAnalysis,
          industry: currentContext?.targetIndustries || currentContext?.icp || '',
          language: language.toLowerCase(),
          country: country,
          num_queries: 10,  // Always 10 queries (fast mode only)
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Mentions check failed')
      }

      const data = await response.json()

      // Complete remaining stages before showing results
      for (let i = 2; i < STAGE_ORDER.length; i++) {
        // Check if cancelled
        if (cancelledRef.current) {
          return
        }

        const stageId = STAGE_ORDER[i]
        const stageDuration = STAGE_CONFIGURATIONS[stageId].duration

        setCurrentStageId(stageId)
        updateStageStatus(stageId, 'running')
        addActivityLog(`${STAGE_CONFIGURATIONS[stageId].icon} ${STAGE_CONFIGURATIONS[stageId].description}`)

        await new Promise(resolve => setTimeout(resolve, stageDuration * 1000))

        // Check again after delay
        if (cancelledRef.current) {
          return
        }

        currentProgress += (stageDuration / totalDuration) * 100
        setProgress(Math.min(currentProgress, 100))
        updateStageStatus(stageId, 'complete')
        setEstimate(totalDuration - (currentProgress / 100 * totalDuration))
      }

      // Only set result after all stages complete
      setResult(data)
      addActivityLog(`✅ Mentions check complete! Visibility: ${data.visibility}%`)
      // Log to History as analytics (mentions)
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'analytics',
            company: data.company_name || currentCompanyName,
            url: currentContext?.companyWebsite || '',
            payload: { mentionsResult: data },
          }),
        })
      } catch (err) {
        console.warn('[Mentions] Failed to write history log:', err)
      }
      setRunningStatus('complete')
      setProgress(100)
      setEstimate(0)
      toast.success('Mentions check completed successfully!')

      // Reset to idle after a brief delay so progress UI disappears and only results remain
      setTimeout(() => {
        setRunningStatus('idle')
      }, 2000)

    } catch (err: any) {
      // Ignore abort errors (user cancelled or component unmounted)
      if (err.name === 'AbortError') {
        return
      }

      const errorMsg = err instanceof Error ? err.message : 'Mentions check failed'
      setError(errorMsg)
      setRunningStatus('error')
      addActivityLog(`❌ Error: ${errorMsg}`)
      toast.error(errorMsg)

      if (currentStageId) {
        updateStageStatus(currentStageId, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  // Cancel the current check
  const handleCancel = () => {
    cancelledRef.current = true
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setLoading(false)
    setRunningStatus('idle')
    setProgress(0)
    addActivityLog('🛑 Mentions check cancelled')
    toast.info('Mentions check cancelled')
  }

  const getBandColor = (band: string) => {
    switch (band.toLowerCase()) {
      case 'dominant': return 'bg-green-100 text-green-800 border-green-300'
      case 'strong': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'weak': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'minimal': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  // Input Panel - EXACTLY matches Keywords
  const inputPanel = (
    <div className="h-full flex flex-col bg-card">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto p-6 pb-24">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Mentions Check</h2>
            <p className="text-xs text-muted-foreground">
              Test your brand visibility across AI platforms
            </p>
          </div>

          {/* Shared Context Panel (SAME as Keywords) */}
          <ContextPanel
            country={country}
            language={language}
            onCountryChange={setCountry}
            onLanguageChange={setLanguage}
            disabled={loading}
          />

          {/* Credit Cost Preview */}
          <CreditCostPreview 
            serviceType="AEO_MENTIONS_CHECK" 
            compact
          />
        </div>
      </div>

      {/* Sticky Check Button - Fixed at bottom (matches Keywords) */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border/50 shadow-lg">
        {loading ? (
          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={true}
              className="flex-1 min-h-[48px]"
              size="lg"
            >
              <Target className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </Button>
            <Button
              onClick={handleCancel}
              variant="destructive"
              className="min-h-[48px] px-4"
              size="lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleGenerate}
            disabled={!hasContext || loading}
            className="w-full min-h-[48px]"
            size="lg"
          >
            <Target className="h-4 w-4 mr-2" />
            Check Mentions
          </Button>
        )}
      </div>
    </div>
  )

  // Output Panel - Right side (flexible width, matches Keywords)
  const outputPanel = (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6">
      {/* Idle placeholder - matches Keywords */}
      {runningStatus === 'idle' && !result && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-3">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ready to check visibility</p>
              <p className="text-xs text-muted-foreground/70">Enter company details and click Check Mentions</p>
            </div>
          </div>
        </div>
      )}

      {/* Running State */}
      {runningStatus !== 'idle' && (
        <RunningState
          status={runningStatus}
          progress={progress}
          currentStage={currentStageId ? STAGE_CONFIGURATIONS[currentStageId].name : ''}
          estimate={estimate}
          stages={stages}
          logs={activityLogs}
          errorMessage={error || undefined}
          successMessage={runningStatus === 'complete' ? `Mentions check complete! Visibility: ${result?.visibility}%` : undefined}
        />
      )}

      {/* Results - show when result exists (regardless of runningStatus) */}
      {result && (
        <div className="mt-6 space-y-6">
          {/* Score Overview */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Mentions Check Results</h2>
              <p className="text-sm text-muted-foreground">{result.companyName}</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-blue-600">
                {result.visibility.toFixed(1)}%
              </div>
              <Badge className={getBandColor(result.band)}>
                {result.band}
              </Badge>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{result.mentions}</div>
              <div className="text-xs text-muted-foreground">Total Mentions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{result.presence_rate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Presence Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{result.quality_score.toFixed(1)}/10</div>
              <div className="text-xs text-muted-foreground">Avg Quality</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{result.actualQueriesProcessed}</div>
              <div className="text-xs text-muted-foreground">Queries</div>
            </div>
          </div>

          {/* Platform Breakdown */}
          <div>
            <h3 className="font-semibold mb-3">Platform Breakdown</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Mentions</TableHead>
                  <TableHead className="text-right">Quality</TableHead>
                  <TableHead className="text-right">Responses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(result.platform_stats).map(([platform, stats]) => {
                  // quality_score is already the average from the backend
                  const avgQuality = stats.quality_score ?? 0
                  return (
                    <TableRow key={platform}>
                      <TableCell className="font-medium capitalize">{platform}</TableCell>
                      <TableCell className="text-right">{stats.mentions}</TableCell>
                      <TableCell className="text-right">{avgQuality.toFixed(1)}/10</TableCell>
                      <TableCell className="text-right">{stats.responses}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="h-full flex relative">
      {/* Left Panel - Input Form (420px fixed, matches Keywords) */}
      <div className="w-[420px] flex-shrink-0 border-r border-border">
        {inputPanel}
      </div>

      {/* Right Panel - Output (flexible, matches Keywords) */}
      {outputPanel}
    </div>
  )
}
