'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { ContextPanel } from '@/components/shared/ContextPanel'
import { GenerationInputPanel } from '@/components/shared/GenerationInputPanel'
import { CreditCostPreview } from '@/components/ui/credit-cost-preview'
import { useContextStorage } from '@/hooks/useContextStorage'
import { useMobile } from '@/hooks/useMobile'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, FileSpreadsheet, Clock, CheckCircle2, XCircle, Upload, RefreshCw, Sparkles, Loader2, X, Copy, Download, FileType, File, ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { downloadXLSX } from '@/lib/export'
import { formatBlogAsTxt, formatBlogForPdf, formatBlogForDocx, htmlToPlainText, type PdfSection } from '@/lib/blog-export'
import { toast } from 'sonner'
import { RunningState, type Stage } from '@/components/shared/RunningState'
import Papa from 'papaparse'

// Blog generation stages configuration
const STAGE_CONFIGURATIONS = {
  'context_analysis': {
    name: '🏢 Context Analysis',
    duration: 5,
    icon: '🔍',
    description: 'Analyzing business context..',
    color: 'text-blue-600',
    substeps: ['Initializing', 'Loading company data', 'Extracting context', 'Building profile']
  },
  'keyword_research': {
    name: '🎯 Keyword Research',
    duration: 10,
    icon: '🔍',
    description: 'Researching keyword..',
    color: 'text-purple-600',
    substeps: ['Analyzing keyword', 'SERP analysis', 'Competition check', 'Intent mapping']
  },
  'outline_generation': {
    name: '📝 Outline Creation',
    duration: 15,
    icon: '📋',
    description: 'Creating blog outline..',
    color: 'text-green-600',
    substeps: ['Structure planning', 'Heading generation', 'Content organization', 'Flow optimization']
  },
  'content_generation': {
    name: '✨ Content Generation',
    duration: 60,
    icon: '🤖',
    description: 'AI generating content..',
    color: 'text-orange-600',
    substeps: ['Introduction', 'Main sections', 'Examples & data', 'Conclusion', 'Refinement']
  },
  'quality_refinement': {
    name: '🎨 Quality Refinement',
    duration: 20,
    icon: '✨',
    description: 'Refining quality..',
    color: 'text-indigo-600',
    substeps: ['Grammar check', 'Flow optimization', 'AEO scoring', 'Readability tuning']
  },
  'citations': {
    name: '📚 Citations',
    duration: 15,
    icon: '🔗',
    description: 'Adding citations..',
    color: 'text-teal-600',
    substeps: ['Finding sources', 'Validating URLs', 'Formatting citations', 'Link insertion']
  },
  'internal_links': {
    name: '🔗 Internal Links',
    duration: 10,
    icon: '🌐',
    description: 'Adding internal links..',
    color: 'text-cyan-600',
    substeps: ['Finding opportunities', 'Anchor text optimization', 'Link insertion']
  },
  'finalization': {
    name: '✅ Finalization',
    duration: 10,
    icon: '🎉',
    description: 'Finalizing blog..',
    color: 'text-green-600',
    substeps: ['Final formatting', 'Metadata generation', 'Validation', 'Complete!']
  }
}

// Batch mode stages - matching the 8-step single generation flow for consistency
const BATCH_STAGE_CONFIGURATIONS = {
  'context_analysis': {
    name: '🏢 Context Analysis',
    duration: 5,
    description: 'Analyzing business context...',
  },
  'keyword_research': {
    name: '🎯 Keyword Research',
    duration: 10,
    description: 'Researching keyword...',
  },
  'outline_generation': {
    name: '📝 Outline Creation',
    duration: 15,
    description: 'Creating blog outline...',
  },
  'content_generation': {
    name: '✨ Content Generation',
    duration: 60,
    description: 'AI generating content...',
  },
  'quality_refinement': {
    name: '🎨 Quality Refinement',
    duration: 20,
    description: 'Refining quality...',
  },
  'citations': {
    name: '📚 Citations',
    duration: 15,
    description: 'Adding citations...',
  },
  'internal_links': {
    name: '🔗 Internal Links',
    duration: 10,
    description: 'Adding internal links...',
  },
  'finalization': {
    name: '✅ Finalization',
    duration: 10,
    description: 'Finalizing blog...',
  }
}

const BATCH_STAGE_ORDER = ['context_analysis', 'keyword_research', 'outline_generation', 'content_generation', 'quality_refinement', 'citations', 'internal_links', 'finalization'] as const

// Stage order for progression
const STAGE_ORDER = ['context_analysis', 'keyword_research', 'outline_generation', 'content_generation', 'quality_refinement', 'citations', 'internal_links', 'finalization'] as const

// Utility function to sanitize HTML content for security and dark theme compatibility
function sanitizeHtmlForTheme(html: string): string {
  if (!html) return ''
  
  // Security: Remove dangerous elements first
  // Remove script tags and content
  let sanitized = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  // Remove event handlers (onclick, onload, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*"[^"]*"/gi, '')
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*'[^']*'/gi, '')
  // Remove javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"')
  sanitized = sanitized.replace(/src\s*=\s*"javascript:[^"]*"/gi, 'src=""')
  // Remove iframe tags
  sanitized = sanitized.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
  sanitized = sanitized.replace(/<iframe[^>]*\/>/gi, '')
  
  // Remove <head> block (contains duplicate title/meta and embedded styles)
  sanitized = sanitized.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
  
  // Remove doctype, html, body wrapper tags (keep content)
  sanitized = sanitized.replace(/<!DOCTYPE[^>]*>/gi, '')
  sanitized = sanitized.replace(/<\/?html[^>]*>/gi, '')
  sanitized = sanitized.replace(/<\/?body[^>]*>/gi, '')

  // Remove stray "00" text nodes that show up as a badge
  sanitized = sanitized.replace(/>(\s*00\s*)</g, '><')
  sanitized = sanitized.replace(/\b00\b/g, '')
  
  // Theme compatibility: Remove inline style attributes
  sanitized = sanitized.replace(/\sstyle="[^"]*"/gi, '')
  
  // Remove bgcolor attributes
  sanitized = sanitized.replace(/\sbgcolor="[^"]*"/gi, '')
  
  // Remove color attributes on font tags
  sanitized = sanitized.replace(/\scolor="[^"]*"/gi, '')
  
  // Remove border attributes
  sanitized = sanitized.replace(/\sborder="[^"]*"/gi, '')
  
  // Remove width/height on hr elements that might cause issues
  sanitized = sanitized.replace(/<hr[^>]*>/gi, '<hr />')
  
  return sanitized
}

interface BlogGeneratorBasicProps {
  refreshMode?: boolean
}

export default function BlogGeneratorBasic({ refreshMode: initialRefreshMode = false }: BlogGeneratorBasicProps = {}) {
  // Business context integration
  const { businessContext, hasContext } = useContextStorage()

  // Results state
  const [results, setResults] = useState<any[]>([])
  const [selectedBlog, setSelectedBlog] = useState<any | null>(null)
  const [isLoadingResults, setIsLoadingResults] = useState(false)

  const [keyword, setKeyword] = useState('AI automation for small businesses 2025')
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [batchMode, setBatchMode] = useState(false)
  const [refreshMode, setRefreshMode] = useState(initialRefreshMode)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<any[]>([])
  const [country, setCountry] = useState('US')
  const [language, setLanguage] = useState('en')
  
  // Keywords loaded from Keywords page
  const [keywordsFromGenerator, setKeywordsFromGenerator] = useState<string[]>([])
  const [showKeywordBanner, setShowKeywordBanner] = useState(false)

  // Check for keywords passed from Keywords page on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('keywords-for-blog')
        if (stored) {
          const data = JSON.parse(stored)
          // Only use if less than 5 minutes old
          if (data.timestamp && Date.now() - data.timestamp < 5 * 60 * 1000) {
            if (data.keywords && data.keywords.length > 0) {
              setKeywordsFromGenerator(data.keywords)
              setShowKeywordBanner(true)
              // Auto-enable batch mode and set up CSV data
              setBatchMode(true)
              setCsvData(data.keywords.map((kw: string) => ({ keyword: kw })))
              // Apply language/country if provided
              if (data.language) setLanguage(data.language)
              if (data.country) setCountry(data.country)
              toast.success(`${data.keywords.length} keywords loaded from Keywords page`)
            }
          }
          // Clear after reading (one-time use)
          localStorage.removeItem('keywords-for-blog')
        }
      } catch (error) {
        console.error('Failed to load keywords from localStorage:', error)
      }
    }
  }, [])

  // Apply primary market from context when available
  useEffect(() => {
    if (businessContext.primaryLanguage) {
      setLanguage(businessContext.primaryLanguage)
    }
    if (businessContext.primaryCountry) {
      setCountry(businessContext.primaryCountry)
    }
  }, [businessContext.primaryLanguage, businessContext.primaryCountry])

  // Mobile responsiveness
  const { isMobile, isTablet } = useMobile()
  const isMobileOrTablet = isMobile || isTablet
  const [mobileActiveTab, setMobileActiveTab] = useState<string>('input')

  // FIX #3: Sync refreshMode state when prop changes
  useEffect(() => {
    setRefreshMode(initialRefreshMode)
    // FIX: Clear batchMode when switching to Refresh tab
    if (initialRefreshMode) {
      setBatchMode(false)
    }
  }, [initialRefreshMode])

  // Stage tracking for progress display
  const [progress, setProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [timeRemaining, setTimeRemaining] = useState(0)
  
  // Auto-switch to output tab when generation starts
  useEffect(() => {
    if (isMobileOrTablet && isGenerating) {
      setMobileActiveTab('output')
    }
  }, [isMobileOrTablet, isGenerating])

  // Cleanup intervals on unmount to prevent memory leaks
  const progressIntervalRef = React.useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const uiClearTimerRef = React.useRef<NodeJS.Timeout | null>(null)
  const apiTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const contentPreviewRef = React.useRef<HTMLDivElement | null>(null)

  // Handle image loading/errors in blog preview content
  useEffect(() => {
    if (contentPreviewRef.current && selectedBlog) {
      const images = contentPreviewRef.current.querySelectorAll('img')
      images.forEach((img: HTMLImageElement) => {
        // Skip if already processed
        if (img.dataset.processed === 'true') return
        img.dataset.processed = 'true'

        // If src is empty or missing, hide immediately
        if (!img.src || img.src === '' || img.src === window.location.href) {
          img.classList.add('error')
          img.style.display = 'none'
          return
        }

        // Add load handler
        img.onload = () => {
          img.classList.add('loaded')
          img.classList.remove('error')
        }

        // Add error handler
        img.onerror = () => {
          img.classList.add('error')
          img.classList.remove('loaded')
          img.style.display = 'none'
        }

        // Check if image is already loaded
        if (img.complete && img.naturalWidth > 0) {
          img.classList.add('loaded')
        }
      })
    }
  }, [selectedBlog])

  useEffect(() => {
    return () => {
      // Clear all timers on unmount
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      if (uiClearTimerRef.current) {
        clearTimeout(uiClearTimerRef.current)
        uiClearTimerRef.current = null
      }
      if (apiTimeoutRef.current) {
        clearTimeout(apiTimeoutRef.current)
        apiTimeoutRef.current = null
      }
    }
  }, [])

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsGenerating(false)
    setProgress(0)
    setCurrentStage(0)
    setLogs([])
    toast.info('Generation cancelled')
  }, [])

  // Handle CSV file upload
  const handleCsvUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setCsvFile(file)

    // Parse CSV using Papaparse (handles quoted fields, commas in content, etc.)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.error('CSV parsing errors:', results.errors)
          toast.error('CSV parsing error: ' + results.errors[0]?.message)
          return
        }

        if (results.data.length === 0) {
          toast.error('CSV must have at least one data row')
          return
        }

        setCsvData(results.data as any[])
        toast.success(`CSV loaded: ${results.data.length} ${refreshMode ? 'items' : 'keywords'} found`)
      },
      error: (error) => {
        console.error('CSV parsing failed:', error)
        toast.error('Failed to parse CSV file')
      }
    })
  }, [refreshMode])

  // Save blog to Supabase for history
  const saveBlogToHistory = useCallback(async (blog: any, type: 'single' | 'batch' | 'refresh') => {
    const blogData = {
      type: type === 'batch' ? 'blog_batch' : type === 'refresh' ? 'refresh' : 'blog',
      company: businessContext?.companyName || 'Unknown',
      url: businessContext?.companyWebsite || '',
      language: language,
      country: country,
      keyword: blog.keyword || blog.title || '',
      title: blog.title || blog.metadata?.meta_title || '',
      word_count: blog.metadata?.word_count || 0,
      content: blog.content || blog.html_content || '',
      aeo_score: blog.metadata?.aeo_score || 0,
      generation_time: blog.metadata?.generation_time || 0,
    }

    try {
      const response = await fetch('/api/blog-generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blogData)
      })
      
      if (!response.ok) {
        console.error('[BlogGenerator] Failed to save blog to history:', await response.text())
      }
    } catch (error) {
      console.error('[BlogGenerator] Failed to save blog to history:', error)
    }
  }, [businessContext, language, country])

  // Handle generation completion
  const handleGenerationComplete = useCallback(async (result: any) => {
    setResults(prev => [result, ...prev])
    // Auto-select the first generated blog for preview
    setSelectedBlog(result)
    // Save to history
    saveBlogToHistory(result, result.type === 'refresh' ? 'refresh' : 'batch')
    // Persist to Supabase history
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: result.type === 'refresh' ? 'refresh' : (result.type === 'batch' ? 'blog_batch' : 'blog'),
          company: businessContext?.companyName || '',
          url: businessContext?.companyWebsite || '',
          payload: {
            language,
            country,
            keyword: result.keyword || '',
            title: result.title || '',
            content: result.content || result.html_content || '',
            wordCount: result.metadata?.word_count || 0,
            aeoScore: result.metadata?.aeo_score || 0,
            results: result.results || undefined,
          },
        }),
      })
    } catch (err) {
      console.warn('[BlogGenerator] Failed to write history log:', err)
    }
    // NOTE: DO NOT set isGenerating=false, progress=0, or clear logs here!
    // This function is called IN A LOOP during batch/refresh modes.
    // Those state resets are handled by the caller after ALL items complete.
  }, [saveBlogToHistory, businessContext, language, country])

  // Handle single-blog completion (used only for single mode)
  const handleSingleBlogComplete = useCallback(async (result: any) => {
    setResults(prev => [result, ...prev])
    setSelectedBlog(result)
    saveBlogToHistory(result, 'single')
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'blog',
          company: businessContext?.companyName || '',
          url: businessContext?.companyWebsite || '',
          payload: {
            language,
            country,
            keyword: result.keyword || '',
            title: result.title || '',
            content: result.content || result.html_content || '',
            wordCount: result.metadata?.word_count || 0,
            aeoScore: result.metadata?.aeo_score || 0,
          },
        }),
      })
    } catch (err) {
      console.warn('[BlogGenerator] Failed to write history log:', err)
    }
    setIsGenerating(false)
    setProgress(0)
    setCurrentStage(0)
    setLogs([])
    toast.success('Blog generation completed!')
  }, [saveBlogToHistory, businessContext, language, country])

  const handleGenerate = async () => {
    if (refreshMode) {
      // Content refresh mode: refresh provided content directly
      if (!csvFile || csvData.length === 0) {
        toast.error('Please upload a CSV file with content to refresh')
        return
      }

      setIsGenerating(true)
      setProgress(0)
      setCurrentStage(0)
      setLogs([`[${new Date().toLocaleTimeString()}] 🔄 Starting refresh of ${csvData.length} pieces of content...`])
      toast.info(`Refreshing ${csvData.length} pieces of content...`)

      // Create abort controller for cancel functionality
      abortControllerRef.current = new AbortController()

      try {
        // Prepare refresh items from CSV
        const items = csvData.map(row => {
          const title = row.title || row.Title || row.TITLE || ''
          const content = row.content || row.Content || row.CONTENT || ''
          const keyword = row.keyword || row.Keyword || row.KEYWORD || title || ''

          if (!title || !content || !keyword) {
            console.warn('Skipping row with missing title, content, or keyword:', row)
            return null
          }

          return {
            title: title.trim(),
            content: content.trim(),
            keyword: keyword.trim(),
            country: row.country || country,
            language: row.language || language,
            word_count: 1500,
            tone: 'professional'
          }
        }).filter(Boolean)

        if (items.length === 0) {
          toast.error('No valid content found in CSV. Ensure you have title, content, and keyword columns.')
          setIsGenerating(false)
          return
        }

        // Process each content item individually using existing API
        let successCount = 0
        let failedCount = 0

        for (let i = 0; i < items.length; i++) {
          // Check if cancelled
          if (abortControllerRef.current?.signal.aborted) {
            toast.info(`Refresh cancelled. Completed ${successCount}/${items.length} items.`)
            break
          }

          const item = items[i]
          const itemProgress = ((i + 1) / items.length) * 100

          setProgress(itemProgress)
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Processing ${i + 1}/${items.length}: ${item.keyword}`])

          try {
            const response = await fetch('/api/generate-blog', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                keyword: item.keyword,
                word_count: item.word_count || 1500,
                tone: item.tone || 'professional',
                company_name: businessContext?.companyName || 'SCAILE',
                company_url: (businessContext?.companyWebsite && businessContext.companyWebsite.startsWith('http')) ? businessContext.companyWebsite : 'https://scaile.tech',
                business_context: businessContext || {},
                language: item.language || language,
                country: item.country || country,
                additional_instructions: `CONTENT REFRESH: Update and improve this existing content.\n\nOriginal Title: ${item.title}\n\nOriginal Content: ${item.content.substring(0, 500)}...`,
                apiKey: '' // Will use env variable
              }),
              signal: abortControllerRef.current?.signal
            })

            if (response.ok) {
              const result = await response.json()
              handleGenerationComplete({
                ...result,
                keyword: item.keyword,
                type: 'refresh'
              })
              successCount++
              setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Refreshed: ${item.keyword}`])
            } else {
              console.error(`Failed to refresh content for: ${item.keyword}`)
              failedCount++
              setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Failed: ${item.keyword}`])
            }
          } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') {
              // User cancelled - already handled above
              break
            }
            console.error(`Error refreshing ${item.keyword}:`, error)
            failedCount++
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Error: ${item.keyword}`])
          }
        }

        if (!abortControllerRef.current?.signal.aborted) {
          setProgress(100)
          const message = failedCount > 0
            ? `Content refresh completed: ${successCount} succeeded, ${failedCount} failed`
            : `Content refresh completed: ${successCount}/${items.length} items refreshed`
          toast.success(message)
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])

          // Give user time to see completion before clearing UI
          uiClearTimerRef.current = setTimeout(() => {
            setIsGenerating(false)
            setProgress(0)
            setCurrentStage(0)
            setLogs([])
            uiClearTimerRef.current = null
          }, 2000)
        }
      } catch (error) {
        console.error('Content refresh error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to refresh content'
        toast.error(errorMessage)
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ ${errorMessage}`])

        // Clear UI immediately on error
        setIsGenerating(false)
        setProgress(0)
        setLogs([])
      } finally {
        abortControllerRef.current = null
      }
    } else if (batchMode) {
      // Batch mode: optimized batch processing
      // Allow keywords from Keywords page (no csvFile) or from CSV upload
      if (csvData.length === 0) {
        toast.error('Please upload a CSV file with keywords or select keywords from the Keywords page')
        return
      }

      setIsGenerating(true)
      setProgress(0)
      setCurrentStage(0)
      setLogs([`[${new Date().toLocaleTimeString()}] ⏳ Starting batch generation of ${csvData.length} blogs...`])
      toast.info(`Processing ${csvData.length} keywords in batch...`)

      // Create abort controller for cancel functionality
      abortControllerRef.current = new AbortController()

      // Calculate total duration for batch mode (per blog * number of blogs)
      const totalBatchDuration = BATCH_STAGE_ORDER.reduce((sum, stage) => sum + BATCH_STAGE_CONFIGURATIONS[stage].duration, 0)
      setTimeRemaining(totalBatchDuration)

      // Start progress simulation for batch mode with stage tracking
      const startTime = Date.now()
      progressIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000
        const progressPercent = Math.min(95, (elapsed / totalBatchDuration) * 100)
        
        setProgress(progressPercent)
        setTimeRemaining(Math.max(0, totalBatchDuration - elapsed))

        // Update current stage based on progress
        let cumulativeDuration = 0
        for (let i = 0; i < BATCH_STAGE_ORDER.length; i++) {
          cumulativeDuration += BATCH_STAGE_CONFIGURATIONS[BATCH_STAGE_ORDER[i]].duration
          if (elapsed < cumulativeDuration) {
            setCurrentStage(prevStage => {
              if (i !== prevStage) {
                const stageName = BATCH_STAGE_CONFIGURATIONS[BATCH_STAGE_ORDER[i]].name
                setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${stageName}`])
                return i
              }
              return prevStage
            })
            break
          }
        }
      }, 500)

      try {
        // Prepare batch items
        const items = csvData.map(row => ({
          keyword: (row.keyword || row.Keyword || row.KEYWORD || Object.values(row)[0])?.trim(),
          country: row.country || country,
          language: row.language || language,
          word_count: 1500,
          tone: 'professional'
        })).filter(item => item.keyword)

        if (items.length === 0) {
          toast.error('No valid keywords found in CSV')
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
            progressIntervalRef.current = null
          }
          setIsGenerating(false)
          return
        }

        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Processing ${items.length} keywords...`])

        // Use existing batch mode in generate-blog API with abort signal
        const response = await fetch('/api/generate-blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyword: 'batch',
            batch_mode: true,
            batch_keywords: items.map(item => ({
              keyword: item.keyword,
              word_count: item.word_count || 1500,
              instructions: `Language: ${item.language || language}, Country: ${item.country || country}`
            })),
            word_count: 1500,
            tone: 'professional',
            company_name: businessContext?.companyName || 'SCAILE',
            company_url: (businessContext?.companyWebsite && businessContext.companyWebsite.startsWith('http')) ? businessContext.companyWebsite : 'https://scaile.tech',
            business_context: businessContext || {},
            language: language,
            country: country,
            additional_instructions: 'Generate AEO-optimized content that performs well in AI search engines like ChatGPT, Claude, Perplexity, and Gemini.',
            apiKey: '' // Will use env variable
          }),
          signal: abortControllerRef.current?.signal
        })

        // Check if cancelled
        if (abortControllerRef.current?.signal.aborted) {
          toast.info('Batch generation cancelled.')
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Batch generation cancelled`])
          return
        }

        setProgress(50)
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Batch API call completed, processing results...`])

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Network error' }))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const result = await response.json()
        setProgress(90)

        // Check for batch results (batch_mode=true or has results array)
        if (result.batch_mode || result.results) {
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Batch completed: ${result.successful || result.results?.length || 0}/${result.total || result.results?.length || 0} blogs generated`])
          toast.success(`Batch processing completed: ${result.successful || result.results?.length || 0} blogs generated`)
          if (result.results && result.results.length > 0) {
            result.results.forEach((blogResult: any, index: number) => {
              handleGenerationComplete({
                ...blogResult,
                type: 'batch'
              })
              setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Added blog ${index + 1}/${result.results.length}: ${blogResult.keyword || blogResult.title || 'Unknown'}`])
            })
          }
        } else {
          handleGenerationComplete({
            ...result,
            type: 'batch'
          })
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Blog generated successfully`])
        }

        // Stop progress simulation
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
          progressIntervalRef.current = null
        }

        setProgress(100)
        setCurrentStage(BATCH_STAGE_ORDER.length - 1)
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Batch processing complete`])

        // Give user time to see completion before clearing UI
        uiClearTimerRef.current = setTimeout(() => {
          setIsGenerating(false)
          setProgress(0)
          setCurrentStage(0)
          setLogs([])
          uiClearTimerRef.current = null
        }, 3000)
      } catch (error) {
        // Stop progress simulation on error
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
          progressIntervalRef.current = null
        }

        // Check if error is abort error
        if (error instanceof Error && error.name === 'AbortError') {
          toast.info('Batch generation cancelled.')
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Batch generation cancelled`])
          setIsGenerating(false)
          setProgress(0)
          setLogs([])
          return
        }

        console.error('Batch blog generation error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to process batch'
        toast.error(errorMessage)
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ ${errorMessage}`])

        // Clear UI immediately on error
        setIsGenerating(false)
        setProgress(0)
        setLogs([])
      } finally {
        abortControllerRef.current = null
      }
    } else {
      // Single mode
      try {
        // Validate input
        if (!keyword.trim()) {
          toast.error('Please enter a keyword')
          return
        }

        setIsGenerating(true)
        setCurrentTaskId(null)
        setProgress(0)
        setCurrentStage(0)
        setLogs([`[${new Date().toLocaleTimeString()}] 🚀 Starting blog generation...`])

        // Calculate total duration
        const totalDuration = STAGE_ORDER.reduce((sum, stage) => sum + STAGE_CONFIGURATIONS[stage].duration, 0)
        setTimeRemaining(totalDuration)

        // Progress simulator with stage tracking
        const startTime = Date.now()
        progressIntervalRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000
          const progressPercent = Math.min(95, (elapsed / totalDuration) * 100)

          setProgress(progressPercent)
          setTimeRemaining(Math.max(0, totalDuration - elapsed))

          // Update current stage based on progress using functional updates to avoid race conditions
          let cumulativeDuration = 0
          for (let i = 0; i < STAGE_ORDER.length; i++) {
            cumulativeDuration += STAGE_CONFIGURATIONS[STAGE_ORDER[i]].duration
            if (elapsed < cumulativeDuration) {
              setCurrentStage(prevStage => {
                if (i !== prevStage) {
                  const stageName = STAGE_CONFIGURATIONS[STAGE_ORDER[i]].name
                  setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${stageName}`])
                  return i
                }
                return prevStage
              })
              break
            }
          }
        }, 1000)

        try {
          // Use existing generate-blog API with timeout
          const controller = new AbortController()
          apiTimeoutRef.current = setTimeout(() => controller.abort(), 360000) // 6 minute timeout

          const response = await fetch('/api/generate-blog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keyword: keyword.trim(),
              word_count: 1500,
              tone: 'professional',
              company_name: businessContext?.companyName || 'SCAILE',
              company_url: (businessContext?.companyWebsite && businessContext.companyWebsite.startsWith('http')) ? businessContext.companyWebsite : 'https://scaile.tech',
              business_context: businessContext || {},
              language: language,
              country: country,
              additional_instructions: 'Generate AEO-optimized content that performs well in AI search engines like ChatGPT, Claude, Perplexity, and Gemini.',
              apiKey: '' // Will use env variable
            }),
            signal: controller.signal
          })

          if (apiTimeoutRef.current) {
            clearTimeout(apiTimeoutRef.current)
            apiTimeoutRef.current = null
          }
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
            progressIntervalRef.current = null
          }

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Network error' }))
            throw new Error(errorData.error || `HTTP ${response.status}`)
          }

          const result = await response.json()

          // Update to 100% and complete
          setProgress(100)
          setCurrentStage(STAGE_ORDER.length - 1)
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Blog generation complete!`])

          handleSingleBlogComplete({
            ...result,
            keyword: keyword.trim(),
            type: 'single'
          })
        } finally {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
            progressIntervalRef.current = null
          }
          if (apiTimeoutRef.current) {
            clearTimeout(apiTimeoutRef.current)
            apiTimeoutRef.current = null
          }
        }

      } catch (error) {
        console.error('Error starting blog generation:', error)
        let errorMessage = 'Failed to generate blog'

        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            errorMessage = 'Request timed out after 6 minutes. Please try again.'
          } else {
            errorMessage = error.message
          }
        }

        toast.error(errorMessage)
        setIsGenerating(false)
        setProgress(0)
        setLogs([])

        // Ensure all timers are cleared on error
        if (apiTimeoutRef.current) {
          clearTimeout(apiTimeoutRef.current)
          apiTimeoutRef.current = null
        }
      }
    }
  }

  // Export blog as HTML
  const handleExportHTML = useCallback((blog: any) => {
    if (!blog?.content) {
      toast.error('No blog content to export')
      return
    }
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${blog.title || blog.keyword || 'Generated Blog'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1, h2, h3 { color: #333; }
    p { margin: 1em 0; }
  </style>
</head>
<body>
  <h1>${blog.title || blog.keyword || 'Generated Blog'}</h1>
  ${blog.content || ''}
  <hr>
  <p><em>Generated on ${new Date().toLocaleDateString()} with AEO optimization</em></p>
</body>
</html>`

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const timestamp = new Date().toISOString().split('T')[0]
    const title = (blog.title || blog.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    a.download = `aeo-blog-${title}-${timestamp}.html`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success('Blog exported as HTML file')
  }, [])

  // Export blog as XLSX
  const handleExportXLSX = useCallback(async (blog: any) => {
    if (!blog?.content) {
      toast.error('No blog content to export')
      return
    }
    
    try {
      const exportData = [{
        'Title': blog.title || blog.keyword || 'Generated Blog',
        'Keyword': blog.keyword || 'N/A',
        'Content': (blog.content || '').replace(/<[^>]*>/g, ''), // Strip HTML
        'Word Count': blog.metadata?.word_count || 'N/A',
        'Generation Time': blog.metadata?.generation_time + 's' || 'N/A',
        'AEO Score': blog.metadata?.aeo_score || 'N/A',
        'Type': blog.type || 'single',
        'Generated Date': new Date().toLocaleDateString(),
      }]
      
      const timestamp = new Date().toISOString().split('T')[0]
      const title = (blog.title || blog.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      const filename = `aeo-blog-${title}-${timestamp}.xlsx`
      
      await downloadXLSX(exportData, filename, 'Blog Content')
      toast.success('Blog exported as XLSX file')
    } catch (error) {
      toast.error('Failed to export XLSX file')
      console.error('XLSX export error:', error)
    }
  }, [])

  // Copy blog content to clipboard
  const handleCopyContent = useCallback(async (blog: any) => {
    if (!blog?.content) {
      toast.error('No blog content to copy')
      return
    }
    
    try {
      // Convert HTML to properly formatted plain text
      const plainText = htmlToPlainText(blog.content)
      await navigator.clipboard.writeText(plainText)
      toast.success('Content copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy content')
      console.error('Copy error:', error)
    }
  }, [])

  // Export blog as TXT
  const handleExportTXT = useCallback((blog: any) => {
    if (!blog?.content) {
      toast.error('No blog content to export')
      return
    }
    
    // Use proper HTML-to-text conversion
    const textContent = formatBlogAsTxt(blog)

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const timestamp = new Date().toISOString().split('T')[0]
    const titleSlug = (blog.title || blog.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    a.download = `aeo-blog-${titleSlug}-${timestamp}.txt`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success('Blog exported as TXT file')
  }, [])

  // Export blog as PDF
  const handleExportPDF = useCallback(async (blog: any) => {
    if (!blog?.content) {
      toast.error('No blog content to export')
      return
    }
    
    try {
      // Dynamic import to avoid SSR issues
      const { jsPDF } = await import('jspdf')
      
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.width
      const pageHeight = doc.internal.pageSize.height
      const margin = 15
      const contentWidth = pageWidth - (margin * 2)
      let yPos = 20
      
      // Helper to check page break
      const checkPageBreak = (neededHeight: number) => {
        if (yPos + neededHeight > pageHeight - 25) {
          doc.addPage()
          yPos = 20
        }
      }
      
      // Get structured content
      const sections = formatBlogForPdf(blog)
      
      for (const section of sections) {
        switch (section.type) {
          case 'title':
            doc.setFontSize(20)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(0)
            const titleLines = doc.splitTextToSize(section.text, contentWidth)
            checkPageBreak(titleLines.length * 8)
            doc.text(titleLines, margin, yPos)
            yPos += titleLines.length * 8 + 5
            break
            
          case 'heading':
            const fontSize = section.level === 1 ? 16 : section.level === 2 ? 14 : 12
            checkPageBreak(10)
            yPos += 8 // Space before heading
            doc.setFontSize(fontSize)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(0)
            const headingLines = doc.splitTextToSize(section.text, contentWidth)
            doc.text(headingLines, margin, yPos)
            yPos += headingLines.length * (fontSize * 0.4) + 4
            break
            
          case 'paragraph':
            doc.setFontSize(11)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(40)
            const paraLines = doc.splitTextToSize(section.text, contentWidth)
            for (const line of paraLines) {
              checkPageBreak(5)
              doc.text(line, margin, yPos)
              yPos += 5
            }
            yPos += 3 // Space after paragraph
            break
            
          case 'list':
            doc.setFontSize(11)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(40)
            for (let i = 0; i < (section.items?.length || 0); i++) {
              const prefix = section.ordered ? `${i + 1}. ` : '• '
              const itemText = prefix + (section.items?.[i] || '')
              const itemLines = doc.splitTextToSize(itemText, contentWidth - 10)
              for (let j = 0; j < itemLines.length; j++) {
                checkPageBreak(5)
                doc.text(itemLines[j], margin + (j === 0 ? 0 : 8), yPos)
                yPos += 5
              }
            }
            yPos += 3
            break
            
          case 'blockquote':
            checkPageBreak(10)
            doc.setFontSize(11)
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(80)
            doc.setDrawColor(150)
            doc.line(margin, yPos - 2, margin, yPos + 8)
            const quoteLines = doc.splitTextToSize(section.text, contentWidth - 10)
            for (const line of quoteLines) {
              checkPageBreak(5)
              doc.text(line, margin + 5, yPos)
              yPos += 5
            }
            yPos += 5
            break
            
          case 'code':
            checkPageBreak(10)
            doc.setFontSize(9)
            doc.setFont('courier', 'normal')
            doc.setTextColor(0)
            doc.setFillColor(245, 245, 245)
            const codeLines = doc.splitTextToSize(section.text, contentWidth - 10)
            doc.rect(margin, yPos - 3, contentWidth, codeLines.length * 4 + 6, 'F')
            for (const line of codeLines) {
              checkPageBreak(4)
              doc.text(line, margin + 3, yPos)
              yPos += 4
            }
            yPos += 5
            break
            
          case 'hr':
            checkPageBreak(10)
            yPos += 5
            doc.setDrawColor(200)
            doc.line(margin, yPos, pageWidth - margin, yPos)
            yPos += 8
            break
            
          case 'footer':
            // Footer on the last page
            doc.setFontSize(8)
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(150)
            doc.text(section.text, margin, pageHeight - 10)
            break
        }
      }
      
      const timestamp = new Date().toISOString().split('T')[0]
      const titleSlug = (blog.title || blog.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      doc.save(`aeo-blog-${titleSlug}-${timestamp}.pdf`)
      
      toast.success('Blog exported as PDF file')
    } catch (error) {
      toast.error('Failed to export PDF file')
      console.error('PDF export error:', error)
    }
  }, [])

  // Export blog as DOCX
  const handleExportDOCX = useCallback(async (blog: any) => {
    if (!blog?.content) {
      toast.error('No blog content to export')
      return
    }
    
    try {
      // Dynamic imports to avoid SSR issues
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = await import('docx')
      const fileSaver = await import('file-saver')
      const saveAs = fileSaver.saveAs || fileSaver.default?.saveAs || fileSaver.default
      
      // Get structured content
      const sections = formatBlogForDocx(blog)
      const children: any[] = []
      
      for (const section of sections) {
        switch (section.type) {
          case 'title':
            children.push(new Paragraph({
              text: section.text,
              heading: HeadingLevel.TITLE,
              spacing: { after: 200 },
            }))
            break
            
          case 'heading':
            const headingLevel = section.level === 1 ? HeadingLevel.HEADING_1 
              : section.level === 2 ? HeadingLevel.HEADING_2 
              : section.level === 3 ? HeadingLevel.HEADING_3
              : HeadingLevel.HEADING_4
            children.push(new Paragraph({
              text: section.text,
              heading: headingLevel,
              spacing: { before: 300, after: 150 },
            }))
            break
            
          case 'paragraph':
            children.push(new Paragraph({
              children: [new TextRun({ text: section.text })],
              spacing: { after: 200 },
            }))
            break
            
          case 'list':
            for (let i = 0; i < (section.items?.length || 0); i++) {
              const prefix = section.ordered ? `${i + 1}. ` : '• '
              children.push(new Paragraph({
                children: [new TextRun({ text: prefix + (section.items?.[i] || '') })],
                spacing: { after: 100 },
                indent: { left: 360 }, // Indent list items
              }))
            }
            break
            
          case 'blockquote':
            children.push(new Paragraph({
              children: [new TextRun({ text: section.text, italics: true, color: '555555' })],
              spacing: { after: 200 },
              indent: { left: 360 },
              border: {
                left: { style: BorderStyle.SINGLE, size: 12, color: 'AAAAAA' }
              },
            }))
            break
            
          case 'code':
            children.push(new Paragraph({
              children: [new TextRun({ text: section.text, font: 'Courier New', size: 20 })],
              spacing: { after: 200 },
              shading: { fill: 'F5F5F5' },
            }))
            break
            
          case 'footer':
            children.push(new Paragraph({
              children: [new TextRun({ text: section.text, size: 18, color: '999999', italics: true })],
              spacing: { before: 400 },
            }))
            break
        }
      }
      
      const doc = new Document({
        sections: [{
          properties: {},
          children,
        }],
      })
      
      const blob = await Packer.toBlob(doc)
      const timestamp = new Date().toISOString().split('T')[0]
      const titleSlug = (blog.title || blog.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      saveAs(blob, `aeo-blog-${titleSlug}-${timestamp}.docx`)
      
      toast.success('Blog exported as DOCX file')
    } catch (error) {
      toast.error('Failed to export DOCX file')
      console.error('DOCX export error:', error)
    }
  }, [])

  // Input panel component
  const inputPanel = (
    <GenerationInputPanel 
      title="Blog Generator" 
      description="Generate AEO-optimized blog articles using AI"
    >
      <ContextPanel
        country={country}
        language={language}
        onCountryChange={setCountry}
        onLanguageChange={setLanguage}
        disabled={isGenerating}
      />
      
      <div className="space-y-4">
        {/* Keywords loaded from Keywords page banner */}
        {showKeywordBanner && keywordsFromGenerator.length > 0 && (
          <div className="bg-gradient-to-r from-foreground/10 to-foreground/5 border border-foreground/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {keywordsFromGenerator.length} keywords ready for blog generation
                  </p>
                  <p className="text-xs text-muted-foreground">
                    From Keywords page • Click Generate to create blogs
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowKeywordBanner(false)
                  setKeywordsFromGenerator([])
                  setBatchMode(false)
                  setCsvData([])
                }}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {keywordsFromGenerator.length <= 5 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {keywordsFromGenerator.map((kw, idx) => (
                  <span key={idx} className="text-xs bg-background/50 px-2 py-0.5 rounded border border-border/50">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Batch mode toggle - only show on Blog Gen tab, not Refresh tab */}
        {!initialRefreshMode && !showKeywordBanner && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="batch-mode"
              checked={batchMode}
              onCheckedChange={(checked) => {
                // Only allow enabling batch mode if NOT in refresh mode
                if (checked && refreshMode) return
                setBatchMode(!!checked)
              }}
            />
            <label htmlFor="batch-mode" className="text-sm font-medium text-foreground">
              Batch mode (CSV upload)
            </label>
          </div>
        )}

        {(batchMode || refreshMode) ? (
          /* Batch/Keywords Mode */
          <div className="space-y-4">
            {/* Show keywords from Keywords page */}
            {showKeywordBanner && keywordsFromGenerator.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Keywords to Generate ({keywordsFromGenerator.length})</h3>
                <div className="max-h-48 overflow-y-auto border border-border/50 rounded-lg p-3 bg-muted/30">
                  <div className="space-y-1">
                    {keywordsFromGenerator.map((kw, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-background/50">
                        <span className="text-muted-foreground w-6">{idx + 1}.</span>
                        <span className="flex-1">{kw}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* CSV Upload Mode */
              <>
                <h3 className="text-sm font-medium">
                  {refreshMode ? 'Upload Content List CSV' : 'Upload Keywords CSV'}
                </h3>
                <div className="border-2 border-dashed border-border rounded-lg p-6 bg-transparent">
                  <div className="text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      {refreshMode 
                        ? 'Upload CSV file with existing content to refresh (title, content, keyword)'
                        : 'Upload CSV file with keywords'
                      }
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md shadow-sm bg-card text-foreground hover:bg-accent cursor-pointer"
                    >
                      Choose CSV File
                    </label>
                  </div>
                  {csvFile && (
                    <div className="mt-4 p-3 bg-muted/50 border border-border/50 rounded text-sm text-foreground">
                      <p><strong className="text-foreground">File:</strong> {csvFile.name}</p>
                      <p><strong className="text-foreground">Keywords:</strong> {csvData.length}</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {refreshMode 
                    ? "CSV should have 'title', 'content', and 'keyword' columns with existing content to refresh."
                    : "CSV should have a 'keyword' column. Optional: 'country' and 'language' columns."
                  }
                </p>
              </>
            )}
          </div>
        ) : (
          /* Single Keyword Mode */
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Primary Keyword</h3>
            <input 
              type="text" 
              value={keyword} 
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g., AI automation for small businesses 2025"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        )}
        
        <CreditCostPreview
          serviceType="BLOG_CREATION"
          compact={true}
          showBalance={true}
          quantity={(batchMode || refreshMode) && csvData.length > 0 ? csvData.length : 1}
        />
      </div>

      {/* Sticky Generate Button - Fixed at bottom */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border/50 shadow-lg">
        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || (!hasContext && !batchMode && !refreshMode) || ((batchMode || refreshMode) && csvData.length === 0)}
            className="flex-1 min-h-[48px]"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {refreshMode ? `Refreshing...` :
                 batchMode ? `Processing...` : 'Generating...'}
              </>
            ) : (
              <>
                {refreshMode ? (
                  <RefreshCw className="h-4 w-4 mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {refreshMode ? `Refresh ${csvData.length} Content` :
                 batchMode ? `Process ${csvData.length} Blogs` : 'Generate Blog Article'}
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
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </GenerationInputPanel>
  )

  // Output panel component
  const outputPanel = (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 bg-card">
      {/* Show RunningState when generating */}
      {isGenerating && (
        <div className="h-full flex items-center justify-center">
          <RunningState
            status="running"
            progress={progress}
            currentStage={
              batchMode
                ? (BATCH_STAGE_ORDER[currentStage]
                    ? BATCH_STAGE_CONFIGURATIONS[BATCH_STAGE_ORDER[currentStage]].description
                    : `Processing ${csvData.length} blogs...`)
                : refreshMode
                ? `Refreshing ${csvData.length} content items...`
                : (STAGE_ORDER[currentStage]
                    ? STAGE_CONFIGURATIONS[STAGE_ORDER[currentStage]].description
                    : 'Processing...')
            }
            estimate={timeRemaining}
            stages={
              batchMode
                ? BATCH_STAGE_ORDER.map((stageKey, index) => {
                    const config = BATCH_STAGE_CONFIGURATIONS[stageKey]
                    return {
                      id: stageKey,
                      name: config.name,
                      status:
                        index < currentStage ? 'complete' :
                        index === currentStage ? 'running' :
                        'pending',
                      duration: config.duration
                    }
                  })
                : refreshMode
                ? [] // No stage breakdown for refresh mode
                : STAGE_ORDER.map((stageKey, index) => {
                    const config = STAGE_CONFIGURATIONS[stageKey]
                    return {
                      id: stageKey,
                      name: config.name,
                      status:
                        index < currentStage ? 'complete' :
                        index === currentStage ? 'running' :
                        'pending',
                      duration: config.duration
                    }
                  })
            }
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

      {/* Show empty state when no results and not generating */}
      {!results.length && !isGenerating && !selectedBlog && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-3 max-w-sm text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto opacity-50" />
            <h3 className="font-medium">No Blog Results Yet</h3>
            {!hasContext && !batchMode && !refreshMode ? (
              <p className="text-sm">
                Please set up your business context first in the{' '}
                <a href="/context" className="text-primary hover:underline">Context page</a>
                {' '}to enable blog generation.
              </p>
            ) : (
              <p className="text-sm">Generated blogs will appear here. Use the form on the left to create your first AEO-optimized blog article.</p>
            )}
          </div>
        </div>
      )}

      {/* Show blog preview when we have results and not generating */}
      {(results.length > 0 || selectedBlog) && !isGenerating && (
        <div className="h-full flex flex-col">
          {/* Header with actions */}
          <div className="flex-shrink-0 flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-foreground">
                {selectedBlog?.title || selectedBlog?.keyword || 'Blog Preview'}
              </h3>
              {selectedBlog?.metadata?.aeo_score && (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded">
                  AEO: {selectedBlog.metadata.aeo_score}
                </span>
              )}
              {selectedBlog?.metadata?.word_count && (
                <span className="text-xs text-muted-foreground">
                  {selectedBlog.metadata.word_count} words
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {results.length > 1 && (
                <Select
                  value={String(results.findIndex(b => b === selectedBlog))}
                  onValueChange={(value) => setSelectedBlog(results[parseInt(value)])}
                >
                  <SelectTrigger className="w-48 h-8 text-xs bg-background border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {results.map((blog, idx) => (
                      <SelectItem key={idx} value={String(idx)} className="text-xs">
                        {blog.title || blog.keyword || `Blog ${idx + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedBlog && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyContent(selectedBlog)}
                    title="Copy content to clipboard"
                    className="text-foreground border border-foreground/20 hover:bg-foreground/10"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <div className="relative group">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Download className="h-4 w-4" />
                      Download
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <div className="absolute right-0 top-full mt-1 bg-popover border border-foreground/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[150px] py-1">
                      <button
                        onClick={() => handleExportTXT(selectedBlog)}
                        className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-foreground/10 flex items-center gap-2 transition-colors"
                      >
                        <File className="h-4 w-4" />
                        Text (.txt)
                      </button>
                      <button
                        onClick={() => handleExportHTML(selectedBlog)}
                        className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-foreground/10 flex items-center gap-2 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        HTML (.html)
                      </button>
                      <button
                        onClick={() => handleExportDOCX(selectedBlog)}
                        className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-foreground/10 flex items-center gap-2 transition-colors"
                      >
                        <FileType className="h-4 w-4" />
                        Word (.docx)
                      </button>
                      <button
                        onClick={() => handleExportPDF(selectedBlog)}
                        className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-foreground/10 flex items-center gap-2 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        PDF (.pdf)
                      </button>
                      <button
                        onClick={() => handleExportXLSX(selectedBlog)}
                        className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-foreground/10 flex items-center gap-2 transition-colors"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel (.xlsx)
                      </button>
                    </div>
                  </div>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground border border-foreground/20 hover:bg-foreground/10"
                onClick={() => {
                  const exportData = results.map(blog => ({
                    'Title': blog.title || blog.keyword || 'Generated Blog',
                    'Keyword': blog.keyword || 'N/A',
                    'Content': (blog.content || '').replace(/<[^>]*>/g, ''),
                    'Word Count': blog.metadata?.word_count || 'N/A',
                    'Generation Time': blog.metadata?.generation_time + 's' || 'N/A',
                    'AEO Score': blog.metadata?.aeo_score || 'N/A',
                    'Type': blog.type || 'single',
                    'Generated Date': new Date().toLocaleDateString(),
                  }))
                  const timestamp = new Date().toISOString().split('T')[0]
                  downloadXLSX(exportData, `aeo-blogs-${timestamp}.xlsx`, 'Blog Content')
                }}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Export All ({results.length})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setResults([])
                  setSelectedBlog(null)
                }}
                className="text-foreground border border-foreground/20 hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Blog content preview */}
          {(selectedBlog?.content || selectedBlog?.html_content) ? (
            <div className="flex-1 overflow-y-auto">
              <style jsx global>{`
                .blog-preview-content,
                .blog-preview-content * {
                  color: hsl(var(--foreground)) !important;
                  background-color: transparent !important;
                }
                .blog-preview-content h1,
                .blog-preview-content h2,
                .blog-preview-content h3,
                .blog-preview-content h4,
                .blog-preview-content h5,
                .blog-preview-content h6 {
                  color: hsl(var(--foreground)) !important;
                  font-weight: 600;
                  margin-top: 1.5em;
                  margin-bottom: 0.75em;
                }
                .blog-preview-content p {
                  color: hsl(var(--foreground)) !important;
                  line-height: 1.75;
                  margin-bottom: 1em;
                }
                .blog-preview-content strong,
                .blog-preview-content b {
                  color: hsl(var(--foreground)) !important;
                  font-weight: 600;
                }
                .blog-preview-content a {
                  color: hsl(var(--foreground)) !important;
                  text-decoration: underline;
                }
                .blog-preview-content ul,
                .blog-preview-content ol {
                  color: hsl(var(--foreground)) !important;
                  margin-bottom: 1em;
                  padding-left: 1.5em;
                }
                .blog-preview-content li {
                  color: hsl(var(--foreground)) !important;
                  margin-bottom: 0.5em;
                }
                .blog-preview-content blockquote {
                  border-left: 4px solid rgba(255, 255, 255, 0.2) !important;
                  padding-left: 1em !important;
                  margin: 1em 0 !important;
                  color: hsl(var(--foreground)) !important;
                  font-style: italic !important;
                  background: rgba(255, 255, 255, 0.05) !important;
                  padding: 1em !important;
                  border-radius: 0.5em !important;
                }
                .blog-preview-content blockquote * {
                  color: hsl(var(--foreground)) !important;
                  background: transparent !important;
                }
                .blog-preview-content img {
                  max-width: 100%;
                  height: auto;
                  border-radius: 0.5em;
                  margin: 1em 0;
                  display: none; /* Hide by default, show only when loaded */
                }
                .blog-preview-content img.loaded {
                  display: block;
                }
                .blog-preview-content img[src=""],
                .blog-preview-content img:not([src]),
                .blog-preview-content img[alt]:not([src]),
                .blog-preview-content img.error {
                  display: none !important;
                }
                .blog-preview-content table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 1em 0;
                }
                .blog-preview-content th,
                .blog-preview-content td {
                  border: 1px solid rgba(255, 255, 255, 0.1) !important;
                  padding: 0.5em 1em;
                  color: hsl(var(--foreground)) !important;
                }
                .blog-preview-content th {
                  background: rgba(255, 255, 255, 0.05) !important;
                  font-weight: 600;
                }
                .blog-preview-content code {
                  background: rgba(255, 255, 255, 0.05) !important;
                  padding: 0.2em 0.4em;
                  border-radius: 0.25em;
                  font-size: 0.9em;
                  color: hsl(var(--foreground)) !important;
                }
                .blog-preview-content pre {
                  background: rgba(255, 255, 255, 0.05) !important;
                  padding: 1em;
                  border-radius: 0.5em;
                  overflow-x: auto;
                }
                .blog-preview-content pre code {
                  background: transparent !important;
                  padding: 0;
                }
                .blog-preview-content div,
                .blog-preview-content section,
                .blog-preview-content article,
                .blog-preview-content span {
                  background-color: transparent !important;
                  color: hsl(var(--foreground)) !important;
                }
                .blog-preview-content hr {
                  border: none !important;
                  border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
                  margin: 1.5em 0 !important;
                  background: transparent !important;
                  background-color: transparent !important;
                  height: 0 !important;
                  color: transparent !important;
                }
                .blog-preview-content [style*="background"] {
                  background-color: transparent !important;
                  background: transparent !important;
                }
                .blog-preview-content [style*="color"] {
                  color: hsl(var(--foreground)) !important;
                }
                .blog-preview-content [style*="border"] {
                  border-color: rgba(255, 255, 255, 0.1) !important;
                }
              `}</style>
              <div 
                ref={contentPreviewRef}
                className="blog-preview-content max-w-none p-6"
                dangerouslySetInnerHTML={{ __html: sanitizeHtmlForTheme(selectedBlog.content || selectedBlog.html_content) }}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto opacity-40 mb-4" />
                <p>No content available for preview</p>
                <p className="text-xs mt-2 opacity-60">The blog may still be generating or encountered an error</p>
              </div>
            </div>
          )}

          {/* Blog list at bottom if multiple results */}
          {results.length > 1 && (
            <div className="flex-shrink-0 mt-4 pt-3 border-t border-border/30">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">All blogs:</span>
                {results.map((blog, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedBlog(blog)}
                    className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                      selectedBlog === blog 
                        ? 'bg-foreground/20 text-foreground shadow-sm' 
                        : 'bg-card/50 text-foreground/80 hover:bg-foreground/10'
                    }`}
                  >
                    {blog.keyword || `Blog ${idx + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="h-full flex relative bg-card">
      {/* Mobile/Tablet: Tabs layout */}
      {isMobileOrTablet && (
        <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
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
                {results.length > 0 && (
                  <span className="bg-foreground/20 text-foreground text-xs px-1.5 py-0.5 rounded-full">
                    {results.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="mt-0 flex-1 overflow-y-auto min-h-0">
              {inputPanel}
            </TabsContent>

            <TabsContent value="output" className="mt-0 flex-1 overflow-y-auto min-h-0">
              {outputPanel}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Desktop: Side-by-side panels */}
      {!isMobileOrTablet && (
        <>
          {/* Left Panel - Input Form (same width as KeywordGenerator: 420px) */}
          <div className="w-[420px] flex-shrink-0 border-r border-border bg-card">
            {inputPanel}
          </div>

          {/* Right Panel - Results Area */}
          {outputPanel}
        </>
      )}
    </div>
  )
}