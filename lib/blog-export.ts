// ABOUTME: Blog export utilities for converting HTML content to various formats
// ABOUTME: Uses cheerio for proper HTML parsing to create well-formatted TXT, PDF, and DOCX exports

import * as cheerio from 'cheerio'
import type { Element, Text, AnyNode } from 'domhandler'

/**
 * Parsed content block for structured document generation
 */
export interface ContentBlock {
  type: 'heading' | 'paragraph' | 'list' | 'blockquote' | 'code' | 'table' | 'image' | 'hr'
  level?: number // For headings (1-6)
  text: string
  items?: string[] // For lists
  ordered?: boolean // For lists
  rows?: string[][] // For tables
  alt?: string // For images
  src?: string // For images
}

/**
 * Parse HTML content into structured blocks for document generation
 */
export function parseHtmlToBlocks(html: string): ContentBlock[] {
  const $ = cheerio.load(html)
  const blocks: ContentBlock[] = []
  
  // Remove script and style tags
  $('script, style, noscript').remove()
  
  // Process body content or root - use body if available, otherwise work with root's children directly
  const hasBody = $('body').length > 0
  const container = hasBody ? $('body') : $('html').length ? $('html') : null

  // Process each top-level element
  const elementsToProcess = container ? container.children() : $.root().children()
  elementsToProcess.each((_, elem) => {
    const block = processElement($, elem as AnyNode)
    if (block) {
      if (Array.isArray(block)) {
        blocks.push(...block)
      } else {
        blocks.push(block)
      }
    }
  })
  
  return blocks
}

function processElement($: cheerio.CheerioAPI, elem: AnyNode): ContentBlock | ContentBlock[] | null {
  const tagName = (elem as Element).tagName?.toLowerCase()
  
  if (!tagName) return null
  
  // Skip certain elements
  if (['script', 'style', 'noscript', 'nav', 'header', 'footer'].includes(tagName)) {
    return null
  }
  
  // Headings
  if (/^h[1-6]$/.test(tagName)) {
    const level = parseInt(tagName[1])
    const text = getTextContent($, elem)
    if (text.trim()) {
      return { type: 'heading', level, text: text.trim() }
    }
    return null
  }
  
  // Paragraphs
  if (tagName === 'p') {
    const text = getTextContent($, elem)
    if (text.trim()) {
      return { type: 'paragraph', text: text.trim() }
    }
    return null
  }
  
  // Lists
  if (tagName === 'ul' || tagName === 'ol') {
    const items: string[] = []
    $(elem).children('li').each((_, li) => {
      const text = getTextContent($, li)
      if (text.trim()) {
        items.push(text.trim())
      }
    })
    if (items.length > 0) {
      return { type: 'list', items, ordered: tagName === 'ol', text: '' }
    }
    return null
  }
  
  // Blockquotes
  if (tagName === 'blockquote') {
    const text = getTextContent($, elem)
    if (text.trim()) {
      return { type: 'blockquote', text: text.trim() }
    }
    return null
  }
  
  // Code blocks
  if (tagName === 'pre') {
    const code = $(elem).find('code').text() || $(elem).text()
    if (code.trim()) {
      return { type: 'code', text: code.trim() }
    }
    return null
  }
  
  // Tables
  if (tagName === 'table') {
    const rows: string[][] = []
    $(elem).find('tr').each((_, tr) => {
      const cells: string[] = []
      $(tr).find('th, td').each((_, cell) => {
        cells.push(getTextContent($, cell).trim())
      })
      if (cells.length > 0) {
        rows.push(cells)
      }
    })
    if (rows.length > 0) {
      return { type: 'table', rows, text: '' }
    }
    return null
  }
  
  // Images
  if (tagName === 'img') {
    const src = $(elem).attr('src') || ''
    const alt = $(elem).attr('alt') || ''
    if (src || alt) {
      return { type: 'image', src, alt, text: alt }
    }
    return null
  }
  
  // Horizontal rule
  if (tagName === 'hr') {
    return { type: 'hr', text: '' }
  }
  
  // Divs, articles, sections - recurse into children
  if (['div', 'article', 'section', 'main', 'aside'].includes(tagName)) {
    const blocks: ContentBlock[] = []
    $(elem).children().each((_, child) => {
      const block = processElement($, child)
      if (block) {
        if (Array.isArray(block)) {
          blocks.push(...block)
        } else {
          blocks.push(block)
        }
      }
    })
    return blocks.length > 0 ? blocks : null
  }
  
  // For other elements, try to get text content as paragraph
  const text = getTextContent($, elem)
  if (text.trim()) {
    return { type: 'paragraph', text: text.trim() }
  }
  
  return null
}

/**
 * Get text content from element, handling inline formatting
 */
function getTextContent($: cheerio.CheerioAPI, elem: AnyNode): string {
  let text = ''

  $(elem).contents().each((_, node) => {
    if (node.type === 'text') {
      text += (node as Text).data || ''
    } else if (node.type === 'tag') {
      const tagName = (node as Element).tagName?.toLowerCase()
      
      // Handle inline elements - preserve text, maybe add markers
      if (['strong', 'b', 'em', 'i', 'u', 'span', 'a', 'code', 'mark', 'small', 'sub', 'sup'].includes(tagName || '')) {
        text += getTextContent($, node)
      } else if (tagName === 'br') {
        text += '\n'
      } else {
        // For other elements, add their text content with spacing
        const innerText = getTextContent($, node)
        if (innerText.trim()) {
          text += ' ' + innerText + ' '
        }
      }
    }
  })
  
  // Clean up whitespace
  return text.replace(/\s+/g, ' ')
}

/**
 * Convert HTML to plain text with proper formatting
 * Suitable for TXT export and clipboard copy
 */
export function htmlToPlainText(html: string): string {
  const blocks = parseHtmlToBlocks(html)
  const lines: string[] = []
  
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        // Add blank line before headings (except first)
        if (lines.length > 0) lines.push('')
        lines.push(block.text)
        // Underline for h1/h2
        if (block.level === 1) {
          lines.push('='.repeat(Math.min(block.text.length, 80)))
        } else if (block.level === 2) {
          lines.push('-'.repeat(Math.min(block.text.length, 80)))
        }
        lines.push('')
        break
        
      case 'paragraph':
        lines.push(block.text)
        lines.push('')
        break
        
      case 'list':
        for (let i = 0; i < (block.items?.length || 0); i++) {
          const prefix = block.ordered ? `${i + 1}. ` : '• '
          lines.push(prefix + (block.items?.[i] || ''))
        }
        lines.push('')
        break
        
      case 'blockquote':
        // Indent blockquotes with >
        const quoteLines = block.text.split('\n')
        for (const line of quoteLines) {
          lines.push('> ' + line)
        }
        lines.push('')
        break
        
      case 'code':
        lines.push('```')
        lines.push(block.text)
        lines.push('```')
        lines.push('')
        break
        
      case 'table':
        if (block.rows && block.rows.length > 0) {
          // Calculate column widths
          const colWidths: number[] = []
          for (const row of block.rows) {
            for (let i = 0; i < row.length; i++) {
              colWidths[i] = Math.max(colWidths[i] || 0, row[i].length)
            }
          }
          
          // Print table
          for (let rowIdx = 0; rowIdx < block.rows.length; rowIdx++) {
            const row = block.rows[rowIdx]
            const cells = row.map((cell, i) => cell.padEnd(colWidths[i]))
            lines.push('| ' + cells.join(' | ') + ' |')
            
            // Add separator after header row
            if (rowIdx === 0) {
              const sep = colWidths.map(w => '-'.repeat(w))
              lines.push('| ' + sep.join(' | ') + ' |')
            }
          }
          lines.push('')
        }
        break
        
      case 'image':
        if (block.alt) {
          lines.push(`[Image: ${block.alt}]`)
          lines.push('')
        }
        break
        
      case 'hr':
        lines.push('---')
        lines.push('')
        break
    }
  }
  
  // Clean up multiple blank lines
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Export blog as formatted TXT file
 */
export function formatBlogAsTxt(blog: {
  title?: string
  keyword?: string
  content?: string
  metadata?: { word_count?: number; aeo_score?: number }
  word_count?: number
  aeo_score?: number
  created_at?: string
}): string {
  const title = blog.title || blog.keyword || 'Generated Blog'
  const wordCount = blog.metadata?.word_count || blog.word_count || 'N/A'
  const aeoScore = blog.metadata?.aeo_score || blog.aeo_score || 'N/A'
  const date = blog.created_at 
    ? new Date(blog.created_at).toLocaleDateString()
    : new Date().toLocaleDateString()
  
  // Convert HTML content to plain text
  const plainText = blog.content ? htmlToPlainText(blog.content) : ''
  
  return `${title}
${'='.repeat(Math.min(title.length, 80))}

${plainText}

---
Generated on ${date} with AEO optimization
Word Count: ${wordCount}
AEO Score: ${aeoScore}`
}

/**
 * Generate PDF document content with proper formatting
 * Returns configuration for jsPDF
 */
export interface PdfSection {
  type: 'title' | 'heading' | 'paragraph' | 'list' | 'blockquote' | 'code' | 'hr' | 'footer'
  text: string
  level?: number
  items?: string[]
  ordered?: boolean
}

export function formatBlogForPdf(blog: {
  title?: string
  keyword?: string
  content?: string
  metadata?: { word_count?: number; aeo_score?: number }
  word_count?: number
  aeo_score?: number
  created_at?: string
}): PdfSection[] {
  const sections: PdfSection[] = []
  const title = blog.title || blog.keyword || 'Generated Blog'
  const wordCount = blog.metadata?.word_count || blog.word_count || 'N/A'
  const aeoScore = blog.metadata?.aeo_score || blog.aeo_score || 'N/A'
  const date = blog.created_at 
    ? new Date(blog.created_at).toLocaleDateString()
    : new Date().toLocaleDateString()
  
  // Title
  sections.push({ type: 'title', text: title })
  
  // Metadata
  sections.push({ 
    type: 'paragraph', 
    text: `Word Count: ${wordCount} | AEO Score: ${aeoScore}` 
  })
  
  sections.push({ type: 'hr', text: '' })
  
  // Content blocks
  if (blog.content) {
    const blocks = parseHtmlToBlocks(blog.content)
    
    for (const block of blocks) {
      switch (block.type) {
        case 'heading':
          sections.push({ type: 'heading', text: block.text, level: block.level })
          break
        case 'paragraph':
          sections.push({ type: 'paragraph', text: block.text })
          break
        case 'list':
          sections.push({ type: 'list', text: '', items: block.items, ordered: block.ordered })
          break
        case 'blockquote':
          sections.push({ type: 'blockquote', text: block.text })
          break
        case 'code':
          sections.push({ type: 'code', text: block.text })
          break
        case 'hr':
          sections.push({ type: 'hr', text: '' })
          break
        default:
          if (block.text) {
            sections.push({ type: 'paragraph', text: block.text })
          }
      }
    }
  }
  
  // Footer
  sections.push({ type: 'footer', text: `Generated on ${date} with AEO optimization` })
  
  return sections
}

/**
 * Generate DOCX document content structure
 * Returns configuration for docx library
 */
export interface DocxSection {
  type: 'title' | 'heading' | 'paragraph' | 'list' | 'blockquote' | 'code' | 'footer'
  text: string
  level?: number
  items?: string[]
  ordered?: boolean
}

export function formatBlogForDocx(blog: {
  title?: string
  keyword?: string
  content?: string
  metadata?: { word_count?: number; aeo_score?: number }
  word_count?: number
  aeo_score?: number
  created_at?: string
}): DocxSection[] {
  const sections: DocxSection[] = []
  const title = blog.title || blog.keyword || 'Generated Blog'
  const wordCount = blog.metadata?.word_count || blog.word_count || 'N/A'
  const aeoScore = blog.metadata?.aeo_score || blog.aeo_score || 'N/A'
  const date = blog.created_at 
    ? new Date(blog.created_at).toLocaleDateString()
    : new Date().toLocaleDateString()
  
  // Title
  sections.push({ type: 'title', text: title })
  
  // Metadata
  sections.push({ 
    type: 'paragraph', 
    text: `Word Count: ${wordCount} | AEO Score: ${aeoScore}` 
  })
  
  // Content blocks
  if (blog.content) {
    const blocks = parseHtmlToBlocks(blog.content)
    
    for (const block of blocks) {
      switch (block.type) {
        case 'heading':
          sections.push({ type: 'heading', text: block.text, level: block.level })
          break
        case 'paragraph':
          sections.push({ type: 'paragraph', text: block.text })
          break
        case 'list':
          sections.push({ type: 'list', text: '', items: block.items, ordered: block.ordered })
          break
        case 'blockquote':
          sections.push({ type: 'blockquote', text: block.text })
          break
        case 'code':
          sections.push({ type: 'code', text: block.text })
          break
        default:
          if (block.text) {
            sections.push({ type: 'paragraph', text: block.text })
          }
      }
    }
  }
  
  // Footer
  sections.push({ type: 'footer', text: `Generated on ${date} with AEO optimization` })
  
  return sections
}
