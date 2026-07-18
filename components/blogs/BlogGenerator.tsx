/**
 * Blog Generator Component
 * Generates AEO-optimized blog articles using Gemini AI (standalone, no Modal)
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Sparkles, Download, Plus, X, Upload, ChevronDown, ChevronUp, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useContextStorage } from '@/hooks/useContextStorage'
import { toast } from 'sonner'
import { RunningState } from '@/components/shared/RunningState'

const TONE_EXAMPLES = [
  {
    value: 'professional',
    label: 'Professional',
    description: 'Business-focused, formal',
    example: '"Our platform delivers measurable ROI through advanced analytics."',
    bestFor: 'B2B content, corporate blogs, whitepapers'
  },
  {
    value: 'casual',
    label: 'Casual',
    description: 'Conversational, relaxed',
    example: '"Let\'s dive into how this tool can make your life easier."',
    bestFor: 'Consumer blogs, social content, lifestyle'
  },
  {
    value: 'technical',
    label: 'Technical',
    description: 'Developer/engineer-focused',
    example: '"The API implements OAuth 2.0 with JWT token validation."',
    bestFor: 'Documentation, dev blogs, technical guides'
  },
  {
    value: 'friendly',
    label: 'Friendly',
    description: 'Warm, approachable',
    example: '"We\'re here to help you succeed every step of the way!"',
    bestFor: 'Customer support, onboarding, community'
  },
  {
    value: 'authoritative',
    label: 'Authoritative',
    description: 'Expert, thought-leadership',
    example: '"Based on 10 years of research, we\'ve identified three key trends."',
    bestFor: 'Industry reports, analyst content, expert columns'
  },
  {
    value: 'educational',
    label: 'Educational',
    description: 'Teaching-focused, clear',
    example: '"Here\'s a step-by-step guide to understanding machine learning."',
    bestFor: 'Tutorials, courses, how-to guides, explainers'
  },
]

interface BlogResult {
  title: string
  content: string
  metadata: {
    keyword: string
    word_count: number
    generation_time: number
    company_name: string
    company_url: string
    aeo_score?: number
    job_id?: string
    slug?: string
  }
}

interface BatchKeyword {
  keyword: string
  word_count?: number
  instructions?: string
}

interface BatchResult {
  batch_id: string
  total: number
  successful: number
  failed: number
  results: Array<{
    keyword: string
    title?: string
    content?: string
    word_count?: number
    aeo_score?: number
    error?: string
  }>
  generation_time: number
}

export function BlogGenerator() {
  const { businessContext, hasContext, updateContext, isLoading: isContextLoading } = useContextStorage()
  
  // Form state
  const [batchMode, setBatchMode] = useState(false)
  const [primaryKeyword, setPrimaryKeyword] = useState('')
  const [batchKeywords, setBatchKeywords] = useState<BatchKeyword[]>([
    { keyword: '' }
  ])
  const [wordCount, setWordCount] = useState(1000)
  const [tone, setTone] = useState('professional')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [systemPrompts, setSystemPrompts] = useState('')
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  
  // Progress tracking - using refs to avoid state conflicts
  const [progress, setProgress] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [currentStage, setCurrentStage] = useState('Initializing...')
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const generationStartTimeRef = useRef<number>(0)
  const estimatedDurationRef = useRef<number>(180)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Track if user is actively editing fields (prevent context overwrites)
  const isEditingRef = useRef<{ systemPrompts: boolean; additionalInstructions: boolean }>({
    systemPrompts: false,
    additionalInstructions: false,
  })
  
  // Results state
  const [result, setResult] = useState<BlogResult | null>(null)
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Persistent generation tracking
  const GENERATION_STATE_KEY = 'blog_generation_state'

  // Current job ID for polling
  const currentJobIdRef = useRef<string | null>(null)
  
  // Track last progress value to prevent jumping backwards
  const lastProgressRef = useRef(0)

  // Restore form state on mount (progress can't be restored without job ID)
  useEffect(() => {
    try {
      const savedState = sessionStorage.getItem(GENERATION_STATE_KEY)
      if (!savedState) return

      const state = JSON.parse(savedState)
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
      
      // Only restore form fields if recently saved (under 5 min)
      if (elapsed < 300) {
        // Restore form state only (not generating state)
        setBatchMode(state.batchMode)
        if (state.batchMode) {
          setBatchKeywords(state.batchKeywords || [])
        } else {
          setPrimaryKeyword(state.primaryKeyword || '')
        }
        setWordCount(state.wordCount || 1000)
        setTone(state.tone || 'professional')
        
        toast.info('Form restored. Please restart generation if needed.')
      }
      
      // Always clear old state
      sessionStorage.removeItem(GENERATION_STATE_KEY)
    } catch (e) {
      console.error('Failed to restore generation state:', e)
      try {
        sessionStorage.removeItem(GENERATION_STATE_KEY)
      } catch {
        // Ignore cleanup errors
      }
    }
  }, [])
  
  // Load system instructions from context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Only load from context if user is NOT actively editing (prevent overwrites)
      if (!isEditingRef.current.systemPrompts) {
        // Load Client Knowledge Base from context (preferred) or fallback to systemInstructions
        if (businessContext.clientKnowledgeBase) {
          setSystemPrompts(businessContext.clientKnowledgeBase)
        } else if (businessContext.systemInstructions) {
          setSystemPrompts(businessContext.systemInstructions)
        }
      }

      // Only load from context if user is NOT actively editing
      if (!isEditingRef.current.additionalInstructions) {
        // Load Content Instructions from context
        if (businessContext.contentInstructions) {
          setAdditionalInstructions(businessContext.contentInstructions)
        }
      }
    }
  }, [businessContext.clientKnowledgeBase, businessContext.contentInstructions, businessContext.systemInstructions])

  
  // Get company info from context
  const companyName = businessContext.companyName || ''
  const companyUrl = businessContext.companyWebsite || ''

  const handleCsvUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter(line => line.trim())
        
        // Parse CSV (supports: "keyword", "keyword,word_count", or "keyword,word_count,instructions")
        const keywords = lines
          .map(line => {
            const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''))
            return {
              keyword: parts[0],
              word_count: parts[1] && !isNaN(parseInt(parts[1])) ? parseInt(parts[1]) : undefined,
              instructions: parts[2] || undefined,
            }
          })
          .filter(k => k.keyword && k.keyword.length > 0)
          .slice(0, 50) // Max 50 keywords

        if (keywords.length === 0) {
          toast.error('No valid keywords found in CSV')
          return
        }

        setBatchKeywords(keywords)
        toast.success(`Loaded ${keywords.length} keywords from CSV`)
      } catch (error) {
        console.error('CSV parse error:', error)
        toast.error('Failed to parse CSV file')
      }
    }

    reader.onerror = () => {
      toast.error('Failed to read CSV file')
    }

    reader.readAsText(file)
    
    // Reset file input
    event.target.value = ''
  }, [])

  const handleGenerate = useCallback(async () => {
    // Prevent multiple simultaneous generations
    if (isGenerating) {
      toast.warning('Generation already in progress')
      return
    }

    if (!batchMode && !primaryKeyword.trim()) {
      toast.error('Please enter a primary keyword')
      return
    }

    if (batchMode) {
      const validKeywords = batchKeywords.filter(k => k.keyword.trim())
      if (validKeywords.length === 0) {
        toast.error('Please enter at least one keyword for batch generation')
        return
      }
    }

    if (!companyName.trim() || !companyUrl.trim()) {
      toast.error('Please analyze a company website in the CONTEXT tab first.')
      return
    }

    // Clear any existing abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller with 3 minute timeout
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setIsGenerating(true)
    setResult(null)
    setBatchResult(null)
    setProgress(0)
    setCurrentStage('Initializing...')

    // Clear any existing progress interval first to prevent duplicates
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }

    const estimatedTime = batchMode ? batchKeywords.filter(k => k.keyword.trim()).length * 90 : 180
    setTimeRemaining(estimatedTime)

    // Set 3 minute (180s) timeout - API takes 77-181s
    let timeoutId: NodeJS.Timeout | undefined
    timeoutId = setTimeout(() => {
      abortController.abort()
      toast.error('Request timed out after 3 minutes. Please try again.')
    }, 180000)

    // Setup refs for time-based progress calculation
    const startTime = Date.now()
    generationStartTimeRef.current = startTime
    estimatedDurationRef.current = estimatedTime

    // Save generation state to sessionStorage for persistence
    try {
      const generationState = {
        startTime,
        batchMode,
        primaryKeyword,
        batchKeywords,
        wordCount,
        tone,
      }
      sessionStorage.setItem(GENERATION_STATE_KEY, JSON.stringify(generationState))
    } catch (e) {
      console.warn('Failed to save generation state:', e)
      // Continue anyway - not critical
    }

    try {
      const requestBody = batchMode ? {
        keyword: 'batch',
        word_count: wordCount,
        tone: tone,
        system_prompts: systemPrompts.trim() ? systemPrompts.trim().split('\n').filter(p => p.trim()) : [],
        additional_instructions: additionalInstructions.trim(),
        company_name: companyName.trim(),
        company_url: companyUrl.trim(),
        business_context: businessContext,
        batch_mode: true,
        batch_keywords: batchKeywords.filter(k => k.keyword.trim()),
      } : {
        keyword: primaryKeyword.trim(),
        word_count: wordCount,
        tone: tone,
        system_prompts: systemPrompts.trim() ? systemPrompts.trim().split('\n').filter(p => p.trim()) : [],
        additional_instructions: additionalInstructions.trim(),
        company_name: companyName.trim(),
        company_url: companyUrl.trim(),
        business_context: businessContext,
      }

      // Step 1: Create job and get job_id
      setCurrentStage('Creating job...')
      const createResponse = await fetch('/api/blog-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      })

      if (!createResponse.ok) {
        const error = await createResponse.json().catch(() => ({ error: 'Failed to create job' }))
        throw new Error(error.error || error.message || 'Failed to create job')
      }

      const jobData = await createResponse.json()
      const jobId = jobData.job_id

      // Step 2: Poll until job is complete, updating progress from backend
      setCurrentStage('Starting generation...')
      currentJobIdRef.current = jobId
      lastProgressRef.current = 0
      
      let job = null
      const pollStartTime = Date.now()
      const maxPollTime = 300000 // 5 minutes

      while (Date.now() - pollStartTime < maxPollTime) {
        // Check for abort
        if (abortController.signal.aborted) {
          throw new Error('Generation cancelled')
        }

        const statusResponse = await fetch(`/api/blog-job/${jobId}`)
        if (!statusResponse.ok) {
          throw new Error('Failed to get job status')
        }

        job = await statusResponse.json()
        
        // Update progress from backend (only go forward, never backward)
        const backendProgress = job.progress?.percent ?? 0
        if (backendProgress > lastProgressRef.current) {
          lastProgressRef.current = backendProgress
          setProgress(backendProgress)
        }
        
        // Update stage message from backend
        if (job.progress?.message) {
          setCurrentStage(job.progress.message)
        }
        
        // Estimate time remaining based on actual progress rate
        if (backendProgress > 0 && backendProgress < 100) {
          const elapsed = (Date.now() - startTime) / 1000
          const rate = backendProgress / elapsed
          const remaining = (100 - backendProgress) / rate
          setTimeRemaining(Math.max(0, Math.round(remaining)))
        }

        if (job.status === 'completed') {
          break
        }

        if (job.status === 'failed') {
          throw new Error(job.error || 'Job failed')
        }

        // Wait 1 second before next poll
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      if (!job || job.status !== 'completed') {
        throw new Error('Job timed out')
      }

      // Step 3: Extract result from completed job
      const generationTime = (Date.now() - startTime) / 1000
      const result = job.result

      setProgress(100)
      setCurrentStage('Complete!')

      // Transform result to match frontend schema
      if (batchMode) {
        const articles = result?.articles || []
        const data = {
          batch_id: job.job_id,
          total: articles.length,
          successful: articles.length,
          failed: 0,
          generation_time: generationTime,
          results: articles.map((article: { keyword?: string; headline?: string; html_content?: string; word_count?: number; aeo_score?: number }) => ({
            keyword: article.keyword,
            title: article.headline,
            content: article.html_content,
            word_count: article.word_count,
            aeo_score: article.aeo_score,
          })),
        }

        setBatchResult(data)
        toast.success(`Generated ${data.successful} of ${data.total} blog articles in ${generationTime.toFixed(1)}s`)
        
        // Clear generation state on success
        try {
          sessionStorage.removeItem(GENERATION_STATE_KEY)
        } catch (e) {
          console.warn('Failed to clear generation state:', e)
        }
        
        // Store batch in localStorage
        try {
          const timestamp = new Date().toISOString()
          const logEntry = {
            id: `batch-${Date.now()}`,
            type: 'blog_batch',
            timestamp,
            company: companyName.trim(),
            url: companyUrl.trim(),
            batchId: data.batch_id,
            total: data.total,
            successful: data.successful,
            failed: data.failed,
            generationTime: generationTime,
            results: data.results,
          }
          
          const existingLogsStr = localStorage.getItem('bulk-gpt-logs')
          let existingLogs: unknown[] = []
          try {
            existingLogs = existingLogsStr ? JSON.parse(existingLogsStr) : []
          } catch (e) {
            console.warn('Failed to parse existing logs, starting fresh:', e)
            existingLogs = []
          }
          
          existingLogs.unshift(logEntry)
          localStorage.setItem('bulk-gpt-logs', JSON.stringify(existingLogs.slice(0, 50)))
        } catch (e) {
          console.warn('Failed to save batch to localStorage:', e)
        }
      } else {
        // Single article mode
        const articles = result?.articles || []
        if (articles.length === 0) {
          throw new Error('No article generated')
        }
        
        const article = articles[0]
        const data = {
          title: article.headline,
          content: article.html_content,
          metadata: {
            keyword: primaryKeyword.trim(),
            word_count: article.word_count || 0,
            generation_time: generationTime,
            company_name: companyName.trim(),
            company_url: companyUrl.trim(),
            aeo_score: article.aeo_score,
            job_id: job.job_id,
            slug: article.slug,
            meta_title: article.meta_title,
            meta_description: article.meta_description,
            read_time: article.read_time,
            sources: article.sources,
          },
        }

        setResult(data)
        toast.success(`Generated blog article (${data.metadata.word_count} words) in ${generationTime.toFixed(1)}s`)
        
        // Clear generation state on success
        try {
          sessionStorage.removeItem(GENERATION_STATE_KEY)
        } catch (e) {
          console.warn('Failed to clear generation state:', e)
        }
        
        // Store in localStorage for LOG page
        try {
          const timestamp = new Date().toISOString()
          const logEntry = {
            id: `blog-${Date.now()}`,
            type: 'blog',
            timestamp,
            company: companyName.trim(),
            url: companyUrl.trim(),
            keyword: primaryKeyword.trim(),
            wordCount: wordCount,
            generationTime: generationTime,
            title: data.title || '',
            content: data.content || '',
            aeoScore: data.metadata.aeo_score,
          }
          
          const existingLogsStr = localStorage.getItem('bulk-gpt-logs')
          let existingLogs: any[] = []
          try {
            existingLogs = existingLogsStr ? JSON.parse(existingLogsStr) : []
          } catch (e) {
            console.warn('Failed to parse existing logs, starting fresh:', e)
            existingLogs = []
          }
          
          existingLogs.unshift(logEntry)
          localStorage.setItem('bulk-gpt-logs', JSON.stringify(existingLogs.slice(0, 50)))
        } catch (e) {
          console.warn('Failed to save blog to localStorage:', e)
          // Continue anyway - not critical
        }
      }
    } catch (error) {
      // Don't show error if request was aborted (component unmounted)
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      
      console.error('Blog generation error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate blog')
      
      // Clear generation state on error
      try {
        sessionStorage.removeItem(GENERATION_STATE_KEY)
      } catch (e) {
        console.warn('Failed to clear generation state:', e)
      }
    } finally {
      clearTimeout(timeoutId) // Clear the 3 minute timeout
      setIsGenerating(false)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      setProgress(100)
      setTimeRemaining(0)
      abortControllerRef.current = null
    }
  }, [batchMode, primaryKeyword, batchKeywords, wordCount, systemPrompts, additionalInstructions, companyName, companyUrl, businessContext, isGenerating])

  return (
    <div className="h-full flex">
      {/* Left Panel - Input Form */}
      <div className="w-96 h-full border-r border-border flex flex-col">
        <div className="flex-1 overflow-auto p-6 pb-24">
          <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Generate Blog Article</h2>
            <p className="text-xs text-muted-foreground">
              AI-powered content creation optimized for AEO
            </p>
          </div>

          {/* AEO Explanation */}
          <div className="bg-gradient-to-r from-purple-500/5 to-blue-500/5 border-l-4 border-purple-500 rounded-r-lg p-4 space-y-1">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="text-lg">✍️</span>
              AEO-Optimized Content
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Creates comprehensive articles designed to rank in AI search engines and answer engines.
            </p>
          </div>

          {/* Loading State */}
          {isContextLoading && (
            <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Loading company context...</p>
            </div>
          )}

          {/* No Context Warning - only show when not loading */}
          {!isContextLoading && !hasContext && (
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

          {/* Show company info from context */}
          {hasContext && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-primary/90">Using Company Context</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Company:</span>
                  <span className="text-xs font-medium">{companyName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">URL:</span>
                  <span className="text-xs font-medium truncate max-w-[200px]">{companyUrl}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Batch Mode Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="batch-mode" className="text-sm font-medium cursor-pointer">
                  Batch Generation
                </Label>
                <p className="text-xs text-muted-foreground">
                  Generate multiple blogs with internal linking
                </p>
              </div>
              <Switch
                id="batch-mode"
                checked={batchMode}
                onCheckedChange={(checked) => {
                  setBatchMode(checked)
                  setResult(null)
                  setBatchResult(null)
                }}
                disabled={isGenerating}
              />
            </div>

            {/* Single Keyword Input */}
            {!batchMode && (
              <div className="space-y-2">
                <Label htmlFor="keyword" className="text-xs font-medium">
                  Primary Keyword <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="keyword"
                  type="text"
                  placeholder="e.g., AI-powered project management"
                  value={primaryKeyword}
                  onChange={(e) => setPrimaryKeyword(e.target.value)}
                  className="text-sm"
                  disabled={isGenerating}
                />
              </div>
            )}

            {/* Batch Keywords Input */}
            {batchMode && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">
                    Keywords <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isGenerating}
                      className="h-7 text-xs"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Upload CSV
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setBatchKeywords([...batchKeywords, { keyword: '' }])}
                      disabled={isGenerating || batchKeywords.length >= 50}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {batchKeywords.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="text"
                        placeholder={`Keyword ${index + 1}`}
                        value={item.keyword}
                        onChange={(e) => {
                          const updated = [...batchKeywords]
                          updated[index].keyword = e.target.value
                          setBatchKeywords(updated)
                        }}
                        className="text-sm flex-1"
                        disabled={isGenerating}
                      />
                      {batchKeywords.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBatchKeywords(batchKeywords.filter((_, i) => i !== index))
                          }}
                          disabled={isGenerating}
                          className="h-9 px-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="bg-muted/30 rounded-lg p-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    💡 CSV Format
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Format: <code className="bg-background px-1 py-0.5 rounded">keyword[,word_count][,instructions]</code>
                  </p>
                  <code className="text-xs block bg-background p-1.5 rounded mt-1 font-mono">
                    AI in healthcare<br/>
                    Machine learning basics,1500<br/>
                    Data science tools,2000,Include case studies
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  🔗 Blogs will automatically link to each other for better SEO
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="word-count" className="text-xs font-medium">
                  Word Count {batchMode && <span className="text-muted-foreground">(default)</span>}
                </Label>
                <Input
                  id="word-count"
                  type="number"
                  min={500}
                  max={3000}
                  value={wordCount}
                  onChange={(e) => setWordCount(Math.max(500, Math.min(3000, parseInt(e.target.value) || 1000)))}
                  className="text-sm"
                  disabled={isGenerating}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="tone" className="text-xs font-medium">
                    Tone
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline decoration-dotted cursor-help"
                      >
                        examples?
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <div className="max-h-96 overflow-y-auto">
                        {TONE_EXAMPLES.map((toneEx, idx) => (
                          <div
                            key={toneEx.value}
                            className={`p-3 ${idx !== TONE_EXAMPLES.length - 1 ? 'border-b border-border' : ''} ${
                              tone === toneEx.value ? 'bg-primary/5' : ''
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="font-medium text-sm">{toneEx.label}</div>
                              <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 font-mono">
                                {toneEx.example}
                              </div>
                              <div className="text-xs text-muted-foreground">→ {toneEx.bestFor}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <select
                  id="tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isGenerating}
                >
                  {TONE_EXAMPLES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Advanced Options - Collapsible */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full px-3 py-2 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
              >
                <span className="text-xs">Advanced Options</span>
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showAdvanced && (
                <div className="p-3 space-y-3 border-t border-border">
                  <div className="space-y-2">
                    <Label htmlFor="system-prompts" className="text-xs font-medium">
                      Client Knowledge Base
                    </Label>
                    <Textarea
                      id="system-prompts"
                      placeholder="Company facts (one per line):&#10;We target Fortune 500&#10;We specialize in security"
                      value={systemPrompts}
                      onFocus={() => {
                        isEditingRef.current.systemPrompts = true
                      }}
                      onBlur={() => {
                        isEditingRef.current.systemPrompts = false
                      }}
                      onChange={(e) => {
                        setSystemPrompts(e.target.value)
                        // Save to context
                        updateContext({ clientKnowledgeBase: e.target.value })
                      }}
                      className="text-xs resize-none font-mono"
                      rows={3}
                      disabled={isGenerating}
                    />
                    <p className="text-xs text-muted-foreground">
                      Facts about your company
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instructions" className="text-xs font-medium">
                      Content Instructions
                    </Label>
                    <Textarea
                      id="instructions"
                      placeholder="e.g., Include statistics, add case studies"
                      value={additionalInstructions}
                      onFocus={() => {
                        isEditingRef.current.additionalInstructions = true
                      }}
                      onBlur={() => {
                        isEditingRef.current.additionalInstructions = false
                      }}
                      onChange={(e) => {
                        setAdditionalInstructions(e.target.value)
                        // Save to context
                        updateContext({ contentInstructions: e.target.value })
                      }}
                      className="text-xs resize-none"
                      rows={2}
                      disabled={isGenerating}
                    />
                    <p className="text-xs text-muted-foreground">
                      How to write the content
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
          </div>

        {/* Sticky Generate Button - Fixed at bottom (outside scrollable area) */}
        <div className="p-4 bg-background/95 backdrop-blur-sm border-t border-border/50 shadow-lg">
          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={!hasContext || isGenerating || isRefreshing || (!batchMode && !primaryKeyword.trim()) || (batchMode && !batchKeywords.some(k => k.keyword.trim()))}
              className="flex-1 min-h-[48px]"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {batchMode ? `Generate ${batchKeywords.filter(k => k.keyword.trim()).length} Blogs` : 'Generate Blog Article'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel - Results/Loading */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        {isGenerating && (
          <div className="h-full flex items-center justify-center">
            <RunningState
              status="running"
              progress={progress}
              currentStage={currentStage}
              estimate={timeRemaining}
              onCancel={() => {
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort()
                }
                setIsGenerating(false)
                toast.info('Generation cancelled')
              }}
              className="max-w-lg w-full"
            />
          </div>
        )}

        {!result && !batchResult && !isGenerating && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {batchMode ? 'Enter keywords and click Generate to start batch' : 'Enter a keyword and click Generate to start'}
              </p>
            </div>
          </div>
        )}

        {batchResult && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between pb-4 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">Batch Generation Complete</h3>
                <p className="text-xs text-muted-foreground">
                  {batchResult.successful} of {batchResult.total} blogs generated • {batchResult.generation_time.toFixed(1)}s
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const successfulBlogs = batchResult.results.filter(r => !r.error)
                  const csvContent = [
                    ['Keyword', 'Title', 'Word Count', 'AEO Score', 'Status'].join(','),
                    ...batchResult.results.map(r => [
                      `"${r.keyword}"`,
                      `"${r.title || ''}"`,
                      r.word_count || 0,
                      r.aeo_score || 0,
                      r.error ? 'Failed' : 'Success'
                    ].join(','))
                  ].join('\n')

                  const blob = new Blob([csvContent], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  
                  const timestamp = new Date().toISOString().split('T')[0]
                  a.download = `batch-blogs-${timestamp}-${batchResult.batch_id.slice(-8)}.csv`
                  
                  a.click()
                  URL.revokeObjectURL(url)
                  toast.success('Batch summary exported')
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Summary
              </Button>
            </div>

            <div className="flex-1 overflow-auto border border-border rounded-lg">
              <div className="divide-y divide-border">
                {batchResult.results.map((blogResult, index) => (
                  <div key={index} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{index + 1}.</span>
                          <span className="text-sm font-semibold">{blogResult.keyword}</span>
                          {blogResult.error ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                              Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Success
                            </span>
                          )}
                        </div>
                        {blogResult.title && (
                          <p className="text-sm text-muted-foreground pl-6">{blogResult.title}</p>
                        )}
                        {blogResult.error && (
                          <p className="text-xs text-destructive pl-6">{blogResult.error}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pl-6">
                          {blogResult.word_count && (
                            <span>{blogResult.word_count} words</span>
                          )}
                          {blogResult.aeo_score !== undefined && (
                            <span className="font-medium text-primary">AEO: {blogResult.aeo_score}/100</span>
                          )}
                        </div>
                      </div>
                      {blogResult.content && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const markdown = `# ${blogResult.title}\n\n${blogResult.content}`
                            const blob = new Blob([markdown], { type: 'text/markdown' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            
                            const timestamp = new Date().toISOString().split('T')[0]
                            const keywordSlug = blogResult.keyword.replace(/[^a-z0-9]/gi, '-').toLowerCase()
                            a.download = `blog-${keywordSlug}-${timestamp}.md`
                            
                            a.click()
                            URL.revokeObjectURL(url)
                            toast.success('Blog exported')
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between pb-4 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">{result.title}</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{result.metadata.word_count} words</span>
                  <span>•</span>
                  <span>{result.metadata.generation_time.toFixed(1)}s</span>
                  {result.metadata.aeo_score !== undefined && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-primary">AEO: {result.metadata.aeo_score}/100</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!result.content) {
                      toast.error('No content to refresh')
                      return
                    }

                    setIsRefreshing(true)
                    
                    // Create abort controller for refresh
                    const refreshAbortController = new AbortController()
                    
                    try {
                      // Build instructions from context (consistent format with generation)
                      const instructions: string[] = []
                      
                      // Use same format as generation: split by newlines for Client Knowledge Base
                      if (businessContext.clientKnowledgeBase) {
                        const knowledgeBaseLines = businessContext.clientKnowledgeBase
                          .split('\n')
                          .filter(line => line.trim())
                        instructions.push(...knowledgeBaseLines)
                      }
                      
                      // Add Content Instructions as single instruction
                      if (businessContext.contentInstructions) {
                        instructions.push(businessContext.contentInstructions)
                      }
                      
                      // Fallback to systemInstructions if no specific instructions
                      if (businessContext.systemInstructions && instructions.length === 0) {
                        const systemLines = businessContext.systemInstructions
                          .split('\n')
                          .filter(line => line.trim())
                        instructions.push(...systemLines)
                      }
                      
                      // Fallback if no instructions set
                      if (instructions.length === 0) {
                        instructions.push('Update to latest information', 'Improve clarity')
                      }
                      
                      const response = await fetch('/api/refresh-blog', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          content: result.content,
                          content_format: 'html',
                          instructions: instructions,
                          output_format: 'html',
                        }),
                        signal: refreshAbortController.signal,
                      })
                      
                      if (!response.ok) {
                        // Parse error response for better error messages
                        let errorMessage = 'Refresh failed'
                        try {
                          const errorData = await response.json()
                          errorMessage = errorData.error || errorData.message || errorMessage
                        } catch {
                          // If JSON parse fails, use status text
                          errorMessage = `Refresh failed: ${response.status} ${response.statusText}`
                        }
                        throw new Error(errorMessage)
                      }
                      
                      const refreshData = await response.json()
                      
                      // Validate response structure
                      if (!refreshData || typeof refreshData !== 'object') {
                        throw new Error('Invalid response format')
                      }
                      
                      if (refreshData.success && refreshData.refreshed_html) {
                        setResult({
                          ...result,
                          content: refreshData.refreshed_html,
                        })
                        toast.success('Blog refreshed successfully')
                      } else {
                        throw new Error(refreshData.error || 'Refresh failed')
                      }
                    } catch (error) {
                      // Don't show error if request was aborted
                      if (error instanceof Error && error.name === 'AbortError') {
                        return
                      }
                      
                      toast.error(error instanceof Error ? error.message : 'Failed to refresh blog')
                    } finally {
                      setIsRefreshing(false)
                    }
                  }}
                  disabled={isGenerating || isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Export as Markdown
                    const markdown = `# ${result.title}\n\n${result.content}`
                    const blob = new Blob([markdown], { type: 'text/markdown' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    
                    const timestamp = new Date().toISOString().split('T')[0]
                    const keywordSlug = result.metadata.keyword.replace(/[^a-z0-9]/gi, '-').toLowerCase()
                    a.download = `blog-${keywordSlug}-${timestamp}.md`
                    
                    a.click()
                    URL.revokeObjectURL(url)
                    toast.success('Blog exported as Markdown')
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export MD
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto border border-border rounded-lg p-6 prose prose-sm dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: result.content }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

