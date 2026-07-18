/**
 * ABOUTME: AEO Health Check Generator Component with RunningState UI
 * ABOUTME: Matches KeywordGenerator style - generates comprehensive AEO health reports
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { Activity, FileText, Download, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useContextStorage } from '@/hooks/useContextStorage'
import { toast } from 'sonner'
import { RunningState, type Stage, type ActivityLogEntry } from '@/components/shared/RunningState'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

// Stage configurations matching the Python backend stage_health (29 checks run in parallel)
// Total time: ~3-5 seconds (all checks run concurrently after fetch)
const STAGE_CONFIGURATIONS = {
  'fetching': {
    name: '🌐 Fetching Website',
    duration: 1, // ~1s to fetch HTML
    icon: '🌐',
    description: 'Loading website content..',
    color: 'text-blue-600',
    substeps: ['Fetching HTML', 'Loading robots.txt', 'Checking sitemap', 'Analyzing response time']
  },
  'technical': {
    name: '⚙️ Technical SEO (16 checks)',
    duration: 0.5, // Runs in parallel
    icon: '⚙️',
    description: 'Running technical checks..',
    color: 'text-purple-600',
    substeps: ['Title tag', 'Meta description', 'Heading structure', 'Image alt text', 'HTTPS', 'Mobile viewport']
  },
  'structured_data': {
    name: '📊 Structured Data (6 checks)',
    duration: 0.5,
    icon: '📊',
    description: 'Analyzing schema.org markup..',
    color: 'text-green-600',
    substeps: ['Organization schema', 'FAQ schema', 'JSON-LD validation', 'Schema completeness']
  },
  'crawler': {
    name: '🤖 AI Crawler Access (4 checks)',
    duration: 0.5,
    icon: '🤖',
    description: 'Checking AI bot access..',
    color: 'text-orange-600',
    substeps: ['GPTBot', 'Claude-Web', 'PerplexityBot', 'CCBot']
  },
  'authority': {
    name: '🏆 Authority Signals (3 checks)',
    duration: 0.5,
    icon: '🏆',
    description: 'Analyzing E-E-A-T signals..',
    color: 'text-indigo-600',
    substeps: ['About page', 'Contact info', 'Social proof']
  },
  'scoring': {
    name: '📈 Calculating Score',
    duration: 0.5,
    icon: '📈',
    description: 'Computing final score..',
    color: 'text-teal-600',
    substeps: ['Tiered scoring', 'Category scores', 'Grade calculation', 'Visibility band']
  }
}

const STAGE_ORDER = ['fetching', 'technical', 'structured_data', 'crawler', 'authority', 'scoring'] as const

interface HealthCheckResult {
  success: boolean
  url: string
  final_url: string
  overall_score?: number
  score: number
  grade: string
  visibility_band: string
  visibility_color: string
  checks?: Array<{
    check: string
    category: string
    passed: boolean
    severity: string
    message: string
    recommendation: string
    score_impact: number
  }>
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
  technical_summary?: any
  structured_data_summary?: any
  crawler_summary?: any
  authority_summary?: any
  metadata: {
    fetch_time_ms: number
    response_time_ms: number
    status_code: number
    sitemap_found: boolean
    robots_txt_found: boolean
  }
}

export function HealthCheckGenerator() {
  const { businessContext, hasContext } = useContextStorage()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<HealthCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // RunningState tracking
  const [runningStatus, setRunningStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [currentStageId, setCurrentStageId] = useState<string>('')
  const [stages, setStages] = useState<Stage[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const [estimate, setEstimate] = useState(0)

  // Auto-populate URL from context
  useEffect(() => {
    if (businessContext?.companyWebsite && !url) {
      setUrl(businessContext.companyWebsite)
    }
  }, [businessContext?.companyWebsite, url])

  // Initialize stages
  const initializeStages = useCallback(() => {
    const initialStages: Stage[] = STAGE_ORDER.map(id => ({
      id,
      name: STAGE_CONFIGURATIONS[id].name,
      status: 'pending',
      duration: STAGE_CONFIGURATIONS[id].duration,
    }))
    setStages(initialStages)
    return initialStages
  }, [])

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
    if (!url) {
      toast.error('Please enter a website URL')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setRunningStatus('running')
    setProgress(0)
    setActivityLogs([])

    const initialStages = initializeStages()
    setEstimate(3) // Realistic estimate: ~3 seconds total

    addActivityLog(`🚀 Starting health check for ${url}`)

    try {
      // Mark fetching as running
      setCurrentStageId('fetching')
      updateStageStatus('fetching', 'running')
      addActivityLog(`${STAGE_CONFIGURATIONS['fetching'].icon} ${STAGE_CONFIGURATIONS['fetching'].description}`)
      setProgress(10)

      // Make the actual API call (all checks run in parallel on backend)
      const response = await fetch('/api/aeo/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Health check failed')
      }

      const data = await response.json()

      setResult(data)

      // API call complete - mark all stages as complete instantly
      // (they all ran in parallel on the backend)
      updateStageStatus('fetching', 'complete')
      setProgress(20)

      const checkStages = ['technical', 'structured_data', 'crawler', 'authority'] as const
      for (const stageId of checkStages) {
        updateStageStatus(stageId, 'running')
        addActivityLog(`${STAGE_CONFIGURATIONS[stageId].icon} ${STAGE_CONFIGURATIONS[stageId].description}`)
        await new Promise(resolve => setTimeout(resolve, 100)) // Tiny delay for visual feedback
        updateStageStatus(stageId, 'complete')
        setProgress(prev => Math.min(prev + 15, 90))
      }

      // Scoring stage
      setCurrentStageId('scoring')
      updateStageStatus('scoring', 'running')
      addActivityLog(`${STAGE_CONFIGURATIONS['scoring'].icon} ${STAGE_CONFIGURATIONS['scoring'].description}`)
      await new Promise(resolve => setTimeout(resolve, 200))
      updateStageStatus('scoring', 'complete')

      addActivityLog(`✅ Health check complete!`)
      setRunningStatus('complete')
      setProgress(100)
      setEstimate(0)
      toast.success('Health check completed successfully!')

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Health check failed'
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const getStatusIcon = (passed: boolean, severity: string) => {
    if (passed) return <CheckCircle2 className="h-4 w-4 text-green-600" />
    if (severity === 'error') return <XCircle className="h-4 w-4 text-red-600" />
    return <AlertCircle className="h-4 w-4 text-yellow-600" />
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="url">Website URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !url}
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
      </Card>

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
          successMessage={runningStatus === 'complete' ? 'Health check completed!' : undefined}
        />
      )}

      {/* Results */}
      {result && runningStatus === 'complete' && (
        <Card className="p-6 space-y-6">
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

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{result.summary.passed}</div>
              <div className="text-xs text-muted-foreground">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{result.summary.errors}</div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{result.summary.warnings}</div>
              <div className="text-xs text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{result.summary.total_checks}</div>
              <div className="text-xs text-muted-foreground">Total Checks</div>
            </div>
          </div>

          {/* Issues by Category */}
          <Accordion type="multiple" defaultValue={['technical', 'structured_data', 'crawler', 'authority']}>
            {Object.entries(
              result.issues.reduce((acc, issue) => {
                if (!acc[issue.category]) acc[issue.category] = []
                acc[issue.category].push(issue)
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
        </Card>
      )}
    </div>
  )
}
