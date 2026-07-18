/**
 * HISTORY Page - Shows execution history stored in Supabase
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Trash2, Clock, Globe, Flag, BarChart3, FileText, CheckCircle2, XCircle, AlertCircle, FileType, File, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { formatBlogAsTxt, formatBlogForPdf, formatBlogForDocx } from '@/lib/blog-export'
import { downloadXLSX } from '@/lib/export'

interface HealthResult {
  overall_score: number
  category_scores: {
    technical_seo: number
    structured_data: number
    ai_crawler_readiness: number
    authority_signals: number
  }
  checks: Array<{
    name: string
    status: 'pass' | 'fail' | 'warning'
    score: number
  }>
}

interface MentionsResult {
  company_name?: string
  companyName?: string
  total_mentions?: number
  mentions?: number
  visibility?: number
  band?: string
  platform_results?: Array<{
    platform: string
    found: boolean
    mentions: Array<{
      query: string
      mentioned: boolean
    }>
  }>
  platform_stats?: Record<string, {
    mentions: number
    quality_score: number
    responses: number
    errors: number
  }>
}

interface BlogBatchResult {
  keyword: string
  title: string
  word_count: number
  aeo_score: number
  status: 'success' | 'failed'
}

interface LogEntry {
  id: string
  type: 'context' | 'keywords' | 'blog' | 'refresh' | 'analytics' | 'blog_batch'
  created_at: string
  company: string | null
  url: string | null
  payload: any
}

const detailLabel = (key: string) => key
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/_/g, ' ')
  .replace(/^./, char => char.toUpperCase())

const detailValue = (value: unknown) => {
  if (Array.isArray(value)) return value.join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value ?? '')
}

const sanitizeHistoryHtml = (html: string) => {
  let sanitized = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*"[^"]*"/gi, '')
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*'[^']*'/gi, '')
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
  sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""')
  sanitized = sanitized.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
  sanitized = sanitized.replace(/<iframe[^>]*\/>/gi, '')
  sanitized = sanitized.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
  sanitized = sanitized.replace(/<!DOCTYPE[^>]*>/gi, '')
  sanitized = sanitized.replace(/<\/?html[^>]*>/gi, '')
  sanitized = sanitized.replace(/<\/?body[^>]*>/gi, '')
  sanitized = sanitized.replace(/\sstyle="[^"]*"/gi, '')
  sanitized = sanitized.replace(/\s(?:bgcolor|color|border)="[^"]*"/gi, '')
  return sanitized
}

function HistoryDetails({ log }: { log: LogEntry }) {
  const payload = log.payload || {}

  if (log.type === 'context') {
    const fields = [
      ['language', payload.language],
      ['country', payload.country],
      ['products', payload.products],
      ['competitors', payload.competitors],
      ['painPoints', payload.painPoints],
      ['useCases', payload.useCases],
    ].filter(([, value]) => value !== undefined && value !== null && value !== '')

    return fields.length > 0 ? (
      <dl className="grid gap-4 sm:grid-cols-2">
        {fields.map(([key, value]) => (
          <div key={String(key)} className="rounded-md border border-border/50 bg-background p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {detailLabel(String(key))}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{detailValue(value)}</dd>
          </div>
        ))}
      </dl>
    ) : <p className="text-sm text-muted-foreground">No context details were stored for this run.</p>
  }

  if (log.type === 'keywords') {
    const keywords = Array.isArray(payload.keywords) ? payload.keywords : []
    return keywords.length > 0 ? (
      <div className="max-h-[28rem] overflow-auto rounded-md border border-border/50 bg-background">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="p-3 font-medium">Keyword</th>
              <th className="p-3 font-medium">AEO type</th>
              <th className="p-3 font-medium">Intent</th>
              <th className="p-3 font-medium">Relevance</th>
              <th className="p-3 font-medium">Competition</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((keyword: any, index: number) => (
              <tr key={`${keyword.keyword || 'keyword'}-${index}`} className="border-t border-border/50">
                <td className="p-3 font-medium text-foreground">{keyword.keyword || '—'}</td>
                <td className="p-3 text-muted-foreground">{keyword.aeo_type || '—'}</td>
                <td className="p-3 text-muted-foreground">{keyword.search_intent || '—'}</td>
                <td className="p-3 text-muted-foreground">{keyword.relevance_score ?? '—'}</td>
                <td className="p-3 text-muted-foreground">{keyword.competition_level || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : <p className="text-sm text-muted-foreground">No keyword results were stored for this run.</p>
  }

  if (log.type === 'blog' || log.type === 'refresh') {
    const content = String(payload.content || '')
    const containsHtml = /<([a-z][\w-]*)\b[^>]*>/i.test(content)

    return content ? (
      <article className="max-h-[36rem] overflow-auto rounded-md border border-border/50 bg-background p-5">
        <h4 className="text-lg font-semibold">{payload.title || payload.keyword || 'Generated article'}</h4>
        {payload.keyword && <p className="mt-1 text-xs text-muted-foreground">Keyword: {payload.keyword}</p>}
        {containsHtml ? (
          <div
            className="mt-5 text-sm leading-7 text-foreground [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_td]:border [&_td]:border-border [&_td]:p-2 [&_img]:my-4 [&_img]:max-w-full"
            dangerouslySetInnerHTML={{ __html: sanitizeHistoryHtml(content) }}
          />
        ) : (
          <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">{content}</div>
        )}
      </article>
    ) : <p className="text-sm text-muted-foreground">No article content was stored for this run.</p>
  }

  if (log.type === 'blog_batch') {
    const results = Array.isArray(payload.results) ? payload.results : []
    return results.length > 0 ? (
      <div className="max-h-[28rem] overflow-auto rounded-md border border-border/50 bg-background">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="p-3 font-medium">Keyword</th>
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Words</th>
              <th className="p-3 font-medium">AEO score</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result: BlogBatchResult, index: number) => (
              <tr key={`${result.keyword || 'result'}-${index}`} className="border-t border-border/50">
                <td className="p-3 font-medium text-foreground">{result.keyword || '—'}</td>
                <td className="p-3 text-muted-foreground">{result.title || '—'}</td>
                <td className="p-3 text-muted-foreground">{result.word_count ?? '—'}</td>
                <td className="p-3 text-muted-foreground">{result.aeo_score ?? '—'}</td>
                <td className="p-3 text-muted-foreground">{result.status || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : <p className="text-sm text-muted-foreground">No batch results were stored for this run.</p>
  }

  if (log.type === 'analytics') {
    const health = payload.healthResult as HealthResult | undefined
    const mentions = payload.mentionsResult as MentionsResult | undefined
    const mentionCount = mentions?.total_mentions ?? mentions?.mentions ?? 0

    return (
      <div className="space-y-5">
        {health && (
          <section className="rounded-md border border-border/50 bg-background p-4">
            <h4 className="font-semibold">Website health: {health.overall_score}/100</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(health.category_scores || {}).map(([key, value]) => (
                <div key={key} className="rounded bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">{detailLabel(key)}</p>
                  <p className="mt-1 font-semibold">{value}/100</p>
                </div>
              ))}
            </div>
            {Array.isArray(health.checks) && health.checks.length > 0 && (
              <div className="mt-4 max-h-72 overflow-auto divide-y divide-border/50 border-t border-border/50">
                {health.checks.map((check, index) => (
                  <div key={`${check.name}-${index}`} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span>{check.name}</span>
                    <span className="text-muted-foreground">{check.status} · {check.score}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {mentions && (
          <section className="rounded-md border border-border/50 bg-background p-4">
            <h4 className="font-semibold">AI mentions: {mentionCount}</h4>
            {(mentions.visibility !== undefined || mentions.band) && (
              <p className="mt-1 text-sm text-muted-foreground">
                {mentions.visibility !== undefined ? `${mentions.visibility}% visibility` : ''}
                {mentions.visibility !== undefined && mentions.band ? ' · ' : ''}
                {mentions.band || ''}
              </p>
            )}
            {Array.isArray(mentions.platform_results) && mentions.platform_results.length > 0 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {mentions.platform_results.map((platform, index) => (
                  <div key={`${platform.platform}-${index}`} className="rounded bg-muted/60 p-3">
                    <p className="font-medium">{platform.platform}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {platform.found ? 'Mention found' : 'No mention found'}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {mentions.platform_stats && Object.keys(mentions.platform_stats).length > 0 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {Object.entries(mentions.platform_stats).map(([platform, stats]) => (
                  <div key={platform} className="rounded bg-muted/60 p-3">
                    <p className="font-medium">{platform}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {stats.mentions} mentions · {stats.responses} responses · quality {stats.quality_score}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {!health && !mentions && <p className="text-sm text-muted-foreground">No analytics details were stored for this run.</p>}
      </div>
    )
  }

  const fields = Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  return fields.length > 0 ? (
    <dl className="space-y-3">
      {fields.map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{detailLabel(key)}</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{detailValue(value)}</dd>
        </div>
      ))}
    </dl>
  ) : <p className="text-sm text-muted-foreground">No details were stored for this entry.</p>
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history?limit=50')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch history')
      setLogs(data.history || [])
    } catch (error) {
      console.error('[HISTORY] Failed to fetch:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to fetch history')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const handleClearAll = async () => {
    if (!confirm('Clear all history? This cannot be undone.')) return
    try {
      const deletions = await Promise.all(
        logs.map(log => fetch(`/api/history?id=${log.id}`, { method: 'DELETE' }))
      )
      const anyFailed = deletions.some(r => !r.ok)
      if (anyFailed) {
        toast.error('Some entries could not be deleted')
      } else {
        setLogs([])
        toast.success('History cleared')
      }
    } catch (error) {
      toast.error('Failed to clear history')
    }
  }

  const handleExport = (log: LogEntry) => {
    const payload = (log as any).payload || {}

    if (log.type === 'keywords' && payload.keywords && Array.isArray(payload.keywords) && payload.keywords.length > 0) {
      const csvContent = [
        ['Keyword', 'AEO Type', 'Intent', 'Relevance', 'AI Citation', 'Competition'].join(','),
        ...payload.keywords.map((k: any) => [
          `"${(k.keyword || '').replace(/"/g, '""')}"`,
          (k.aeo_type || '').replace(/"/g, '""'),
          (k.search_intent || '').replace(/"/g, '""'),
          k.relevance_score ?? '',
          (k.ai_citation_potential || '').replace(/"/g, '""'),
          (k.competition_level || '').replace(/"/g, '""')
        ].join(','))
      ].join('\n')
      
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const timestamp = new Date((log as any).timestamp || log.created_at).toISOString().split('T')[0]
      const companySlug = (log.company || 'company').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      a.download = `aeo-keywords-${companySlug}-${timestamp}-${payload.keywords.length}kw.csv`
      
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Keywords exported')
    } else if (log.type === 'blog' && payload.content) {
      const markdown = `# ${payload.title || payload.keyword}\n\n${payload.content}`
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const timestamp = new Date((log as any).timestamp || log.created_at).toISOString().split('T')[0]
      const keywordSlug = (payload.keyword || '').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      a.download = `blog-${keywordSlug}-${timestamp}.md`
      
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Blog exported as Markdown')
    } else if (log.type === 'analytics' && (payload.healthResult || payload.mentionsResult)) {
      // Export analytics results as JSON
      const analyticsData = {
        company: log.company,
        url: log.url,
        timestamp: (log as any).timestamp || log.created_at,
        health: payload.healthResult,
        mentions: payload.mentionsResult,
      }
      
      const jsonContent = JSON.stringify(analyticsData, null, 2)
      const blob = new Blob([jsonContent], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const timestamp = new Date((log as any).timestamp || log.created_at).toISOString().split('T')[0]
      const companySlug = (log.company || 'company').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      a.download = `aeo-analytics-${companySlug}-${timestamp}.json`
      
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Analytics exported')
    } else if (log.type === 'blog_batch' && payload.results && payload.results.length > 0) {
      // Export batch results as CSV
      const csvContent = [
        ['Keyword', 'Title', 'Word Count', 'AEO Score', 'Status'].join(','),
        ...payload.results.map((r: any) => [
          `"${(r.keyword || '').replace(/"/g, '""')}"`,
          `"${(r.title || '').replace(/"/g, '""')}"`,
          r.word_count ?? 0,
          r.aeo_score ? r.aeo_score.toFixed(1) : 'N/A',
          r.status || 'unknown'
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      const timestamp = new Date((log as any).timestamp || log.created_at).toISOString().split('T')[0]
      const companySlug = (log.company || 'company').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      a.download = `blog-batch-${companySlug}-${timestamp}.csv`

      a.click()
      URL.revokeObjectURL(url)
      toast.success('Blog batch exported')
    }
  }

  // Export keywords as XLSX
  const handleExportXLSX = (log: LogEntry) => {
    const payload = (log as any).payload || {}
    const keywords = payload.keywords

    if (!Array.isArray(keywords) || keywords.length === 0) {
      toast.error('No keywords to export')
      return
    }

    const data = keywords.map((k: any) => ({
      Keyword: k.keyword || '',
      'AEO Type': k.aeo_type || '',
      Intent: k.search_intent || '',
      Relevance: k.relevance_score ?? '',
      'AI Citation': k.ai_citation_potential || '',
      Competition: k.competition_level || ''
    }))

    const timestamp = new Date((log as any).timestamp || log.created_at).toISOString().split('T')[0]
    const companySlug = (log.company || 'company').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const filename = `aeo-keywords-${companySlug}-${timestamp}-${keywords.length}kw`

    downloadXLSX(data, filename)
    toast.success('Keywords exported as Excel')
  }

  // Export blog as TXT
  const handleExportTXT = (log: LogEntry) => {
    const payload = (log as any).payload || {}
    if (!payload.content) {
      toast.error('No blog content to export')
      return
    }

    const blog = {
      title: payload.title || payload.keyword || 'Generated Blog',
      keyword: payload.keyword,
      content: payload.content,
      metadata: { word_count: payload.wordCount || payload.word_count, aeo_score: payload.aeoScore || payload.aeo_score },
      created_at: (log as any).timestamp || log.created_at
    }

    const textContent = formatBlogAsTxt(blog)
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    const timestamp = new Date((log as any).timestamp || log.created_at).toISOString().split('T')[0]
    const titleSlug = (payload.title || payload.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    a.download = `aeo-blog-${titleSlug}-${timestamp}.txt`

    a.click()
    URL.revokeObjectURL(url)
    toast.success('Blog exported as TXT')
  }

  // Export blog as PDF
  const handleExportPDF = async (log: LogEntry) => {
    const payload = (log as any).payload || {}
    if (!payload.content) {
      toast.error('No blog content to export')
      return
    }

    try {
      const { jsPDF } = await import('jspdf')

      const blog = {
        title: payload.title || payload.keyword || 'Generated Blog',
        keyword: payload.keyword,
        content: payload.content,
        metadata: { word_count: payload.wordCount || payload.word_count, aeo_score: payload.aeoScore || payload.aeo_score },
        created_at: (log as any).timestamp || log.created_at
      }

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.width
      const pageHeight = doc.internal.pageSize.height
      const margin = 15
      const contentWidth = pageWidth - (margin * 2)
      let yPos = 20

      const checkPageBreak = (neededHeight: number) => {
        if (yPos + neededHeight > pageHeight - 25) {
          doc.addPage()
          yPos = 20
        }
      }

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
            yPos += 8
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
            yPos += 3
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
            doc.setFontSize(8)
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(150)
            doc.text(section.text, margin, pageHeight - 10)
            break
        }
      }

      const timestamp = new Date((log as any).timestamp || log.created_at).toISOString().split('T')[0]
      const titleSlug = (payload.title || payload.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      doc.save(`aeo-blog-${titleSlug}-${timestamp}.pdf`)

      toast.success('Blog exported as PDF')
    } catch (error) {
      toast.error('Failed to export PDF')
      console.error('PDF export error:', error)
    }
  }

  // Export blog as DOCX
  const handleExportDOCX = async (log: LogEntry) => {
    const payload = (log as any).payload || {}
    if (!payload.content) {
      toast.error('No blog content to export')
      return
    }

    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = await import('docx')
      const fileSaver = await import('file-saver')
      const saveAs = fileSaver.saveAs || (fileSaver as any).default?.saveAs || (fileSaver as any).default

      const blog = {
        title: payload.title || payload.keyword || 'Generated Blog',
        keyword: payload.keyword,
        content: payload.content,
        metadata: { word_count: payload.wordCount || payload.word_count, aeo_score: payload.aeoScore || payload.aeo_score },
        created_at: (log as any).timestamp || log.created_at
      }

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
                indent: { left: 360 },
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

      const docxDoc = new Document({
        sections: [{
          properties: {},
          children,
        }],
      })

      const blob = await Packer.toBlob(docxDoc)
      const timestamp = new Date((log as any).timestamp || log.created_at).toISOString().split('T')[0]
      const titleSlug = (payload.title || payload.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      saveAs(blob, `aeo-blog-${titleSlug}-${timestamp}.docx`)

      toast.success('Blog exported as DOCX')
    } catch (error) {
      toast.error('Failed to export DOCX')
      console.error('DOCX export error:', error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete entry')
      }
      setLogs(prev => prev.filter(log => log.id !== id))
      setExpandedLogId(current => current === id ? null : current)
      toast.success('Entry deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete entry')
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-current border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="container mx-auto max-w-5xl py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">History</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {logs.length} entr{logs.length !== 1 ? 'ies' : 'y'} stored (context, keywords, blogs, analytics)
              </p>
            </div>
            {logs.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>

          {/* Empty State */}
          {logs.length === 0 && (
            <div className="border border-border/40 rounded-lg p-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No history yet</h3>
              <p className="text-sm text-muted-foreground">
                Run keywords, blogs, or analytics to see history here
              </p>
            </div>
          )}

          {/* Log Entries */}
          <div className="space-y-4">
            {logs.map((log) => {
              const payload = (log as any).payload || {}
              const keywords = payload.keywords
              const keywordCount = Array.isArray(keywords) ? keywords.length : payload.total_keywords
              const keywordLanguage = payload.language || payload.lang || payload.languageCode
              const keywordCountry = payload.country || payload.region

              const blogContent = payload.content
              const blogKeyword = payload.keyword
              const blogTitle = payload.title
              const blogWordCount = payload.wordCount || payload.word_count
              const blogAeo = payload.aeoScore || payload.aeo_score
              const blogBatchResults = payload.results
              const blogBatchTotal = payload.total
              const blogBatchSuccess = payload.successful
              const blogBatchFailed = payload.failed

              const healthResult = payload.healthResult
              const mentionsResult = payload.mentionsResult

              const timestamp = (log as any).timestamp || (log as any).created_at
              const isExpanded = expandedLogId === log.id

              return (
                <div
                  key={log.id}
                  className="border border-border/40 rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      {/* Type Badge */}
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          {log.type === 'context' && '📁 Context'}
                          {log.type === 'keywords' && '🎯 Keywords'}
                          {log.type === 'blog' && '✍️ Blog'}
                          {log.type === 'blog_batch' && '📚 Blog Batch'}
                          {log.type === 'analytics' && '📊 Analytics'}
                          {log.type === 'refresh' && '🔄 Refresh'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {timestamp ? new Date(timestamp).toLocaleString() : ''}
                        </span>
                      </div>

                      {/* Company Info */}
                      <div>
                        <h3 className="font-semibold text-base">{log.company}</h3>
                        <a
                          href={log.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          {log.url}
                        </a>
                      </div>

                      {/* Type-specific Metadata */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {/* Keywords metadata */}
                        {log.type === 'keywords' && (
                          <>
                            {keywordCount && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium text-foreground">{keywordCount}</span> keywords
                              </span>
                            )}
                            {keywordLanguage && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {keywordLanguage}
                              </span>
                            )}
                            {keywordCountry && (
                              <span className="flex items-center gap-1">
                                <Flag className="h-3 w-3" />
                                {keywordCountry}
                              </span>
                            )}
                          </>
                        )}

                        {/* Blog metadata */}
                        {log.type === 'blog' && (
                          <>
                            {blogKeyword && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium text-foreground">"{blogKeyword}"</span>
                              </span>
                            )}
                            {blogWordCount && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                <span className="font-medium text-foreground">{blogWordCount}</span> words
                              </span>
                            )}
                            {blogAeo && typeof blogAeo === 'number' && (
                              <span className="flex items-center gap-1">
                                <BarChart3 className="h-3 w-3" />
                                AEO: <span className="font-medium text-foreground">{blogAeo.toFixed(1)}</span>
                              </span>
                            )}
                          </>
                        )}

                        {/* Blog batch metadata */}
                        {log.type === 'blog_batch' && (
                          <>
                            <span className="flex items-center gap-1">
                              Total: <span className="font-medium text-foreground">{blogBatchTotal ?? blogBatchResults?.length ?? 0}</span>
                            </span>
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3" />
                              {blogBatchSuccess ?? 0} succeeded
                            </span>
                            {blogBatchFailed && blogBatchFailed > 0 && (
                              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                <XCircle className="h-3 w-3" />
                                {blogBatchFailed} failed
                              </span>
                            )}
                          </>
                        )}

                        {/* Analytics metadata */}
                        {log.type === 'analytics' && (
                          <>
                            {healthResult && typeof healthResult.overall_score === 'number' && (
                              <span className="flex items-center gap-1">
                                <BarChart3 className="h-3 w-3" />
                                Health: <span className="font-medium text-foreground">{healthResult.overall_score.toFixed(1)}/100</span>
                              </span>
                            )}
                            {mentionsResult && (mentionsResult.total_mentions !== undefined || mentionsResult.mentions !== undefined) && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {(mentionsResult.total_mentions ?? mentionsResult.mentions) || 0} AI mentions
                              </span>
                            )}
                            {!healthResult && !mentionsResult && (
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <AlertCircle className="h-3 w-3" />
                                Partial results
                              </span>
                            )}
                          </>
                        )}

                        {/* Generation time (all types) */}
                        {payload.generationTime && typeof payload.generationTime === 'number' && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {payload.generationTime.toFixed(1)}s
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-expanded={isExpanded}
                        aria-controls={`history-details-${log.id}`}
                        onClick={() => setExpandedLogId(current => current === log.id ? null : log.id)}
                        className="flex items-center gap-1"
                      >
                        {isExpanded ? 'Hide details' : 'View details'}
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </Button>
                      {/* Keywords: dropdown with Excel and CSV */}
                      {log.type === 'keywords' && keywords && (
                        <div className="relative group">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                          >
                            <Download className="h-4 w-4" />
                            Download
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                          <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[140px] py-1">
                            <button
                              onClick={() => handleExportXLSX(log)}
                              className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                            >
                              <FileType className="h-4 w-4" />
                              Excel (.xlsx)
                            </button>
                            <button
                              onClick={() => handleExport(log)}
                              className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                            >
                              <FileText className="h-4 w-4" />
                              CSV (.csv)
                            </button>
                          </div>
                        </div>
                      )}
                      {/* Analytics and Blog Batch: single button */}
                      {((log.type === 'analytics' && (healthResult || mentionsResult)) ||
                        (log.type === 'blog_batch' && blogBatchResults)) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport(log)}
                          className="flex items-center gap-1"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      )}
                      {/* Blog: dropdown with multiple formats */}
                      {log.type === 'blog' && blogContent && (
                        <div className="relative group">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                          >
                            <Download className="h-4 w-4" />
                            Download
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                          <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[140px] py-1">
                            <button
                              onClick={() => handleExportTXT(log)}
                              className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                            >
                              <File className="h-4 w-4" />
                              Text (.txt)
                            </button>
                            <button
                              onClick={() => handleExport(log)}
                              className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                            >
                              <FileText className="h-4 w-4" />
                              Markdown (.md)
                            </button>
                            <button
                              onClick={() => handleExportDOCX(log)}
                              className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                            >
                              <FileType className="h-4 w-4" />
                              Word (.docx)
                            </button>
                            <button
                              onClick={() => handleExportPDF(log)}
                              className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                            >
                              <FileText className="h-4 w-4" />
                              PDF (.pdf)
                            </button>
                          </div>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(log.id)}
                        aria-label="Delete history entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div
                      id={`history-details-${log.id}`}
                      className="mt-4 border-t border-border/50 pt-4"
                    >
                      <HistoryDetails log={log} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
