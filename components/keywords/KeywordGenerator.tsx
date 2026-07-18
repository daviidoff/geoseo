/**
 * Keyword Generator Component
 * Generates AEO-optimized keywords using Gemini AI (standalone, no Modal)
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Sparkles, ChevronDown, X, Clock, Globe, FileEdit } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useMobile } from '@/hooks/useMobile'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExternalLink, MessageSquare, TrendingUp, FileText, Search, Target, Users, Lightbulb, Copy, Check, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { COUNTRIES, LANGUAGES } from '@/lib/constants/countries-languages'
import { useContextStorage } from '@/hooks/useContextStorage'
import { ContextPanel } from '@/components/shared/ContextPanel'
import { toast } from 'sonner'
import { downloadXLSX } from '@/lib/export'
import {
  fetchWithRetry,
  checkServerHealth,
  getFriendlyErrorMessage,
  type FetchError
} from '@/lib/fetch-utils'
import { useBackgroundJobsContext } from '@/contexts/BackgroundJobsContext'
import { Progress } from '@/components/ui/progress'
import { RunningState, type Stage } from '@/components/shared/RunningState'
import type {
  KeywordResponse,
  Keyword as APIKeyword,
  KeywordMetadata,
} from '@/lib/schemas/api'
import { getKeywordCreditUnits } from '@/lib/config/pricing.config'
import { CreditCostPreview } from '@/components/ui/credit-cost-preview'

const LOADING_MESSAGES = [
  '🔍 Analyzing your business context (~1 minute expected)',
  '🧠 Understanding your target audience ',
  '🎯 Deep research & SERP analysis in progress',
  '💡 AI generating keyword clusters',
  '🤖 Optimizing for AI platforms',
  '✨ Finalizing recommendations',
]

// Individual stage progress components matching real backend stages
// Durations are estimates based on typical API response times
const STAGE_CONFIGURATIONS = {
  'company_analysis': {
    name: 'Company Analysis',
    duration: 8, // Context extraction from website
    icon: '🔍',
    description: 'Extracting company context from website...',
    color: 'text-blue-600',
    substeps: ['Initializing', 'Fetching website data', 'Extracting context', 'Building business profile']
  },
  'ai_generation': {
    name: 'AI Keyword Generation', 
    duration: 20, // Gemini API call for keywords
    icon: '🧠',
    description: 'Generating keywords with AI...',
    color: 'text-purple-600',
    substeps: ['Preparing prompt', 'Gemini API processing', 'Generating keyword seeds', 'Expanding variations', 'Scoring relevance']
  },
  'research': {
    name: 'Research Analysis', 
    duration: 15, // Research data collection
    icon: '📊',
    description: 'Analyzing research sources...',
    color: 'text-green-600',
    substeps: ['Searching forums', 'Analyzing discussions', 'Extracting terminology', 'Finding niche terms']
  },
  'serp_analysis': {
    name: 'SERP Analysis', 
    duration: 25, // Gemini with Google Search grounding
    icon: '🎯',
    description: 'Analyzing search results...',
    color: 'text-orange-600',
    substeps: ['Fetching SERPs', 'Analyzing snippets', 'Checking PAA questions', 'Scoring opportunity']
  },
  'deduplication': {
    name: 'Deduplication', 
    duration: 10, // Semantic deduplication
    icon: '✨',
    description: 'Removing duplicates...',
    color: 'text-indigo-600',
    substeps: ['Analyzing similarity', 'Clustering semantics', 'Removing duplicates', 'Merging variations']
  },
  'clustering': {
    name: 'Clustering', 
    duration: 15, // Semantic clustering
    icon: '📋',
    description: 'Grouping by topic...',
    color: 'text-teal-600',
    substeps: ['Creating topic groups', 'Semantic clustering', 'Intent organization', 'Theme grouping']
  },
  'finalization': {
    name: 'Finalization', 
    duration: 5, // Quick final processing
    icon: '🎉',
    description: 'Preparing results...',
    color: 'text-green-600',
    substeps: ['Formatting output', 'Validating data', 'Creating summary', 'Complete!']
  }
}

// Stage order for progression
const STAGE_ORDER = ['company_analysis', 'ai_generation', 'research', 'serp_analysis', 'deduplication', 'clustering', 'finalization'] as const

/**
 * Keyword interface for UI rendering
 * Core fields match KeywordResponse from @/lib/schemas/api but with extended display fields
 */
interface Keyword {
  keyword: string
  intent: string // question, commercial, transactional, comparison, informational
  score: number // company-fit score (0-100)
  is_question: boolean
  cluster_name?: string // semantic cluster grouping
  source?: string // ai_generated, research_reddit, research_quora, research_niche, gap_analysis, serp_paa
  volume?: number // monthly search volume
  difficulty?: number // keyword difficulty (0-100)
  aeo_opportunity?: string | number // AEO opportunity score (0-100)
  has_featured_snippet?: boolean
  has_paa?: boolean
  serp_analyzed?: boolean
  // Enhanced data fields
  research_summary?: string
  research_source_urls?: string[]
  top_ranking_urls?: string[]
  featured_snippet_url?: string
  paa_questions_with_urls?: Array<{ question: string; url: string }>
  research_data?: {
    sources?: Array<{
      quote?: string
      url?: string
      platform?: string
      source_title?: string
      author?: string
      date?: string
      upvotes?: number
      comments_count?: number
      views?: number
      subreddit?: string
      pain_point_extracted?: string
      sentiment?: string
    }>
    most_mentioned_pain_points?: string[]
    common_solutions_mentioned?: Array<{ tool?: string; mentions?: number; context?: string }>
  }
  serp_data?: {
    organic_results?: Array<{
      position?: number
      url?: string
      title?: string
      description?: string
      meta_title?: string
      meta_description?: string
      domain?: string
      domain_authority?: number
      is_big_brand?: boolean
      estimated_word_count?: number
    }>
    featured_snippet?: {
      type?: string
      content?: string
      source_url?: string
      source_title?: string
    }
    paa_questions?: Array<{
      question?: string
      answer_snippet?: string
      source_url?: string
      source_title?: string
    }>
  }
  content_brief?: {
    content_angle?: string
    target_questions?: string[]
    content_gap?: string
    audience_pain_point?: string
    recommended_word_count?: number
  }
  citations?: Array<{
    id?: number
    type?: string
    platform?: string
    source?: string
    author?: string
    url?: string
    title?: string
    text?: string
    engagement?: string
    format_apa?: string
    format_mla?: string
    format_chicago?: string
  }>
  // Legacy fields for backward compatibility
  aeo_type?: string
  search_intent?: string
  relevance_score?: number
  ai_citation_potential?: string
  competition_level?: string
}

interface KeywordResults {
  keywords: Keyword[]
  metadata: {
    company_name: string
    company_url: string
    total_keywords: number
    generation_time: number
    pipeline?: string
  }
}

interface KeywordGeneration {
  id: string
  company_name: string
  company_url: string | null
  language: string
  country: string
  keywords: Keyword[]
  total_keywords: number
  generation_time: number | null
  created_at: string
}

// Constants moved to shared file for DRY principles

export function KeywordGenerator() {
  const { businessContext, hasContext } = useContextStorage()

  // Derive company info from business context
  const companyName = businessContext?.companyName || ''
  const companyUrl = businessContext?.companyWebsite || ''

  // Form state - defaults from context or fallback to English/US
  const [language, setLanguage] = useState('en')
  const [country, setCountry] = useState('US')
  const [numKeywords, setNumKeywords] = useState(50)

  // Apply primary market from context when available
  useEffect(() => {
    if (businessContext.primaryLanguage) {
      setLanguage(businessContext.primaryLanguage)
    }
    if (businessContext.primaryCountry) {
      setCountry(businessContext.primaryCountry)
    }
  }, [businessContext.primaryLanguage, businessContext.primaryCountry])
  
  // Progress tracking
  const [progress, setProgress] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const statusUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const generationStartTimeRef = useRef<number>(0)
  
  // Individual stage progress tracking (triggered when backend stages start)
  const [activeStages, setActiveStages] = useState<Set<string>>(new Set())
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set())
  const [stageProgress, setStageProgress] = useState<Record<string, number>>({})
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const [stageStartTimes, setStageStartTimes] = useState<Record<string, number>>({})
  const [stageActualDurations, setStageActualDurations] = useState<Record<number, number>>({}) // Track actual elapsed time per stage
  const subprocessStartTime = useRef<number>(0)

  // Cursor-style subprocess steps array (for subprocess progression UI)
  // Skip company analysis if we already have rich context
  const activeStageOrder = hasContext 
    ? STAGE_ORDER.filter(stage => stage !== 'company_analysis')
    : STAGE_ORDER

  const CURSOR_SUBPROCESS_STEPS = activeStageOrder.map((stageKey, index) => ({
    id: stageKey,
    name: STAGE_CONFIGURATIONS[stageKey].name,
    duration: STAGE_CONFIGURATIONS[stageKey].duration,
    substeps: STAGE_CONFIGURATIONS[stageKey].substeps
  }))
  
  // Subprocess tracking state
  const [currentSubprocess, setCurrentSubprocess] = useState(0)
  const [currentSubstep, setCurrentSubstep] = useState(0)
  const currentSubprocessRef = useRef(0) // Ref to track current subprocess for interval callbacks
  const [subprocessProgress, setSubprocessProgress] = useState(0)
  const [visibleSubprocesses, setVisibleSubprocesses] = useState<number[]>([])
  const [completedSubprocesses, setCompletedSubprocesses] = useState<number[]>([])
  
  // Results state
  const [results, setResults] = useState<KeywordResults | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Job-based generation tracking
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const jobPollingRef = useRef<NodeJS.Timeout | null>(null)
  const { createJob } = useBackgroundJobsContext()
  
  // Logs state
  const [logs, setLogs] = useState<string[]>([])
  const [logsExpanded, setLogsExpanded] = useState(true) // Default to expanded for better progress visibility
  
  // Keyword details modal state
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [copiedKeywordId, setCopiedKeywordId] = useState<number | null>(null)
  
  // Keywords selected for blog generation
  const [selectedForBlog, setSelectedForBlog] = useState<Set<string>>(new Set())
  const router = useRouter()

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<keyof Keyword | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filterIntent, setFilterIntent] = useState<string | null>(null)
  const [filterSource, setFilterSource] = useState<string | null>(null)
  const [isLoadingResults, setIsLoadingResults] = useState(false)
  
  // Mobile/Tablet tab state
  const { isMobile, isTablet } = useMobile()
  const isMobileOrTablet = isMobile || isTablet
  const [mobileActiveTab, setMobileActiveTab] = useState<string>('input')
  
  // History state
  const [historyGenerations, setHistoryGenerations] = useState<KeywordGeneration[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  // Fetch selected client from Supabase on mount only
  // After mount, updates come via handleCompanyChange callback from CompanySelector
  useEffect(() => {
    const fetchSelectedClient = async () => {
      try {
        const response = await fetch('/api/user/selected-client')
        if (response.ok) {
          const data = await response.json()
          console.log('[KeywordGenerator] Initial load - selected client:', data.selected_client_id)
          if (data.selected_client_id) {
            setSelectedClientId(data.selected_client_id)
          }
        }
      } catch (error) {
        console.error('[KeywordGenerator] Failed to fetch selected client:', error)
      }
    }
    fetchSelectedClient()
  }, [])

  // Fetch history from Supabase (filtered by selected company)
  const fetchHistory = useCallback(async () => {
    if (!selectedClientId) {
      console.log('[KeywordGenerator] No client selected, skipping history fetch')
      setHistoryGenerations([])
      return
    }
    
    setIsLoadingHistory(true)
    try {
      const params = new URLSearchParams({ limit: '20' })
      params.set('client_id', selectedClientId)
      
      const response = await fetch(`/api/keyword-generations?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch history')
      }
      const data = await response.json()
      console.log('[KeywordGenerator] Fetched history:', data.generations?.length || 0, 'items')
      setHistoryGenerations(data.generations || [])
    } catch (error) {
      console.error('Failed to fetch keyword history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [selectedClientId])

  // Save generation to Supabase (with company association)
  // Accepts company info as parameters to use refreshed context values
  const saveGeneration = useCallback(async (
    keywords: Keyword[], 
    generationTime: number,
    companyInfo?: { name: string; url: string }
  ) => {
    try {
      const response = await fetch('/api/keyword-generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClientId || null, // Associate with selected company
          company_name: companyInfo?.name || businessContext.companyName || companyName || 'Unknown',
          company_url: companyInfo?.url || businessContext.companyWebsite || companyUrl || null,
          language,
          country,
          keywords,
          generation_time: generationTime,
          metadata: {
            num_keywords_requested: numKeywords,
          }
        })
      })
      if (!response.ok) {
        console.warn('Failed to save generation to history')
      } else {
        // Also write to generic history
        try {
          await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'keywords',
              company: companyInfo?.name || businessContext.companyName || companyName || 'Unknown',
              url: companyInfo?.url || businessContext.companyWebsite || companyUrl || null,
              payload: {
                keywords,
                total_keywords: keywords.length,
                language,
                country,
                generationTime: generationTime,
              },
            }),
          })
        } catch (err) {
          console.warn('[KeywordGenerator] Failed to write history log:', err)
        }
        // Refresh history after saving
        fetchHistory()
      }
    } catch (error) {
      console.error('Failed to save generation:', error)
    }
  }, [selectedClientId, businessContext.companyName, businessContext.companyWebsite, companyName, companyUrl, language, country, numKeywords, fetchHistory])

  // Delete a history entry
  const deleteHistoryEntry = useCallback(async (generationId: string) => {
    try {
      const response = await fetch(`/api/keyword-generations?id=${generationId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setHistoryGenerations(prev => prev.filter(g => g.id !== generationId))
        toast.success('Generation deleted')
      } else {
        toast.error('Failed to delete generation')
      }
    } catch (error) {
      toast.error('Failed to delete generation')
    }
  }, [])

  // Load a history entry into the results view
  const loadHistoryEntry = useCallback((generation: KeywordGeneration) => {
    setResults({
      keywords: generation.keywords,
      metadata: {
        company_name: generation.company_name,
        company_url: generation.company_url || '',
        total_keywords: generation.total_keywords,
        generation_time: generation.generation_time || 0,
        pipeline: 'history'
      }
    })
    setLanguage(generation.language)
    setCountry(generation.country)
    setShowHistory(false)
    toast.success(`Loaded ${generation.total_keywords} keywords from history`)
  }, [])

  // Toggle keyword selection for blog generation
  const toggleKeywordSelection = useCallback((keyword: string) => {
    setSelectedForBlog(prev => {
      const next = new Set(prev)
      if (next.has(keyword)) {
        next.delete(keyword)
      } else {
        next.add(keyword)
      }
      return next
    })
  }, [])

  // Select/deselect all keywords
  const toggleSelectAll = useCallback(() => {
    if (!results?.keywords) return
    
    const allKeywords = results.keywords.map(k => k.keyword)
    const allSelected = allKeywords.every(k => selectedForBlog.has(k))
    
    if (allSelected) {
      setSelectedForBlog(new Set())
    } else {
      setSelectedForBlog(new Set(allKeywords))
    }
  }, [results?.keywords, selectedForBlog])

  // Navigate to blogs page with selected keywords
  const handleGenerateBlogs = useCallback(() => {
    if (selectedForBlog.size === 0) {
      toast.error('Please select at least one keyword')
      return
    }
    
    // Store selected keywords in localStorage for the blogs page to read
    const keywordsToGenerate = Array.from(selectedForBlog)
    localStorage.setItem('keywords-for-blog', JSON.stringify({
      keywords: keywordsToGenerate,
      company: results?.metadata?.company_name || businessContext.companyName || '',
      url: results?.metadata?.company_url || businessContext.companyWebsite || '',
      language,
      country,
      timestamp: Date.now()
    }))
    
    toast.success(`${keywordsToGenerate.length} keywords ready for blog generation`)
    router.push('/blogs')
  }, [selectedForBlog, results, businessContext, language, country, router])

  // Note: History is fetched by the selectedClientId change effect below
  // No separate mount effect needed - it would cause race conditions

  // Track previous client ID to prevent duplicate fetches
  const prevClientIdRef = useRef<string | null>('__initial__')
  const isFetchingRef = useRef(false)

  // Handle company change: clear results, refetch history, load latest generation
  // This triggers when selectedClientId changes (which happens after company switch)
  useEffect(() => {
    // Skip if no client selected
    if (!selectedClientId) {
      console.log('[KeywordGenerator] No client ID, skipping')
      return
    }
    
    // Skip if same client AND not initial load
    if (prevClientIdRef.current === selectedClientId) {
      console.log('[KeywordGenerator] Same client ID, skipping:', selectedClientId)
      return
    }
    
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('[KeywordGenerator] Already fetching, skipping')
      return
    }
    
    console.log('[KeywordGenerator] Client ID changed from', prevClientIdRef.current, 'to', selectedClientId)
    prevClientIdRef.current = selectedClientId
    
    // Clear current results immediately
    setResults(null)
    setHistoryGenerations([])
    
    // Refetch history for new company
    const loadCompanyData = async () => {
      isFetchingRef.current = true
      console.log('[KeywordGenerator] Fetching data for client_id:', selectedClientId)
      
      setIsLoadingHistory(true)
      try {
        const params = new URLSearchParams({ limit: '20' })
        params.set('client_id', selectedClientId)
        
        const response = await fetch(`/api/keyword-generations?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to fetch history')
        }
        const data = await response.json()
        const generations = data.generations || []
        
        console.log('[KeywordGenerator] Fetched', generations.length, 'generations')
        setHistoryGenerations(generations)
        
        // Auto-load the most recent generation for this company
        if (generations.length > 0) {
          const latestGeneration = generations[0]
          console.log('[KeywordGenerator] Loading latest:', latestGeneration.company_name)
          setResults({
            keywords: latestGeneration.keywords,
            metadata: {
              company_name: latestGeneration.company_name,
              company_url: latestGeneration.company_url || '',
              total_keywords: latestGeneration.total_keywords,
              generation_time: latestGeneration.generation_time || 0,
              pipeline: 'history'
            }
          })
          setLanguage(latestGeneration.language)
          setCountry(latestGeneration.country)
        } else {
          console.log('[KeywordGenerator] No generations found for this company')
        }
      } catch (error) {
        console.error('Failed to fetch keyword history:', error)
      } finally {
        setIsLoadingHistory(false)
        isFetchingRef.current = false
      }
    }
    
    loadCompanyData()
  }, [selectedClientId])

  // Handle company change from CompanySelector (direct callback, no async refetch needed)
  const handleCompanyChange = useCallback((clientId: string | null) => {
    console.log('[KeywordGenerator] Company changed via callback:', clientId)
    
    // Close history panel when switching
    setShowHistory(false)
    
    // Update the client ID immediately - this will trigger the useEffect above
    setSelectedClientId(clientId)
  }, [])
  
  // Auto-switch to output tab when generation starts
  useEffect(() => {
    if (isMobileOrTablet && isGenerating) {
      setMobileActiveTab('output')
    }
  }, [isMobileOrTablet, isGenerating])

  // Keyboard navigation for modal (ESC to close)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && detailsModalOpen) {
        setDetailsModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [detailsModalOpen])

  // Copy keyword to clipboard
  const handleCopyKeyword = useCallback(async (keyword: string, index: number) => {
    try {
      await navigator.clipboard.writeText(keyword)
      setCopiedKeywordId(index)
      toast.success('Keyword copied to clipboard')
      setTimeout(() => setCopiedKeywordId(null), 2000)
    } catch (err) {
      toast.error('Failed to copy keyword')
    }
  }, [])

  // Filter and sort keywords
  const filteredAndSortedKeywords = useCallback(() => {
    if (!results?.keywords) return []
    
    const filtered = results.keywords.filter(keyword => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesKeyword = keyword.keyword.toLowerCase().includes(query)
        const matchesCluster = keyword.cluster_name?.toLowerCase().includes(query)
        const matchesIntent = (keyword.intent || keyword.search_intent || '').toLowerCase().includes(query)
        if (!matchesKeyword && !matchesCluster && !matchesIntent) return false
      }
      
      // Intent filter
      if (filterIntent && (keyword.intent || keyword.search_intent) !== filterIntent) return false
      
      // Source filter
      if (filterSource && keyword.source !== filterSource) return false
      
      return true
    })
    
    // Sort
    if (sortField) {
      filtered.sort((a, b) => {
        const aVal = a[sortField]
        const bVal = b[sortField]
        
        if (aVal === undefined || aVal === null) return 1
        if (bVal === undefined || bVal === null) return -1
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal)
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }
        
        return 0
      })
    }
    
    return filtered
  }, [results?.keywords, searchQuery, filterIntent, filterSource, sortField, sortDirection])

  // Handle sort column click
  const handleSort = useCallback((field: keyof Keyword) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField, sortDirection])

  // Helper to format complex fields for export
  const formatForExport = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value.replace(/"/g, '""').replace(/\n/g, ' ')
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value)) {
      return value.map(v => formatForExport(v)).join('; ')
    }
    if (typeof value === 'object') {
      return JSON.stringify(value).replace(/"/g, '""').replace(/\n/g, ' ')
    }
    return String(value).replace(/"/g, '""').replace(/\n/g, ' ')
  }, [])

  // Enhanced CSV export with ALL fields
  const handleExportCSV = useCallback(() => {
    if (!results?.keywords) return
    
    const keywordsToExport = filteredAndSortedKeywords()
    
    // Build comprehensive data rows with ALL enhanced fields
    const exportData = keywordsToExport.map(k => {
      // Flatten research_data sources
      const researchSources = k.research_data?.sources?.map(s => 
        `${s.platform || 'source'}: "${s.quote || ''}" (${s.url || 'no URL'})`
      ).join(' | ') || ''
      
      const painPoints = k.research_data?.most_mentioned_pain_points?.join('; ') || ''
      const solutions = k.research_data?.common_solutions_mentioned?.map(s => 
        typeof s === 'string' ? s : `${s.tool || 'tool'}: ${s.mentions || 0} mentions`
      ).join('; ') || ''
      
      // Flatten SERP data
      const serpResults = k.serp_data?.organic_results?.map(r => 
        `${r.position || ''}. ${r.title || ''} (${r.url || ''})`
      ).join(' | ') || ''
      
      const paaQuestions = k.serp_data?.paa_questions?.map(q => 
        `Q: ${q.question || ''} | A: ${q.answer_snippet || ''}`
      ).join(' | ') || ''
      
      // Flatten content brief
      const targetQuestions = k.content_brief?.target_questions?.join('; ') || ''
      
      return {
        'Keyword': k.keyword || '',
        'Intent': k.intent || k.search_intent || '',
        'Score': k.score || k.relevance_score || 0,
        'Cluster': k.cluster_name || '',
        'Source': k.source || 'ai_generated',
        'Volume': k.volume || 0,
        'Difficulty': k.difficulty || 0,
        'AEO Opportunity': k.aeo_opportunity || 0,
        'Featured Snippet': k.has_featured_snippet ? 'Yes' : 'No',
        'PAA': k.has_paa ? 'Yes' : 'No',
        'Is Question': k.is_question ? 'Yes' : 'No',
        'Research Summary': k.research_summary || '',
        'Research Sources': researchSources,
        'Research Pain Points': painPoints,
        'Research Solutions': solutions,
        'Research Source URLs': (k.research_source_urls || []).join('; '),
        'Top Ranking URLs': (k.top_ranking_urls || []).filter(url => url && typeof url === 'string' && !url.includes('example-')).join('; '),
        'Featured Snippet URL': k.featured_snippet_url || '',
        'SERP Results': serpResults,
        'PAA Questions': paaQuestions,
        'Content Angle': k.content_brief?.content_angle || '',
        'Target Questions': targetQuestions,
        'Content Gap': k.content_brief?.content_gap || '',
        'Audience Pain Point': k.content_brief?.audience_pain_point || '',
        'Recommended Word Count': k.content_brief?.recommended_word_count || '',
      }
    })
    
    // Generate CSV
    const headers = Object.keys(exportData[0] || {})
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => `"${formatForExport(row[header as keyof typeof row])}"`).join(',')
      )
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    const timestamp = new Date().toISOString().split('T')[0]
    const companySlug = (results.metadata?.company_name || 'export').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    a.download = `aeo-keywords-${companySlug}-${timestamp}-${keywordsToExport.length}kw.csv`
    
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${keywordsToExport.length} keywords to CSV`)
  }, [results, filteredAndSortedKeywords, formatForExport])

  // Enhanced XLSX export with ALL fields
  const handleExportXLSX = useCallback(async () => {
    if (!results?.keywords) return
    
    const keywordsToExport = filteredAndSortedKeywords()
    
    // Build comprehensive data rows with ALL enhanced fields (same as CSV)
    const exportData = keywordsToExport.map(k => {
      const researchSources = k.research_data?.sources?.map(s => 
        `${s.platform || 'source'}: "${s.quote || ''}" (${s.url || 'no URL'})`
      ).join(' | ') || ''
      
      const painPoints = k.research_data?.most_mentioned_pain_points?.join('; ') || ''
      const solutions = k.research_data?.common_solutions_mentioned?.map(s => 
        typeof s === 'string' ? s : `${s.tool || 'tool'}: ${s.mentions || 0} mentions`
      ).join('; ') || ''
      
      const serpResults = k.serp_data?.organic_results?.map(r => 
        `${r.position || ''}. ${r.title || ''} (${r.url || ''})`
      ).join(' | ') || ''
      
      const paaQuestions = k.serp_data?.paa_questions?.map(q => 
        `Q: ${q.question || ''} | A: ${q.answer_snippet || ''}`
      ).join(' | ') || ''
      
      const targetQuestions = k.content_brief?.target_questions?.join('; ') || ''
      
      return {
        'Keyword': k.keyword || '',
        'Intent': k.intent || k.search_intent || '',
        'Score': k.score || k.relevance_score || 0,
        'Cluster': k.cluster_name || '',
        'Source': k.source || 'ai_generated',
        'Volume': k.volume || 0,
        'Difficulty': k.difficulty || 0,
        'AEO Opportunity': k.aeo_opportunity || 0,
        'Featured Snippet': k.has_featured_snippet ? 'Yes' : 'No',
        'PAA': k.has_paa ? 'Yes' : 'No',
        'Is Question': k.is_question ? 'Yes' : 'No',
        'Research Summary': k.research_summary || '',
        'Research Sources': researchSources,
        'Research Pain Points': painPoints,
        'Research Solutions': solutions,
        'Research Source URLs': (k.research_source_urls || []).join('; '),
        'Top Ranking URLs': (k.top_ranking_urls || []).filter(url => url && typeof url === 'string' && !url.includes('example-')).join('; '),
        'Featured Snippet URL': k.featured_snippet_url || '',
        'SERP Results': serpResults,
        'PAA Questions': paaQuestions,
        'Content Angle': k.content_brief?.content_angle || '',
        'Target Questions': targetQuestions,
        'Content Gap': k.content_brief?.content_gap || '',
        'Audience Pain Point': k.content_brief?.audience_pain_point || '',
        'Recommended Word Count': k.content_brief?.recommended_word_count || '',
      }
    })
    
    const timestamp = new Date().toISOString().split('T')[0]
    const companySlug = (results.metadata?.company_name || 'export').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const filename = `aeo-keywords-${companySlug}-${timestamp}-${keywordsToExport.length}kw.xlsx`
    
    try {
      await downloadXLSX(exportData, filename, 'Keywords')
      toast.success(`Exported ${keywordsToExport.length} keywords to XLSX`)
    } catch (error) {
      toast.error('Failed to export XLSX file')
      console.error('XLSX export error:', error)
    }
  }, [results, filteredAndSortedKeywords])
  
  // Cancel confirmation dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  // Persistent generation tracking
  const GENERATION_STATE_KEY = 'keyword_generation_state'

  // Track if we've already shown the resume toast to prevent duplicates
  const resumeToastShownRef = useRef(false)

  // Restore generation state on mount - check for in-progress job
  useEffect(() => {
    const savedState = sessionStorage.getItem(GENERATION_STATE_KEY)
    if (!savedState) return

    try {
      const state = JSON.parse(savedState)
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
      
      // Restore generation ID for LOG tracking
      setCurrentGenerationId(state.requestId)
      
      // Check if generation completed while away (from localStorage)
      const existingLogs = JSON.parse(localStorage.getItem('bulk-gpt-logs') || '[]')
      const existingLog = existingLogs.find((log: { id: string }) => log.id === state.requestId)
      
      if (existingLog?.status === 'completed' && existingLog.keywords) {
        // Generation completed while user was away
        if (!resumeToastShownRef.current) {
          toast.success('Found completed results from your previous session!')
          resumeToastShownRef.current = true
        }
        sessionStorage.removeItem(GENERATION_STATE_KEY)
        setCurrentGenerationId(null)
        setResults({
          keywords: existingLog.keywords,
          metadata: {
            company_name: state.companyName || '',
            company_url: state.companyUrl || '',
            total_keywords: existingLog.keywords.length,
            generation_time: existingLog.generationTime || elapsed,
            pipeline: 'restored'
          }
        })
        return
      }
      
      // Only restore active generation if reasonable time elapsed and has job ID
      if (elapsed < 600 && state.jobId) { // 10 minutes max
        setIsGenerating(true)
        setLanguage(state.language)
        setCountry(state.country)
        setNumKeywords(state.numKeywords)
        setCurrentJobId(state.jobId)
        
        // Calculate current progress based on expected duration
        const expectedDuration = 180 // 3 minutes average
        const currentProgress = Math.min((elapsed / expectedDuration) * 95, 95)
        const remainingTime = Math.max(0, expectedDuration - elapsed)
        
        setProgress(currentProgress)
        setTimeRemaining(remainingTime)
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🔄 Resuming generation... (${elapsed}s elapsed)`])
        
        // Only show resume toast once per session
        if (!resumeToastShownRef.current) {
          toast.info('Resuming keyword generation - checking job status...')
          resumeToastShownRef.current = true
        }
        
        // Continue progress bar animation
        progressIntervalRef.current = setInterval(() => {
          setProgress(prev => {
            const newProgress = prev + (95 / 120)
            return Math.min(newProgress, 95)
          })
          setTimeRemaining(prev => Math.max(0, prev - 1))
        }, 1000)
        
        // Note: Actual job polling will be started by a separate effect when pollJobStatus is available
      } else if (elapsed >= 600) {
        // Expired, clear it
        sessionStorage.removeItem(GENERATION_STATE_KEY)
        if (!resumeToastShownRef.current) {
          toast.info('Previous generation session expired')
          resumeToastShownRef.current = true
        }
      } else if (!state.jobId) {
        // No job ID - old style generation, can't resume
        sessionStorage.removeItem(GENERATION_STATE_KEY)
      }
    } catch (e) {
      console.error('Failed to restore generation state:', e)
      sessionStorage.removeItem(GENERATION_STATE_KEY)
    }
  }, [])

  // Note: No beforeunload warning needed since we save progress automatically to LOG tab
  // Polling effect is defined later after pollJobStatus is declared
  
  // Track current generation ID for LOG updates
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)

  // Function to add log entries and update LOG page
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] ${message}`
    setLogs(prev => [...prev, logMessage])
    
    // Also update localStorage for LOG page using current generation ID
    if (currentGenerationId) {
      try {
        const existingLogs = JSON.parse(localStorage.getItem('bulk-gpt-logs') || '[]')
        const logIndex = existingLogs.findIndex((log: any) => log.id === currentGenerationId)
        
        if (logIndex !== -1) {
          existingLogs[logIndex].logs = [...(existingLogs[logIndex].logs || []), logMessage]
          existingLogs[logIndex].status = 'running'
          localStorage.setItem('bulk-gpt-logs', JSON.stringify(existingLogs))
        }
      } catch (e) {
        console.warn('Failed to update LOG page entry:', e)
      }
    }
  }, [currentGenerationId])

  // Track previous isGenerating state to detect start/stop transitions
  const wasGeneratingRef = useRef(false)
  
  // Start stage progression when generation begins (UI feedback during long API wait)
  useEffect(() => {
    // Only reset on transition from not-generating to generating
    const justStarted = isGenerating && !wasGeneratingRef.current
    const justStopped = !isGenerating && wasGeneratingRef.current
    wasGeneratingRef.current = isGenerating
    
    if (justStopped) {
      // Generation stopped - reset state
      setCurrentSubprocess(0)
      currentSubprocessRef.current = 0
      setCurrentSubstep(0)
      setSubprocessProgress(0)
      setVisibleSubprocesses([])
      setCompletedSubprocesses([])
      return
    }
    
    if (!isGenerating) {
      return
    }

    // Only initialize stages when generation just started (not on every currentSubprocess change)
    if (justStarted) {
      // Start with first 4 stages visible to show upcoming work (with 6min duration)
      setVisibleSubprocesses([0, 1, 2, 3])
      setCurrentSubprocess(0)
      currentSubprocessRef.current = 0
      setCurrentSubstep(0)
      setSubprocessProgress(0)
      subprocessStartTime.current = Date.now()
    }
    
    // Progress timer uses ref to get current subprocess without re-running effect
    const progressTimer = setInterval(() => {
      const elapsed = (Date.now() - subprocessStartTime.current) / 1000
      const currentStageIdx = currentSubprocessRef.current
      const currentStage = CURSOR_SUBPROCESS_STEPS[currentStageIdx]
      
      if (!currentStage) return
      
      const progressPct = Math.min((elapsed / currentStage.duration) * 100, 100)
      
      // Update substep based on progress
      const substepProgress = Math.floor((progressPct / 100) * currentStage.substeps.length)
      setCurrentSubstep(Math.min(substepProgress, currentStage.substeps.length - 1))
      
      // Cap progress at 90% until backend actually completes each stage
      const cappedProgress = Math.min(progressPct, 90)
      setSubprocessProgress(cappedProgress)
    }, 1000) // Update every second for smooth progression

    return () => {
      clearInterval(progressTimer)
    }
  }, [isGenerating]) // Only depend on isGenerating, not currentSubprocess

  const handleCancel = useCallback(() => {
    setShowCancelDialog(true)
  }, [])

  const confirmCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    
    // Clear intervals
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    if (statusUpdateIntervalRef.current) {
      clearInterval(statusUpdateIntervalRef.current)
      statusUpdateIntervalRef.current = null
    }
    if (jobPollingRef.current) {
      clearInterval(jobPollingRef.current)
      jobPollingRef.current = null
    }
    
    setIsGenerating(false)
    setProgress(0)
    setTimeRemaining(0)
    setCurrentJobId(null)
    setShowCancelDialog(false)
    addLog('❌ Generation cancelled by user')
    toast.info('Generation cancelled')
    
    // Clear sessionStorage
    sessionStorage.removeItem(GENERATION_STATE_KEY)
  }, [addLog])

  /**
   * Poll job status and handle completion
   */
  const pollJobStatus = useCallback(async (jobId: string, startTime: number): Promise<void> => {
    try {
      const response = await fetch(`/api/jobs/keywords/${jobId}`)
      if (!response.ok) {
        if (response.status === 404) {
          addLog('❌ Job not found - it may have expired')
          throw new Error('Job not found')
        }
        throw new Error(`Failed to get job status: ${response.status}`)
      }

      const job = await response.json()
      
      // Update progress from job
      if (job.progress?.percent) {
        setProgress(job.progress.percent)
      }
      if (job.progress?.message) {
        addLog(`📡 ${job.progress.message}`)
      }

      if (job.status === 'completed' && job.result) {
        // Job completed! Process results
        addLog('✅ Generation complete!')
        
        // Clear polling
        if (jobPollingRef.current) {
          clearInterval(jobPollingRef.current)
          jobPollingRef.current = null
        }
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
          progressIntervalRef.current = null
        }
        if (statusUpdateIntervalRef.current) {
          clearInterval(statusUpdateIntervalRef.current)
          statusUpdateIntervalRef.current = null
        }

        // Extract keywords from result
        const data = job.result
        const keywords = data.keywords || []
        const generationTime = (Date.now() - startTime) / 1000

        // Build results object
        const resultsData: KeywordResults = {
          keywords,
          metadata: {
            company_name: data.company?.name || '',
            company_url: data.company?.url || '',
            total_keywords: keywords.length,
            generation_time: data.statistics?.duration_seconds || generationTime,
            pipeline: 'job-based',
          },
        }

        addLog(`✅ Generated ${keywords.length} keywords`)
        addLog(`⏱️ Total time: ${resultsData.metadata.generation_time.toFixed(1)}s`)

        setResults(resultsData)
        setProgress(100)
        setTimeRemaining(0)
        setIsGenerating(false)
        setCurrentJobId(null)
        
        // Complete all stages
        setSubprocessProgress(100)
        const totalStages = CURSOR_SUBPROCESS_STEPS.length
        for (let i = 0; i < totalStages; i++) {
          setCompletedSubprocesses(prev => prev.includes(i) ? prev : [...prev, i])
        }

        toast.success(`Generated ${keywords.length} keywords!`)

        // Save to history
        saveGeneration(keywords, resultsData.metadata.generation_time, {
          name: resultsData.metadata.company_name,
          url: resultsData.metadata.company_url,
        })

        // Clear session state
        sessionStorage.removeItem(GENERATION_STATE_KEY)
        
      } else if (job.status === 'failed') {
        // Job failed
        addLog(`❌ Generation failed: ${job.error || 'Unknown error'}`)
        
        if (jobPollingRef.current) {
          clearInterval(jobPollingRef.current)
          jobPollingRef.current = null
        }
        
        setIsGenerating(false)
        setCurrentJobId(null)
        sessionStorage.removeItem(GENERATION_STATE_KEY)
        toast.error(job.error || 'Generation failed')
      }
      // If still running/pending, polling continues
    } catch (error) {
      console.error('[KeywordGenerator] Poll error:', error)
      // Don't stop polling on transient errors
    }
  }, [addLog, CURSOR_SUBPROCESS_STEPS.length, saveGeneration])

  // Effect to start polling when we have a job ID to resume
  useEffect(() => {
    if (currentJobId && isGenerating && !jobPollingRef.current) {
      // Get the start time from session storage
      const savedState = sessionStorage.getItem(GENERATION_STATE_KEY)
      if (savedState) {
        try {
          const state = JSON.parse(savedState)
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 📡 Polling job: ${currentJobId}`])
          
          // Start polling
          const pollInterval = 3000
          jobPollingRef.current = setInterval(() => {
            pollJobStatus(currentJobId, state.startTime)
          }, pollInterval)
          
          // Immediate poll
          pollJobStatus(currentJobId, state.startTime)
        } catch (e) {
          console.error('Failed to start polling:', e)
        }
      }
    }
    
    return () => {
      // Cleanup polling on unmount
      if (jobPollingRef.current) {
        clearInterval(jobPollingRef.current)
        jobPollingRef.current = null
      }
    }
  }, [currentJobId, isGenerating, pollJobStatus])

  const handleGenerate = useCallback(async () => {
    // Re-fetch the latest context from API to ensure we have current selection
    // (fixes issue where CompanySelector updates don't sync to this component's state)
    let currentCompanyName = companyName
    let currentCompanyUrl = companyUrl
    let currentBusinessContext = businessContext
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
              currentCompanyName = notes.companyName || selectedClient.name || ''
              currentCompanyUrl = notes.companyWebsite || selectedClient.website || ''
              currentBusinessContext = {
                ...businessContext,
                companyName: currentCompanyName,
                companyWebsite: currentCompanyUrl,
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
            }
          }
        }
      }
    } catch (e) {
      console.error('[KeywordGenerator] Failed to refresh context:', e)
      // Continue with existing context
    }

    if (!currentCompanyName.trim() || !currentCompanyUrl.trim()) {
      toast.error('Please enter company name and URL')
      return
    }

    // Note: API key is optional on client - server will use GEMINI_API_KEY env var as fallback

    // Clear any existing abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new abort controller
    const abortController = new AbortController()
    abortControllerRef.current = abortController

        setIsGenerating(true)
        setIsLoadingResults(false) // Don't show skeleton during generation - progress cards show instead
        setResults(null)
        setProgress(0)
        setLogs([]) // Clear previous logs
    
    // Reset stage progression state - show first 4 stages initially (optimized for 6min duration)
    const initialStages = []
    for (let i = 0; i < Math.min(4, CURSOR_SUBPROCESS_STEPS.length); i++) {
      initialStages.push(i)
    }
    setVisibleSubprocesses(initialStages)
    setCurrentSubprocess(0)
    currentSubprocessRef.current = 0
    setCurrentSubstep(0)
    setSubprocessProgress(0)
    setCompletedSubprocesses([])
    setStageActualDurations({}) // Reset actual durations
    subprocessStartTime.current = Date.now()
    
    addLog('🚀 Starting keyword generation...')
    if (hasContext) {
      addLog('⚡ Using business context - skipping company analysis')
    } else {
      addLog('🔍 No context found - will analyze company website first')
    }
    const totalDuration = CURSOR_SUBPROCESS_STEPS.reduce((sum, step) => sum + step.duration, 0)
    
    // Generate unique ID for this generation
    const requestId = `kw-${Date.now()}`
    const startTime = Date.now()
    generationStartTimeRef.current = startTime
    setCurrentGenerationId(requestId)
    
    // Set initial time remaining estimate
    setTimeRemaining(totalDuration)
    console.log('[DEBUG] Setting time remaining to', totalDuration, 'seconds', hasContext ? '(with context)' : '(without context)')

    // Save generation state to sessionStorage for persistence
    const generationState = {
      startTime,
      language,
      country,
      numKeywords,
      companyName: currentCompanyName.trim(),
      companyUrl: currentCompanyUrl.trim(),
      requestId,
    }
    sessionStorage.setItem(GENERATION_STATE_KEY, JSON.stringify(generationState))
    
    // Also save to localStorage immediately for LOG page tracking
    const logEntry = {
      id: requestId,
      type: 'keywords',
      timestamp: new Date().toISOString(),
      status: 'running',
      company: currentCompanyName.trim(),
      url: currentCompanyUrl.trim(),
      language,
      country,
      input: {
        company_name: currentCompanyName.trim(),
        company_url: currentCompanyUrl.trim(),
        num_keywords: numKeywords,
        language,
        country,
      },
      logs: [`[${new Date().toLocaleTimeString()}] 🚀 Generation started...`],
      progress: 0,
    }
    
    const existingLogs = JSON.parse(localStorage.getItem('bulk-gpt-logs') || '[]')
    const updatedLogs = [logEntry, ...existingLogs.filter((log: any) => log.id !== requestId)]
    localStorage.setItem('bulk-gpt-logs', JSON.stringify(updatedLogs.slice(0, 50)))

    // Start progress bar with dynamic time remaining calculation
    // Use faster update interval for smoother progress
    progressIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - generationStartTimeRef.current) / 1000
      
      setProgress(prev => {
        // Calculate progress based on elapsed time vs expected duration
        // Use logarithmic curve for more realistic feel (starts fast, slows near end)
        const expectedDuration = totalDuration
        const linearProgress = (elapsed / expectedDuration) * 100
        // Apply easing: progress appears faster at start, slower at end
        const easedProgress = Math.min(95, linearProgress * (1 - linearProgress / 200))
        const newProgress = Math.max(prev, easedProgress) // Never go backwards
        
        // Calculate remaining time based on actual elapsed and expected duration
        const remaining = Math.max(0, expectedDuration - elapsed)
        setTimeRemaining(Math.ceil(remaining))
        
        return Math.min(newProgress, 95) // Cap at 95% until API returns
      })
    }, 500) // Update every 500ms for smoother display

    try {
      addLog(`📝 Company: ${currentCompanyName.trim()}`)
      addLog(`🌐 URL: ${currentCompanyUrl.trim()}`)
      addLog(`🎯 Target: ${numKeywords} keywords`)
      addLog(`🌍 Market: ${country} (${language})`)
      addLog(`📊 Context: ${!!currentBusinessContext ? 'Available' : 'None'}`)

      // Pre-flight server health check
      addLog('🔍 Checking server availability...')
      const isServerHealthy = await checkServerHealth()
      if (!isServerHealthy) {
        addLog('❌ Server is not responding')
        throw new Error('Server is not responding. Please refresh the page and try again.')
      }
      addLog('✅ Server is healthy')
      addLog('📡 Sending API request...')
      
      // Start tracking stage times when API call begins
      const stageStartTimesLocal: Record<number, number> = { 0: startTime }
      const apiCallStartTime = Date.now()
      
      // Start Stage 0 (first stage - AI Generation when hasContext, otherwise Company Analysis)
      // Stage 0 is now RUNNING (not complete) - it will be completed later by time-based transitions
      addLog('🧠 AI keyword generation starting...')
      setCurrentSubprocess(0)
      currentSubprocessRef.current = 0
      stageStartTimesLocal[0] = apiCallStartTime
      
      statusUpdateIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - apiCallStartTime // Time since API call started
        const elapsedSeconds = Math.floor(elapsed / 1000)

        // Helper to transition to next stage with actual duration tracking
        const transitionToStage = (fromStage: number, toStage: number, logMessage: string) => {
          if (currentSubprocessRef.current === fromStage) {
            // Update ref FIRST to prevent duplicate calls
            currentSubprocessRef.current = toStage
            
            const stageStartTime = stageStartTimesLocal[fromStage] || apiCallStartTime
            const actualDuration = Math.round((Date.now() - stageStartTime) / 1000)
            
            addLog(logMessage)
            setCompletedSubprocesses(prev => prev.includes(fromStage) ? prev : [...prev, fromStage])
            setStageActualDurations(prev => ({ ...prev, [fromStage]: actualDuration }))
            setCurrentSubprocess(toStage)
            stageStartTimesLocal[toStage] = Date.now()
          }
        }

        // Stage transitions based on elapsed time since API call started
        // Times aligned with typical backend processing stages
        // Stage 0 is the first active stage (AI Generation when hasContext, otherwise Company Analysis)
        if (elapsedSeconds >= 8 && currentSubprocessRef.current === 0) {
          transitionToStage(0, 1, '🔍 Starting research analysis...')
        } else if (elapsedSeconds >= 18 && currentSubprocessRef.current === 1) {
          transitionToStage(1, 2, '📊 SERP analysis in progress...')
        } else if (elapsedSeconds >= 30 && currentSubprocessRef.current === 2) {
          transitionToStage(2, 3, '🎯 Deduplication starting...')
        } else if (elapsedSeconds >= 45 && currentSubprocessRef.current === 3) {
          transitionToStage(3, 4, '🗂️ Clustering keywords...')
        } else if (elapsedSeconds >= 60 && currentSubprocessRef.current === 4) {
          transitionToStage(4, 5, '✨ Finalizing results...')
        }
      }, 500) // Check every 500ms for smoother transitions

      // Use job-based API for resilient, resumable generation
      addLog('📡 Creating generation job...')
      
      // Create job through the background jobs context for global tracking
      const jobRequest = {
        company_name: currentCompanyName.trim(),
        company_url: currentCompanyUrl.trim(),
        language,
        region: country,
        target_count: numKeywords,
        enable_research: true,
        enable_serp_analysis: true,
        enable_volume_lookup: true,
        min_score: 40,
        cluster_count: 6,
        // Pass full business context including research files
        business_context: currentBusinessContext || {},
      }
      
      const backgroundJob = await createJob(
        'keywords',
        `Keywords for ${currentCompanyName.trim()}`,
        jobRequest,
        { description: `Generating ${numKeywords} keywords` }
      )
      
      if (!backgroundJob) {
        throw new Error('Failed to create job - check server connection')
      }

      const jobId = backgroundJob.id
      
      addLog(`✅ Job created: ${jobId}`)
      addLog('⏳ Processing in background - you can navigate away safely')
      
      setCurrentJobId(jobId)
      
      // Update session storage with job_id for resume
      const updatedState = {
        startTime,
        language,
        country,
        numKeywords,
        companyName: currentCompanyName.trim(),
        companyUrl: currentCompanyUrl.trim(),
        requestId,
        jobId, // Add job ID for resume
      }
      sessionStorage.setItem(GENERATION_STATE_KEY, JSON.stringify(updatedState))

      // Start polling for job status
      const pollInterval = 3000 // Poll every 3 seconds
      jobPollingRef.current = setInterval(() => {
        pollJobStatus(jobId, startTime)
      }, pollInterval)

      // Initial poll immediately
      await pollJobStatus(jobId, startTime)
      
      // Note: The rest of the completion logic is handled in pollJobStatus
      // We return here and let polling handle the results
      
    } catch (error) {
      // Check if error is from abort
      if (error instanceof Error && error.name === 'AbortError') {
        addLog('❌ Generation cancelled')
        setIsGenerating(false)
        abortControllerRef.current = null
        return
      }
      
      // Use enhanced error handling from fetch-utils
      const fetchError = error as FetchError
      const friendlyMessage = getFriendlyErrorMessage(fetchError)

      if (fetchError.isTimeoutError) {
        addLog(`⏱️ Generation timeout: Request took longer than expected`)
        toast.error('Generation timed out - please try again')
      } else if (fetchError.isNetworkError) {
        addLog(`🌐 Network error: ${fetchError.message}`)
        toast.error('Network connection failed - check server status')
      } else if (fetchError.isServerError) {
        addLog(`🔧 Server error (${fetchError.status}): ${fetchError.message}`)
        toast.error(`Server error - please try again.`)
      } else if (error instanceof Error) {
        addLog(`💥 Error: ${error.message}`)
        toast.error(friendlyMessage)
      } else {
        addLog(`💥 Unknown error occurred during generation`)
        toast.error('Generation failed with unknown error')
      }

      console.error('Keyword generation error:', error)
      
      // Clear intervals and reset timers on error
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current)
        statusUpdateIntervalRef.current = null
      }
      if (jobPollingRef.current) {
        clearInterval(jobPollingRef.current)
        jobPollingRef.current = null
      }
      
      setIsGenerating(false)
      setCurrentJobId(null)
      setTimeRemaining(0)
      setProgress(0)
      
      // Clear generation state on error
      sessionStorage.removeItem(GENERATION_STATE_KEY)
    }
  }, [companyName, companyUrl, language, country, numKeywords, businessContext, addLog, saveGeneration, pollJobStatus, hasContext, CURSOR_SUBPROCESS_STEPS.length, createJob])

  // Input panel content
  const inputPanel = (
    <div className="h-full flex flex-col bg-card">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto p-6 pb-24">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Generate Keywords</h2>
            <p className="text-xs text-muted-foreground">
              AI-powered AEO keyword research for maximum AI visibility
            </p>
          </div>

          {/* Shared Context Panel for DRY implementation */}
          <ContextPanel
            country={country}
            language={language}
            onCountryChange={setCountry}
            onLanguageChange={setLanguage}
            onCompanyChange={handleCompanyChange}
            disabled={isGenerating}
          />

          {/* Settings Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="num-keywords" className="text-xs font-medium">
                Number of Keywords
              </Label>
              <Input
                id="num-keywords"
                type="number"
                min={10}
                max={200}
                value={numKeywords}
                onChange={(e) => setNumKeywords(Math.max(10, Math.min(200, parseInt(e.target.value) || 50)))}
                className="text-sm"
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground">
                Min: 10, Max: 200 keywords per generation
              </p>
              <CreditCostPreview 
                serviceType="KEYWORDS_GENERATION" 
                customCreditCost={getKeywordCreditUnits(numKeywords)}
                compact
                className="mt-2"
              />
            </div>

          </div>
        </div>
      </div>

      {/* Sticky Generate Button - Fixed at bottom */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border/50 shadow-lg">
        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={!hasContext || isGenerating}
            className="flex-1 min-h-[48px]"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Keywords
              </>
            )}
          </Button>
          {isGenerating && (
            <Button
              onClick={handleCancel}
              variant="destructive"
              size="lg"
              className="px-4 min-h-[48px]"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  // Output panel content
  const outputPanel = (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6">
        {isGenerating && (
          <div className="h-full flex items-center justify-center">
            <RunningState
              status="running"
              progress={progress}
              currentStage={
                activeStageOrder[currentSubprocess] 
                  ? STAGE_CONFIGURATIONS[activeStageOrder[currentSubprocess]].description 
                  : 'Processing...'
              }
              estimate={timeRemaining}
              stages={activeStageOrder.map((stageKey, index) => {
                const config = STAGE_CONFIGURATIONS[stageKey]
                // Use actual elapsed duration for completed stages, undefined for pending
                const actualDuration = stageActualDurations[index]
                const status: Stage['status'] =
                  index < currentSubprocess ? 'complete' :
                  index === currentSubprocess ? 'running' :
                  'pending'
                return {
                  id: stageKey,
                  name: config.name,
                  status,
                  duration: actualDuration // Show actual elapsed time, not estimate
                }
              })}
              logs={logs.slice(-5)}
              onCancel={() => {
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort()
                }
                setIsGenerating(false)
                toast.info('Generation cancelled')
              }}
              className="max-w-2xl w-full"
              showDetails={true}
            />
          </div>
        )}
        {!results && !isGenerating && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Enter company details and click Generate to start
              </p>
            </div>
          </div>
        )}

        {/* Loading Skeleton - Only show when processing results after generation completes */}
        {isLoadingResults && !isGenerating && (
          <div className="flex flex-col h-full overflow-hidden p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 flex-shrink-0">
                <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
                <div className="h-8 bg-muted rounded w-24 animate-pulse" />
              </div>
              <div className="flex-1 overflow-auto border border-border rounded-lg">
                <div className="p-4 space-y-3">
                  <div className="h-10 bg-muted rounded w-full animate-pulse" />
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {results?.keywords?.length > 0 && !isLoadingResults && !isGenerating && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex flex-col gap-4 pb-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {filteredAndSortedKeywords().length} of {results.keywords.length} Keywords
                    {(searchQuery || filterIntent || filterSource) && (
                      <span className="text-sm text-muted-foreground ml-2">(filtered)</span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    For {results.metadata?.company_name || 'Unknown'} • {(results.metadata?.generation_time ?? 0).toFixed(1)}s
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Download className="h-4 w-4" />
                      Download
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportXLSX}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportCSV}>
                      <FileText className="h-4 w-4 mr-2" />
                      CSV (.csv)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search keywords, clusters, intent..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  value={filterIntent || ''}
                  onChange={(e) => setFilterIntent(e.target.value || null)}
                  className="h-10 px-3 text-sm border border-border rounded-md bg-background appearance-none cursor-pointer min-w-[120px]"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '28px' }}
                >
                  <option value="">All Intents</option>
                  <option value="informational">Informational</option>
                  <option value="commercial">Commercial</option>
                  <option value="transactional">Transactional</option>
                  <option value="comparison">Comparison</option>
                  <option value="question">Question</option>
                </select>
                <select
                  value={filterSource || ''}
                  onChange={(e) => setFilterSource(e.target.value || null)}
                  className="h-10 px-3 text-sm border border-border rounded-md bg-background appearance-none cursor-pointer min-w-[120px]"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '28px' }}
                >
                  <option value="">All Sources</option>
                  <option value="research_reddit">Reddit</option>
                  <option value="research_quora">Quora</option>
                  <option value="research_niche">Forums</option>
                  <option value="gap_analysis">Gap Analysis</option>
                  <option value="serp_paa">PAA</option>
                  <option value="ai_generated">AI Generated</option>
                </select>
                {(searchQuery || filterIntent || filterSource) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('')
                      setFilterIntent(null)
                      setFilterSource(null)
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-border sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3 font-medium bg-background w-10">
                      <Checkbox
                        checked={results?.keywords && results.keywords.length > 0 && results.keywords.every(k => selectedForBlog.has(k.keyword))}
                        onCheckedChange={toggleSelectAll}
                        title="Select all for blog generation"
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </th>
                    <th className="text-left p-3 font-medium bg-background w-10">#</th>
                    <th className="text-left p-3 font-medium min-w-[250px] bg-background">
                      <button
                        onClick={() => handleSort('keyword')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Keyword
                        {sortField === 'keyword' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium bg-background">
                      <button
                        onClick={() => handleSort('intent')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Intent
                        {sortField === 'intent' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium bg-background">
                      <button
                        onClick={() => handleSort('score')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Score
                        {sortField === 'score' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium bg-background">Cluster</th>
                    <th className="text-left p-3 font-medium bg-background">Source</th>
                    <th className="text-left p-3 font-medium bg-background">
                      <button
                        onClick={() => handleSort('volume')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Volume
                        {sortField === 'volume' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium bg-background">
                      <button
                        onClick={() => handleSort('difficulty')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Difficulty
                        {sortField === 'difficulty' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium bg-background">
                      <button
                        onClick={() => handleSort('aeo_opportunity')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        AEO Opp.
                        {sortField === 'aeo_opportunity' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium bg-background">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedKeywords().map((keyword, index) => (
                    <tr key={index} className={`border-b border-border last:border-0 hover:bg-muted/30 group ${selectedForBlog.has(keyword.keyword) ? 'bg-primary/5' : ''}`}>
                      <td className="p-3">
                        <Checkbox
                          checked={selectedForBlog.has(keyword.keyword)}
                          onCheckedChange={() => toggleKeywordSelection(keyword.keyword)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </td>
                      <td className="p-3 text-muted-foreground">{index + 1}</td>
                      <td className="p-3 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-nowrap">
                          {keyword.is_question && (
                            <span className="text-xs flex-shrink-0 text-purple-500" title="Question keyword">?</span>
                          )}
                          <span className="font-medium flex-1 min-w-0">{keyword.keyword}</span>
                          <button
                            onClick={() => handleCopyKeyword(keyword.keyword, index)}
                            className="p-1 hover:bg-muted rounded transition-colors opacity-60 hover:opacity-100 flex-shrink-0"
                            title="Copy keyword"
                          >
                            {copiedKeywordId === index ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          (keyword.intent || keyword.search_intent) === 'question' || (keyword.intent || keyword.search_intent) === 'informational' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                          (keyword.intent || keyword.search_intent) === 'commercial' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          (keyword.intent || keyword.search_intent) === 'transactional' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                          (keyword.intent || keyword.search_intent) === 'comparison' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {keyword.intent || keyword.search_intent || 'informational'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full ${
                                (keyword.score || keyword.relevance_score || 0) >= 80 ? 'bg-green-500' :
                                (keyword.score || keyword.relevance_score || 0) >= 60 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${keyword.score || keyword.relevance_score || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8">{keyword.score || keyword.relevance_score || 0}</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{keyword.cluster_name || '-'}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          keyword.source?.includes('research') ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                          keyword.source === 'gap_analysis' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                          keyword.source === 'serp_paa' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          <span className="leading-none">
                            {keyword.source === 'research_reddit' ? '🔴' :
                             keyword.source === 'research_quora' ? '🟠' :
                             keyword.source === 'research_niche' ? '💬' :
                             keyword.source === 'gap_analysis' ? '🎯' :
                             keyword.source === 'serp_paa' ? '💡' :
                             '🤖'}
                          </span>
                          <span>
                            {keyword.source === 'research_reddit' ? 'Reddit' :
                             keyword.source === 'research_quora' ? 'Quora' :
                             keyword.source === 'research_niche' ? 'Forums' :
                             keyword.source === 'gap_analysis' ? 'Gap' :
                             keyword.source === 'serp_paa' ? 'PAA' :
                             'AI'}
                          </span>
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {keyword.volume && keyword.volume > 0 ? keyword.volume.toLocaleString() : '-'}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {/* Difficulty: Only show if analyzed (not default 50, or explicitly set via SERP/volume lookup) */}
                        {keyword.serp_analyzed || (keyword.difficulty !== undefined && keyword.difficulty !== 50 && keyword.difficulty > 0) ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            (keyword.difficulty ?? 0) < 30 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            (keyword.difficulty ?? 0) < 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {keyword.difficulty}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3">
                        {keyword.aeo_opportunity !== undefined && Number(keyword.aeo_opportunity) > 0 ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            Number(keyword.aeo_opportunity) >= 70 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            Number(keyword.aeo_opportunity) >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {keyword.aeo_opportunity}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <button 
                          onClick={() => {
                            setSelectedKeyword(keyword)
                            setDetailsModalOpen(true)
                          }}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                        >
                          📋 View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Floating Generate Blogs Button */}
        {selectedForBlog.size > 0 && (
          <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Button
              onClick={handleGenerateBlogs}
              size="lg"
              className="shadow-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white gap-2 pr-5"
            >
              <FileEdit className="h-5 w-5" />
              Generate {selectedForBlog.size} Blog{selectedForBlog.size !== 1 ? 's' : ''}
            </Button>
          </div>
        )}

    </div>
  )

  return (
    <div className="h-full flex relative">
      
      {/* Mobile/Tablet: Tabs layout */}
      {isMobileOrTablet && (
        <div className="w-full h-full flex flex-col min-h-0 overflow-hidden max-h-screen">
          <Tabs value={mobileActiveTab} onValueChange={setMobileActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsList className="flex-shrink-0 w-full rounded-none border-b border-border/40 bg-gradient-to-b from-secondary/30 to-secondary/15">
              <TabsTrigger value="input" className="flex-1 data-[state=active]:bg-background/60 data-[state=active]:shadow-sm">
                INPUT
              </TabsTrigger>
              <TabsTrigger 
                value="output" 
                className="flex-1 flex items-center gap-2 data-[state=active]:bg-background/60 data-[state=active]:shadow-sm"
              >
                OUTPUT
                {results && results.keywords && results.keywords.length > 0 && (
                  <span className="inline-flex items-center justify-center rounded-md bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                    {results.keywords.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="mt-0 flex-1 overflow-y-auto min-h-0">
              {inputPanel}
            </TabsContent>

            <TabsContent value="output" className="mt-0 flex-1 overflow-y-auto min-h-0 max-h-[calc(100vh-8rem)]">
              {outputPanel}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Desktop: Side-by-side panels */}
      {!isMobileOrTablet && (
        <>
          {/* Left Panel - Input Form (wider for better UX) */}
          <div className="w-[420px] flex-shrink-0 border-r border-border">
            {inputPanel}
          </div>

          {/* Right Panel - Results Table */}
          {outputPanel}
        </>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Generation?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the keyword generation? This action cannot be undone and you will lose any progress made so far.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Keep Running
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
            >
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyword Details Modal - Comprehensive View */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">"{selectedKeyword?.keyword}" - Complete Analysis</DialogTitle>
            <DialogDescription>
              SERP analysis and content brief for this keyword
            </DialogDescription>
          </DialogHeader>
          
          {selectedKeyword && (
            <div className="flex-1 overflow-y-auto pr-2">
              <Tabs defaultValue="serp" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="serp" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    SERP
                  </TabsTrigger>
                  <TabsTrigger value="content" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Content Brief
                  </TabsTrigger>
                </TabsList>

                {/* SERP Tab */}
                <TabsContent value="serp" className="mt-4 space-y-4">
                  {selectedKeyword.serp_data?.featured_snippet && (
                    <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/20 dark:to-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-900">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        ⭐ Featured Snippet ({selectedKeyword.serp_data.featured_snippet.type || 'paragraph'})
                      </h3>
                      <p className="text-sm mb-3">{selectedKeyword.serp_data.featured_snippet.content}</p>
                      {selectedKeyword.serp_data.featured_snippet.source_url && (
                        <a 
                          href={selectedKeyword.serp_data.featured_snippet.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {selectedKeyword.serp_data.featured_snippet.source_title || selectedKeyword.serp_data.featured_snippet.source_url}
                        </a>
                      )}
                    </div>
                  )}

                  {selectedKeyword.serp_data?.organic_results && selectedKeyword.serp_data.organic_results.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Top Ranking Results ({selectedKeyword.serp_data.organic_results.length})
                      </h3>
                      <div className="space-y-3">
                        {selectedKeyword.serp_data.organic_results.map((result, idx) => (
                          <div key={idx} className="border rounded-lg p-4 bg-card">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="flex-shrink-0">
                                  #{result.position || idx + 1}
                                </Badge>
                                {result.is_big_brand && (
                                  <Badge variant="secondary" className="text-xs">Big Brand</Badge>
                                )}
                                {result.domain_authority && (
                                  <Badge variant="outline" className="text-xs">
                                    DA: {result.domain_authority}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            {/* Meta Title */}
                            {(result.meta_title || result.title) && (
                              <div className="mb-2">
                                <span className="text-[10px] uppercase text-muted-foreground font-medium">Meta Title</span>
                                <h4 className="font-medium text-sm text-blue-600 dark:text-blue-400">{result.meta_title || result.title}</h4>
                              </div>
                            )}
                            
                            {/* Website URL */}
                            {result.url && (
                              <div className="mb-2">
                                <span className="text-[10px] uppercase text-muted-foreground font-medium">Website URL</span>
                                <a 
                                  href={result.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline break-all"
                                >
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                  {result.url}
                                </a>
                              </div>
                            )}
                            
                            {/* Meta Description */}
                            {(result.meta_description || result.description) && (
                              <div className="mb-2">
                                <span className="text-[10px] uppercase text-muted-foreground font-medium">Meta Description</span>
                                <p className="text-xs text-muted-foreground line-clamp-3">{result.meta_description || result.description}</p>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between pt-2 border-t border-border/50">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {result.domain && <span className="font-medium">{result.domain}</span>}
                                {result.estimated_word_count && (
                                  <span>• {result.estimated_word_count.toLocaleString()} words</span>
                                )}
                              </div>
                              {result.url && (
                                <a 
                                  href={result.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Visit Site
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedKeyword.serp_data?.paa_questions && selectedKeyword.serp_data.paa_questions.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        💬 People Also Ask ({selectedKeyword.serp_data.paa_questions.length})
                      </h3>
                      <Accordion type="single" collapsible className="w-full">
                        {selectedKeyword.serp_data.paa_questions.map((paa, idx) => (
                          <AccordionItem key={idx} value={`paa-${idx}`}>
                            <AccordionTrigger className="text-left">
                              <span className="text-sm">{paa.question}</span>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pt-2">
                                {paa.answer_snippet && (
                                  <p className="text-sm text-muted-foreground">{paa.answer_snippet}</p>
                                )}
                                {paa.source_url && (
                                  <a 
                                    href={paa.source_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {paa.source_title || 'View source'}
                                  </a>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  )}

                  {/* Empty State for SERP Tab */}
                  {!selectedKeyword.serp_data?.featured_snippet &&
                   (!selectedKeyword.serp_data?.organic_results || selectedKeyword.serp_data.organic_results.length === 0) &&
                   (!selectedKeyword.serp_data?.paa_questions || selectedKeyword.serp_data.paa_questions.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center" role="status" aria-live="polite">
                      <div className="rounded-full bg-muted p-4 mb-4" aria-hidden="true">
                        <TrendingUp className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">No SERP Data Available</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        SERP analysis data is not available for this keyword. This may be because SERP analysis was disabled during generation or the analysis hasn't been completed yet.
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Content Brief Tab */}
                <TabsContent value="content" className="mt-4 space-y-4">
                  {selectedKeyword.content_brief?.content_angle && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Content Angle
                      </h3>
                      <p className="text-sm text-muted-foreground">{selectedKeyword.content_brief.content_angle}</p>
                    </div>
                  )}

                  {selectedKeyword.content_brief?.target_questions && selectedKeyword.content_brief.target_questions.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Target Questions ({selectedKeyword.content_brief.target_questions.length})</h3>
                      <ul className="space-y-2">
                        {selectedKeyword.content_brief.target_questions.map((question, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <span className="text-muted-foreground mt-0.5">•</span>
                            <span>{question}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedKeyword.content_brief?.content_gap && (
                    <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4 border border-orange-200 dark:border-orange-900">
                      <h3 className="font-semibold mb-2 text-orange-900 dark:text-orange-300">Content Gap</h3>
                      <p className="text-sm text-orange-800 dark:text-orange-400">{selectedKeyword.content_brief.content_gap}</p>
                    </div>
                  )}

                  {selectedKeyword.content_brief?.audience_pain_point && (
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 border border-red-200 dark:border-red-900">
                      <h3 className="font-semibold mb-2 text-red-900 dark:text-red-300">Audience Pain Point</h3>
                      <p className="text-sm text-red-800 dark:text-red-400">{selectedKeyword.content_brief.audience_pain_point}</p>
                    </div>
                  )}

                  {selectedKeyword.content_brief?.recommended_word_count && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h3 className="font-semibold mb-2">Recommended Word Count</h3>
                      <p className="text-lg font-medium">{selectedKeyword.content_brief.recommended_word_count.toLocaleString()} words</p>
                    </div>
                  )}

                  {/* Empty State for Content Brief Tab */}
                  {!selectedKeyword.content_brief?.content_angle &&
                   (!selectedKeyword.content_brief?.target_questions || selectedKeyword.content_brief.target_questions.length === 0) &&
                   !selectedKeyword.content_brief?.content_gap &&
                   !selectedKeyword.content_brief?.audience_pain_point &&
                   !selectedKeyword.content_brief?.recommended_word_count && (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center" role="status" aria-live="polite">
                      <div className="rounded-full bg-muted p-4 mb-4" aria-hidden="true">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">No Content Brief Available</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Content brief data is not available for this keyword. Content briefs are generated for top keywords when content brief generation is enabled.
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

