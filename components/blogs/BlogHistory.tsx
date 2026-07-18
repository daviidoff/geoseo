/**
 * ABOUTME: Blog History component - displays previously generated blogs from Supabase
 * ABOUTME: Allows viewing, exporting, and deleting blog history entries
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Download, 
  Trash2, 
  Clock, 
  FileText, 
  BarChart3, 
  Search, 
  X,
  ExternalLink,
  FileSpreadsheet,
  Eye,
  Copy,
  File,
  FileType,
  RefreshCw,
  ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelativeTime } from '@/lib/utils/date'
import { downloadXLSX } from '@/lib/export'
import { formatBlogAsTxt, formatBlogForPdf, formatBlogForDocx, htmlToPlainText } from '@/lib/blog-export'

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
  
  // Remove hr elements entirely
  sanitized = sanitized.replace(/<hr[^>]*\/?>/gi, '')
  
  return sanitized
}

interface BlogGeneration {
  id: string
  type: 'blog' | 'blog_batch' | 'refresh'
  created_at: string
  company: string
  url: string
  language?: string
  country?: string
  keyword?: string
  title?: string
  word_count?: number
  content?: string
  aeo_score?: number
  generation_time?: number
  // Batch-specific
  batch_id?: string
  total?: number
  successful?: number
  failed?: number
  results?: Array<{
    keyword: string
    title: string
    word_count: number
    aeo_score: number
    status: 'success' | 'failed'
  }>
}

export default function BlogHistory() {
  const [generations, setGenerations] = useState<BlogGeneration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBlog, setSelectedBlog] = useState<BlogGeneration | null>(null)

  // Fetch blog generations from Supabase
  const fetchGenerations = useCallback(async () => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/blog-generations?limit=100')
      const data = await response.json()
      
      setGenerations(data.generations || [])
    } catch (error) {
      console.error('[BlogHistory] Failed to fetch from API:', error)
      setGenerations([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGenerations()
  }, [fetchGenerations])

  const filteredGenerations = useMemo(() => {
    if (!searchQuery) return generations
    
    const query = searchQuery.toLowerCase()
    return generations.filter(gen => 
      gen.keyword?.toLowerCase().includes(query) ||
      gen.title?.toLowerCase().includes(query) ||
      gen.company?.toLowerCase().includes(query)
    )
  }, [generations, searchQuery])

  const handleClearAll = async () => {
    if (!confirm('Clear all blog history? This cannot be undone.')) return
    
    try {
      await fetch('/api/blog-generations?clear_all=true', {
        method: 'DELETE'
      })
      
      setGenerations([])
      setSelectedBlog(null)
      toast.success('Blog history cleared')
    } catch (error) {
      console.error('[BlogHistory] Failed to clear:', error)
      toast.error('Failed to clear history')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/blog-generations?id=${id}`, {
        method: 'DELETE'
      })
      
      setGenerations(prev => prev.filter(gen => gen.id !== id))
      if (selectedBlog?.id === id) {
        setSelectedBlog(null)
      }
      toast.success('Blog entry deleted')
    } catch (error) {
      console.error('[BlogHistory] Failed to delete:', error)
      toast.error('Failed to delete entry')
    }
  }

  const handleExportHTML = (gen: BlogGeneration) => {
    if (!gen.content) {
      toast.error('No content to export')
      return
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${gen.title || gen.keyword || 'Generated Blog'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1, h2, h3 { color: #333; }
    p { margin: 1em 0; }
  </style>
</head>
<body>
  ${gen.content}
  <footer style="margin-top: 2em; padding-top: 1em; border-top: 1px solid #eee; font-size: 0.9em; color: #666;">
    <p><em>Generated on ${new Date(gen.created_at).toLocaleDateString()} with AEO optimization</em></p>
  </footer>
</body>
</html>`

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const timestamp = new Date(gen.created_at).toISOString().split('T')[0]
    const title = (gen.title || gen.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    a.download = `aeo-blog-${title}-${timestamp}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Blog exported as HTML')
  }

  const handleExportXLSX = async (gen: BlogGeneration) => {
    try {
      const exportData = [{
        'Title': gen.title || gen.keyword || 'Generated Blog',
        'Keyword': gen.keyword || 'N/A',
        'Content': (gen.content || '').replace(/<[^>]*>/g, ''),
        'Word Count': gen.word_count || 'N/A',
        'AEO Score': gen.aeo_score || 'N/A',
        'Company': gen.company || 'N/A',
        'Generated Date': new Date(gen.created_at).toLocaleDateString(),
      }]
      
      const timestamp = new Date(gen.created_at).toISOString().split('T')[0]
      const title = (gen.title || gen.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      await downloadXLSX(exportData, `aeo-blog-${title}-${timestamp}.xlsx`, 'Blog Content')
      toast.success('Blog exported as XLSX')
    } catch (error) {
      toast.error('Failed to export XLSX')
    }
  }

  // Copy blog content to clipboard
  const handleCopyContent = async (gen: BlogGeneration) => {
    if (!gen.content) {
      toast.error('No content to copy')
      return
    }
    
    try {
      // Convert HTML to properly formatted plain text
      const plainText = htmlToPlainText(gen.content)
      await navigator.clipboard.writeText(plainText)
      toast.success('Content copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy content')
    }
  }

  // Export blog as TXT
  const handleExportTXT = (gen: BlogGeneration) => {
    if (!gen.content) {
      toast.error('No content to export')
      return
    }
    
    // Use proper HTML-to-text conversion
    const textContent = formatBlogAsTxt(gen)

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const timestamp = new Date(gen.created_at).toISOString().split('T')[0]
    const titleSlug = (gen.title || gen.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    a.download = `aeo-blog-${titleSlug}-${timestamp}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Blog exported as TXT')
  }

  // Export blog as PDF
  const handleExportPDF = async (gen: BlogGeneration) => {
    if (!gen.content) {
      toast.error('No content to export')
      return
    }
    
    try {
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
      const sections = formatBlogForPdf(gen)
      
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
      
      const timestamp = new Date(gen.created_at).toISOString().split('T')[0]
      const titleSlug = (gen.title || gen.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      doc.save(`aeo-blog-${titleSlug}-${timestamp}.pdf`)
      toast.success('Blog exported as PDF')
    } catch (error) {
      toast.error('Failed to export PDF')
    }
  }

  // Export blog as DOCX
  const handleExportDOCX = async (gen: BlogGeneration) => {
    if (!gen.content) {
      toast.error('No content to export')
      return
    }
    
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = await import('docx')
      const fileSaver = await import('file-saver')
      const saveAs = fileSaver.saveAs || fileSaver.default?.saveAs || fileSaver.default
      
      // Get structured content
      const sections = formatBlogForDocx(gen)
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
      const timestamp = new Date(gen.created_at).toISOString().split('T')[0]
      const titleSlug = (gen.title || gen.keyword || 'blog').replace(/[^a-z0-9]/gi, '-').toLowerCase()
      saveAs(blob, `aeo-blog-${titleSlug}-${timestamp}.docx`)
      toast.success('Blog exported as DOCX')
    } catch (error) {
      console.error('DOCX export error:', error)
      toast.error('Failed to export DOCX')
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
    <div className="h-full flex">
      {/* Left Panel - Blog List (fixed width like Blog Gen/Refresh) */}
      <div className="w-[420px] flex-shrink-0 border-r border-foreground/10 flex flex-col relative bg-card">
        <div className="relative p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Blog History</h2>
              <p className="text-xs text-muted-foreground">
                {generations.length} blog{generations.length !== 1 ? 's' : ''} generated
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={fetchGenerations}
                title="Refresh"
                className="h-8 w-8 p-0 text-foreground hover:bg-foreground/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              {generations.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-8 w-8 p-0 text-foreground hover:bg-foreground/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {generations.length > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search blogs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {generations.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-sm font-semibold mb-2 text-foreground">No blogs yet</h3>
              <p className="text-xs text-muted-foreground">
                Generated blogs will appear here
              </p>
            </div>
          ) : filteredGenerations.length === 0 ? (
            <div className="p-8 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-sm font-semibold mb-2 text-foreground">No matches</h3>
              <p className="text-xs text-muted-foreground">
                Try a different search term
              </p>
            </div>
          ) : (
            <div>
              {filteredGenerations.map((gen) => (
                <button
                  key={gen.id}
                  onClick={() => setSelectedBlog(gen)}
                  className={`w-full p-4 text-left transition-colors border-b border-border/30 ${
                    selectedBlog?.id === gen.id 
                      ? 'bg-accent/50 border-l-2 border-l-primary' 
                      : 'hover:bg-accent/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          gen.type === 'refresh' 
                            ? 'bg-amber-500/20 text-amber-400' 
                            : gen.type === 'blog_batch'
                            ? 'bg-violet-500/20 text-violet-400'
                            : 'bg-sky-500/20 text-sky-400'
                        }`}>
                          {gen.type === 'refresh' ? '🔄' : gen.type === 'blog_batch' ? '📚' : '✍️'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(gen.created_at)}
                        </span>
                      </div>
                      
                      <h3 className="text-sm font-medium truncate text-foreground">
                        {gen.title || gen.keyword || 'Untitled Blog'}
                      </h3>
                      
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        {gen.word_count && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {gen.word_count}
                          </span>
                        )}
                        {gen.aeo_score && typeof gen.aeo_score === 'number' && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <BarChart3 className="h-3 w-3" />
                            {Number(gen.aeo_score).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Blog Preview */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {selectedBlog ? (
          <>
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-4">
                <h2 className="text-lg font-semibold truncate text-foreground">
                  {selectedBlog.title || selectedBlog.keyword || 'Blog Preview'}
                </h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{selectedBlog.company}</span>
                  {selectedBlog.word_count && (
                    <span>{selectedBlog.word_count} words</span>
                  )}
                  {selectedBlog.aeo_score && typeof selectedBlog.aeo_score === 'number' && (
                    <span className="text-emerald-400 font-medium">
                      AEO: {Number(selectedBlog.aeo_score).toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(selectedBlog.id)}
                  className="text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content Preview */}
            <div className="flex-1 overflow-auto p-6">
              {selectedBlog.content ? (
                <div className="blog-history-content">
                  <style jsx global>{`
                    .blog-history-content,
                    .blog-history-content * {
                      color: hsl(var(--foreground)) !important;
                      background-color: transparent !important;
                    }
                    .blog-history-content h1,
                    .blog-history-content h2,
                    .blog-history-content h3,
                    .blog-history-content h4,
                    .blog-history-content h5,
                    .blog-history-content h6 {
                      color: hsl(var(--foreground)) !important;
                      font-weight: 600;
                      margin-top: 1.5em;
                      margin-bottom: 0.75em;
                    }
                    .blog-history-content p {
                      color: hsl(var(--foreground)) !important;
                      line-height: 1.75;
                      margin-bottom: 1em;
                    }
                    .blog-history-content strong,
                    .blog-history-content b {
                      color: hsl(var(--foreground)) !important;
                      font-weight: 600;
                    }
                    .blog-history-content a {
                      color: hsl(var(--foreground)) !important;
                      text-decoration: underline;
                    }
                    .blog-history-content ul,
                    .blog-history-content ol {
                      color: hsl(var(--foreground)) !important;
                      margin-bottom: 1em;
                      padding-left: 1.5em;
                    }
                    .blog-history-content li {
                      color: hsl(var(--foreground)) !important;
                      margin-bottom: 0.5em;
                    }
                    .blog-history-content blockquote {
                      border-left: 4px solid rgba(255, 255, 255, 0.2) !important;
                      padding-left: 1em !important;
                      margin: 1em 0 !important;
                      color: hsl(var(--foreground)) !important;
                      font-style: italic !important;
                      background: rgba(255, 255, 255, 0.05) !important;
                      padding: 1em !important;
                      border-radius: 0.5em !important;
                    }
                    .blog-history-content blockquote * {
                      color: hsl(var(--foreground)) !important;
                      background: transparent !important;
                    }
                    .blog-history-content img {
                      max-width: 100%;
                      height: auto;
                      border-radius: 0.5em;
                      margin: 1em 0;
                      display: none;
                    }
                    .blog-history-content img.loaded {
                      display: block;
                    }
                    .blog-history-content img[src=""],
                    .blog-history-content img:not([src]),
                    .blog-history-content img[alt]:not([src]),
                    .blog-history-content img.error {
                      display: none !important;
                    }
                    .blog-history-content table {
                      width: 100%;
                      border-collapse: collapse;
                      margin: 1em 0;
                    }
                    .blog-history-content th,
                    .blog-history-content td {
                      border: 1px solid rgba(255, 255, 255, 0.1) !important;
                      padding: 0.5em 1em;
                      color: hsl(var(--foreground)) !important;
                    }
                    .blog-history-content th {
                      background: rgba(255, 255, 255, 0.05) !important;
                      font-weight: 600;
                    }
                    .blog-history-content code {
                      background: rgba(255, 255, 255, 0.05) !important;
                      padding: 0.2em 0.4em;
                      border-radius: 0.25em;
                      font-size: 0.9em;
                      color: hsl(var(--foreground)) !important;
                    }
                    .blog-history-content pre {
                      background: rgba(255, 255, 255, 0.05) !important;
                      padding: 1em;
                      border-radius: 0.5em;
                      overflow-x: auto;
                    }
                    .blog-history-content pre code {
                      background: transparent !important;
                      padding: 0;
                    }
                    .blog-history-content hr {
                      display: none !important;
                    }
                    .blog-history-content div,
                    .blog-history-content section,
                    .blog-history-content article,
                    .blog-history-content span {
                      background-color: transparent !important;
                      color: hsl(var(--foreground)) !important;
                    }
                    .blog-history-content [style*="background"] {
                      background-color: transparent !important;
                      background: transparent !important;
                    }
                    .blog-history-content [style*="color"] {
                      color: hsl(var(--foreground)) !important;
                    }
                    .blog-history-content [style*="border"] {
                      border: none !important;
                    }
                    .blog-history-content [border] {
                      border: none !important;
                    }
                    .blog-history-content > div,
                    .blog-history-content > section,
                    .blog-history-content > article,
                    .blog-history-content > header,
                    .blog-history-content > footer {
                      border: none !important;
                    }
                    .blog-history-content *:not(blockquote) {
                      border-top: none !important;
                      border-bottom: none !important;
                      border-right: none !important;
                    }
                    .blog-history-content header,
                    .blog-history-content .header,
                    .blog-history-content [class*="header"],
                    .blog-history-content [class*="meta"],
                    .blog-history-content [class*="author"],
                    .blog-history-content [class*="date"] {
                      border: none !important;
                    }
                  `}</style>
                  <div 
                    className="max-w-none p-6"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtmlForTheme(selectedBlog.content) }}
                  />
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <FileText className="h-12 w-12 mx-auto opacity-40 mb-4" />
                  <p>No content preview available</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/5">
            <div className="text-center text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto opacity-30 mb-4" />
              <h3 className="text-sm font-medium mb-1 text-foreground/70">Select a blog to preview</h3>
              <p className="text-xs">Click on any blog from the list to see its content</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
