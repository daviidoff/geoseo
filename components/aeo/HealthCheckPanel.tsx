/**
 * ABOUTME: AEO Health Check Panel - Split layout matching KeywordGenerator
 * ABOUTME: Left panel = input form, Right panel = RunningState + Results
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Activity, FileText, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useContextStorage } from '@/hooks/useContextStorage'
import { ContextPanel } from '@/components/shared/ContextPanel'
import { CreditCostPreview } from '@/components/ui/credit-cost-preview'
import { toast } from 'sonner'
import { RunningState, type Stage, type ActivityLogEntry } from '@/components/shared/RunningState'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

// (keep all stage configurations, interfaces, helper functions from HealthCheckGenerator.tsx)
const STAGE_CONFIGURATIONS = {
  'fetching': {
    name: '🌐 Fetching Website',
    duration: 3,
    description: 'Loading website content..',
  },
  'technical': {
    name: '⚙️ Technical SEO',
    duration: 5,
    description: 'Running technical checks..',
  },
  'structured_data': {
    name: '📊 Structured Data',
    duration: 4,
    description: 'Analyzing schema.org markup..',
  },
  'crawler': {
    name: '🤖 AI Crawler Access',
    duration: 2,
    description: 'Checking AI bot access..',
  },
  'authority': {
    name: '🏆 Authority Signals',
    duration: 3,
    description: 'Analyzing E-E-A-T signals..',
  },
  'scoring': {
    name: '📈 Calculating Score',
    duration: 2,
    description: 'Computing final score..',
  }
}

const STAGE_ORDER = ['fetching', 'technical', 'structured_data', 'crawler', 'authority', 'scoring'] as const

interface HealthCheckResult {
  success: boolean
  url: string
  final_url: string
  score: number
  grade: string
  visibility_band: string
  visibility_color: string
  issues: Array<{
    check: string
    category: string
    passed: boolean
    severity: string
    message: string
    recommendation: string
    score_impact: number
  }>
  tier_details: {
    tier0: { passed: boolean; cap: number; reason: string }
    tier1: { passed: boolean; cap: number; reason: string }
    tier2: { passed: boolean; cap: number; reason: string }
    base_score: number
    limiting_tier: string
    limiting_reason: string
  }
  summary: {
    total_checks: number
    passed: number
    errors: number
    warnings: number
    notices: number
  }
  metadata: {
    fetch_time_ms: number
    response_time_ms: number
    status_code: number
    sitemap_found: boolean
    robots_txt_found: boolean
  }
}

function getScoreColor(score: number): string {
  // Validate score is a number in valid range
  if (typeof score !== 'number' || isNaN(score)) return 'text-gray-600'
  if (score < 0 || score > 100) return 'text-gray-600'

  if (score >= 90) return 'text-green-600'
  if (score >= 70) return 'text-blue-600'
  if (score >= 50) return 'text-yellow-600'
  if (score >= 30) return 'text-orange-600'
  return 'text-red-600'
}

function getStatusIcon(passed: boolean, severity?: string) {
  if (passed) return <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
  if (severity === 'error') return <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
  return <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
}

export function HealthCheckPanel() {
  const { businessContext, hasContext } = useContextStorage()
  
  // Derive URL directly from business context (like KeywordGenerator)
  const url = businessContext?.companyWebsite || ''
  
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<HealthCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // AbortController for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null)

  // For ContextPanel - defaults from context or US/en fallback
  const [country, setCountry] = useState('US')
  const [language, setLanguage] = useState('en')

  // Apply primary market from context when available
  useEffect(() => {
    if (businessContext?.primaryLanguage) {
      setLanguage(businessContext.primaryLanguage)
    }
    if (businessContext?.primaryCountry) {
      setCountry(businessContext.primaryCountry)
    }
  }, [businessContext?.primaryLanguage, businessContext?.primaryCountry])

  // Cleanup: abort request on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Filter for issues display (null = show all in accordion, 'passed'/'errors'/'warnings' = show filtered list)
  const [issueFilter, setIssueFilter] = useState<'passed' | 'errors' | 'warnings' | null>(null)

  // RunningState tracking
  const [runningStatus, setRunningStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [currentStageId, setCurrentStageId] = useState<string>('')
  const [stages, setStages] = useState<Stage[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const [estimate, setEstimate] = useState(0)

  // Initialize stages
  const initializeStages = useCallback(() => {
    const initialStages: Stage[] = STAGE_ORDER.map((stageId) => ({
      id: stageId,
      name: STAGE_CONFIGURATIONS[stageId].name,
      status: 'pending' as const,
      estimatedDuration: STAGE_CONFIGURATIONS[stageId].duration,
    }))
    setStages(initialStages)
  }, [])

  const updateStageStatus = useCallback((stageId: string, status: Stage['status']) => {
    setStages(prev => prev.map(stage =>
      stage.id === stageId ? { ...stage, status } : stage
    ))
  }, [])

  const addActivityLog = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setActivityLogs(prev => {
      const newLog: ActivityLogEntry = { message, timestamp: Date.now().toString(), type }
      const updated = [...prev, newLog]
      // Cap at 50 entries to prevent memory leak
      return updated.length > 50 ? updated.slice(-50) : updated
    })
  }, [])

  const handleGenerate = async () => {
    // Fetch the currently selected client's website fresh (to avoid stale context)
    let currentUrl = url
    try {
      const selectedClientRes = await fetch('/api/user/selected-client')
      if (selectedClientRes.ok) {
        const { selected_client_id } = await selectedClientRes.json()
        if (selected_client_id) {
          const clientsRes = await fetch('/api/clients')
          if (clientsRes.ok) {
            const { clients } = await clientsRes.json()
            const selectedClient = clients?.find((c: any) => c.id === selected_client_id)
            if (selectedClient) {
              const notes = selectedClient.notes 
                ? (typeof selectedClient.notes === 'string' ? JSON.parse(selectedClient.notes) : selectedClient.notes)
                : {}
              currentUrl = notes.companyWebsite || selectedClient.website || ''
            }
          }
        }
      }
    } catch (err) {
      console.warn('[HealthCheck] Failed to fetch fresh client data:', err)
    }

    if (!currentUrl) {
      toast.error('Please set up your business context first')
      return
    }

    // Validate URL format and protocol (XSS prevention)
    try {
      const parsedUrl = new URL(currentUrl)
      const allowedProtocols = ['http:', 'https:']
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        toast.error('Only HTTP and HTTPS URLs are allowed')
        return
      }
    } catch (e) {
      toast.error('Invalid website URL in your business context')
      return
    }

    // Use the fresh URL for the health check
    const urlToCheck = currentUrl

    // Prevent double-click race condition
    if (loading) {
      return
    }

    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController()

    setLoading(true)
    setError(null)
    setResult(null)
    setIssueFilter(null)
    setRunningStatus('running')
    setProgress(0)
    setEstimate(3)
    setActivityLogs([])
    setCurrentStageId('')

    initializeStages()
    addActivityLog(`🚀 Starting health check for ${urlToCheck}`)

    try {
      // Mark fetching as running
      setCurrentStageId('fetching')
      updateStageStatus('fetching', 'running')
      setProgress(10)
      addActivityLog('🌐 Fetching website content..')

      // Make the actual API call with AbortController
      const response = await fetch('/api/aeo/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToCheck }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Health check failed')
      }

      const data = await response.json()

      // Validate response has required fields
      if (!data || typeof data.score !== 'number' || !data.grade || !Array.isArray(data.issues) || !data.summary) {
        throw new Error('Invalid response format from health check API')
      }

      // API call complete - mark all stages as complete with tiny delays for visual feedback
      updateStageStatus('fetching', 'complete')
      setProgress(20)

      const checkStages = ['technical', 'structured_data', 'crawler', 'authority', 'scoring'] as const
      for (let i = 0; i < checkStages.length; i++) {
        const stageId = checkStages[i]
        setCurrentStageId(stageId)
        updateStageStatus(stageId, 'running')
        addActivityLog(`${STAGE_CONFIGURATIONS[stageId].name} ${STAGE_CONFIGURATIONS[stageId].description}`)
        await new Promise(resolve => setTimeout(resolve, 100))
        updateStageStatus(stageId, 'complete')
        setProgress(prev => Math.min(prev + 15, 100))
      }

      setProgress(100)
      setRunningStatus('complete')
      setResult(data)
      addActivityLog('✅ Health check complete!', 'success')
      // Log to History as analytics (health)
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'analytics',
            company: urlToCheck,
            url: urlToCheck,
            payload: { healthResult: data },
          }),
        })
      } catch (err) {
        console.warn('[HealthCheck] Failed to write history log:', err)
      }
      toast.success('Health check completed successfully!')

      // Reset to idle after a brief delay so progress UI disappears and only results remain
      setTimeout(() => {
        setRunningStatus('idle')
      }, 2000)
    } catch (err: any) {
      // Ignore abort errors (user cancelled or component unmounted)
      if (err.name === 'AbortError') {
        setRunningStatus('idle')
        return
      }

      setError(err.message)
      setRunningStatus('error')
      addActivityLog(`❌ ${err.message}`, 'error')
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  // INPUT FORM - Adapts to centered or sidebar layout
  const inputPanel = (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-foreground/10 rounded-lg">
            <Activity className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">AEO Health Check</h2>
            <p className="text-xs text-muted-foreground">
              Comprehensive website analysis for AI visibility
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable form content */}
      <div className="flex-1 overflow-auto px-6 pt-6 pb-24">
        <div className="space-y-6">
          {/* Shared Context Panel for DRY implementation */}
          <ContextPanel
            country={country}
            language={language}
            onCountryChange={setCountry}
            onLanguageChange={setLanguage}
            disabled={loading}
          />

          {/* Info Card */}
          <div className="space-y-4">
            <div className="bg-foreground/5 border border-foreground/20 rounded-lg p-4 space-y-1">
              <p className="text-sm font-semibold text-foreground">
                What we check:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                <li>• Technical SEO fundamentals</li>
                <li>• Structured data & schema.org</li>
                <li>• AI crawler accessibility</li>
                <li>• E-E-A-T authority signals</li>
              </ul>
            </div>
          </div>

          {/* Credit Cost Preview */}
          <CreditCostPreview 
            serviceType="AEO_HEALTH_CHECK" 
            compact
          />
        </div>
      </div>

      {/* Sticky Generate Button - Fixed at bottom */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border/50 shadow-lg">
        <Button
          onClick={handleGenerate}
          disabled={!hasContext || !url || loading}
          className="w-full min-h-[48px]"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Run Health Check
            </>
          )}
        </Button>
      </div>
    </div>
  )


  // Always use split layout (like KeywordGenerator)
  return (
    <div className="h-full flex relative">
      {/* Left Panel - Input Form */}
      <div className="w-[420px] flex-shrink-0 border-r border-border">
        {inputPanel}
      </div>

      {/* Right Panel - Output */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6">
        {/* Idle placeholder - when no activity */}
        {runningStatus === 'idle' && !result && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-3">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ready to analyze</p>
                <p className="text-xs text-muted-foreground/70">Run health check on your website</p>
              </div>
            </div>
          </div>
        )}

        {/* Running state */}
        {runningStatus !== 'idle' && (
          <RunningState
            status={runningStatus}
            progress={progress}
            currentStage={currentStageId ? STAGE_CONFIGURATIONS[currentStageId].name : ''}
            estimate={estimate}
            stages={stages}
            logs={activityLogs}
            errorMessage={error || undefined}
            successMessage={runningStatus === 'complete' ? 'Health check completed!' : undefined}
          />
        )}

        {/* Results - show when result exists */}
        {result && (
          <div className="mt-6 p-6 border rounded-lg bg-card space-y-6">
            {/* Score Overview */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Health Check Results</h2>
                <p className="text-sm text-muted-foreground">{result.url}</p>
              </div>
              <div className="text-right">
                <div className={`text-4xl font-bold ${getScoreColor(result.score)}`}>
                  {result.score.toFixed(1)}
                </div>
                <Badge variant={result.grade.startsWith('A') ? 'default' : 'destructive'}>
                  Grade {result.grade}
                </Badge>
              </div>
            </div>

            {/* Summary Stats - Clickable Filters */}
            <div className="grid grid-cols-4 gap-4">
              <button
                onClick={() => setIssueFilter(issueFilter === 'passed' ? null : 'passed')}
                className={`text-center p-3 rounded-lg border transition-all cursor-pointer hover:bg-green-500/10 ${
                  issueFilter === 'passed' 
                    ? 'border-green-500 bg-green-500/10 ring-2 ring-green-500/20' 
                    : 'border-border hover:border-green-500/50'
                }`}
              >
                <div className="text-2xl font-bold text-green-600">{result.summary.passed}</div>
                <div className="text-xs text-muted-foreground">Passed</div>
              </button>
              <button
                onClick={() => setIssueFilter(issueFilter === 'errors' ? null : 'errors')}
                className={`text-center p-3 rounded-lg border transition-all cursor-pointer hover:bg-red-500/10 ${
                  issueFilter === 'errors' 
                    ? 'border-red-500 bg-red-500/10 ring-2 ring-red-500/20' 
                    : 'border-border hover:border-red-500/50'
                }`}
              >
                <div className="text-2xl font-bold text-red-600">{result.summary.errors}</div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </button>
              <button
                onClick={() => setIssueFilter(issueFilter === 'warnings' ? null : 'warnings')}
                className={`text-center p-3 rounded-lg border transition-all cursor-pointer hover:bg-yellow-500/10 ${
                  issueFilter === 'warnings' 
                    ? 'border-yellow-500 bg-yellow-500/10 ring-2 ring-yellow-500/20' 
                    : 'border-border hover:border-yellow-500/50'
                }`}
              >
                <div className="text-2xl font-bold text-yellow-600">{result.summary.warnings}</div>
                <div className="text-xs text-muted-foreground">Warnings</div>
              </button>
              <button
                onClick={() => setIssueFilter(null)}
                className={`text-center p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/50 ${
                  issueFilter === null 
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-2xl font-bold">{result.summary.total_checks}</div>
                <div className="text-xs text-muted-foreground">Total Checks</div>
              </button>
            </div>

            {/* Filtered Issues List */}
            {result.issues.length > 0 && (
              <>
                {issueFilter !== null ? (
                  // Flat list of filtered issues
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold capitalize">
                        {issueFilter === 'passed' ? 'Passed Checks' : issueFilter === 'errors' ? 'Errors' : 'Warnings'}
                      </h3>
                      <button 
                        onClick={() => setIssueFilter(null)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Show all →
                      </button>
                    </div>
                    {result.issues
                      .filter(issue => {
                        if (issueFilter === 'passed') return issue.passed
                        if (issueFilter === 'errors') return !issue.passed && issue.severity === 'error'
                        if (issueFilter === 'warnings') return !issue.passed && (issue.severity === 'warning' || issue.severity === 'notice')
                        return true
                      })
                      .map((issue, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                          {getStatusIcon(issue.passed, issue.severity)}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{issue.check.replace('_', ' ')}</div>
                            <div className="text-sm text-muted-foreground">{issue.message}</div>
                            {issue.recommendation && (
                              <div className="text-xs text-blue-600 mt-1">
                                💡 {issue.recommendation}
                              </div>
                            )}
                          </div>
                          <Badge variant={issue.passed ? 'default' : 'destructive'} className="ml-auto">
                            {issue.passed ? 'Pass' : issue.severity}
                          </Badge>
                        </div>
                      ))}
                    {result.issues.filter(issue => {
                      if (issueFilter === 'passed') return issue.passed
                      if (issueFilter === 'errors') return !issue.passed && issue.severity === 'error'
                      if (issueFilter === 'warnings') return !issue.passed && (issue.severity === 'warning' || issue.severity === 'notice')
                      return true
                    }).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No {issueFilter} found
                      </div>
                    )}
                  </div>
                ) : (
                  // Default: Accordion view by category
                  <Accordion type="multiple" defaultValue={['technical', 'structured_data', 'ai_crawler', 'authority']}>
                    {Object.entries(
                      result.issues.reduce((acc, issue) => {
                        // Normalize category to lowercase to avoid duplicates
                        const normalizedCategory = (issue.category || 'uncategorized').toLowerCase()
                        if (!acc[normalizedCategory]) acc[normalizedCategory] = []
                        acc[normalizedCategory].push(issue)
                        return acc
                      }, {} as Record<string, typeof result.issues>)
                    ).map(([category, issues]) => (
                    <AccordionItem key={category} value={category}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold capitalize">{category.replace('_', ' ')}</span>
                          <Badge variant="outline">{issues.length} checks</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {issues.map((issue, idx) => (
                            <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                              {getStatusIcon(issue.passed, issue.severity)}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{issue.check.replace('_', ' ')}</div>
                                <div className="text-sm text-muted-foreground">{issue.message}</div>
                                {issue.recommendation && (
                                  <div className="text-xs text-blue-600 mt-1">
                                    💡 {issue.recommendation}
                                  </div>
                                )}
                              </div>
                              <Badge variant={issue.passed ? 'default' : 'destructive'} className="ml-auto">
                                {issue.passed ? 'Pass' : issue.severity}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                  </Accordion>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
