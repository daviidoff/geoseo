'use client'

import { useCallback, useState, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X, CheckCircle, Sparkles, File } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'sonner'
import { useContextFiles, type ContextFile } from '@/hooks/useContextFiles'
import { useContextStorage, type ContextFileReference } from '@/hooks/useContextStorage'

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md', '.markdown'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface ResearchFile extends ContextFile {
  aiLabels?: string[]
  aiSummary?: string
  isAnalyzing?: boolean
}

// Research file MIME types
const RESEARCH_FILE_TYPES = ['application/pdf', 'text/plain', 'text/markdown', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

function getFileIcon(type: string) {
  if (type.includes('pdf')) return FileText
  return File
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatUploadTime(uploadedAt: string): string {
  const date = new Date(uploadedAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

export function ResearchDumpTab() {
  const { files: allFiles, uploadFile, deleteFile, isLoading } = useContextFiles()
  const { businessContext, updateContext } = useContextStorage()
  const [uploading, setUploading] = useState<string | null>(null)
  const [analyzingFiles, setAnalyzingFiles] = useState<Set<string>>(new Set())
  const [fileAnalysis, setFileAnalysis] = useState<Record<string, { labels: string[], summary: string }>>({})

  // Filter to only research files (PDF, text, markdown, doc)
  const files = useMemo(() => {
    return allFiles
      .filter(file => 
        RESEARCH_FILE_TYPES.includes(file.type) || 
        file.name.match(/\.(pdf|txt|md|markdown|doc|docx)$/i)
      )
      .map(file => ({
        ...file,
        aiLabels: fileAnalysis[file.id]?.labels,
        aiSummary: fileAnalysis[file.id]?.summary,
        isAnalyzing: analyzingFiles.has(file.id),
      })) as ResearchFile[]
  }, [allFiles, fileAnalysis, analyzingFiles])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 10MB limit`)
        continue
      }

      setUploading(file.name)
      
      try {
        const uploadedFile = await uploadFile(file, 'manual')
        // Save file reference to context
        if (uploadedFile) {
          // Ensure URL is set (for dev mode, upload endpoint should set it)
          let fileUrl = uploadedFile.url
          if (!fileUrl && process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
            // Fallback: construct URL if not set
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
            fileUrl = `${baseUrl}/api/context-files/download-local?path=${encodeURIComponent(uploadedFile.path)}`
          }
          
          const fileRef: ContextFileReference = {
            id: uploadedFile.id,
            name: uploadedFile.name,
            type: uploadedFile.type,
            path: uploadedFile.path,
            url: fileUrl,
            size: uploadedFile.size,
            uploadedAt: uploadedFile.uploadedAt,
          }
          updateContext({
            researchFiles: [...(businessContext.researchFiles || []), fileRef]
          })
        }
        // uploadFile already shows success toast via useContextFiles
      } catch (error) {
        console.error('Upload error:', error)
        toast.error(error instanceof Error ? error.message : `Failed to upload ${file.name}`)
      } finally {
        setUploading(null)
      }
    }
  }, [uploadFile, businessContext.researchFiles, updateContext])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    multiple: true,
    maxSize: MAX_FILE_SIZE,
  })

  const removeFile = useCallback(async (fileId: string) => {
    try {
      await deleteFile(fileId)
      // Remove from context
      updateContext({
        researchFiles: (businessContext.researchFiles || []).filter(f => f.id !== fileId)
      })
      // Remove analysis data
      setFileAnalysis(prev => {
        const next = { ...prev }
        delete next[fileId]
        return next
      })
      // deleteFile already shows success toast via useContextFiles
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to remove file')
    }
  }, [deleteFile, businessContext.researchFiles, updateContext])

  const analyzeFile = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return

    setAnalyzingFiles(prev => new Set(prev).add(fileId))

    try {
      const response = await fetch('/api/analyze-research-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          filePath: file.path || file.id, // Use path from ContextFile
          fileName: file.name,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Analysis failed' }))
        throw new Error(error.error || 'Failed to analyze file')
      }

      const { labels, summary, fullText } = await response.json()
      
      setFileAnalysis(prev => ({
        ...prev,
        [fileId]: {
          labels: labels || [],
          summary: summary || ''
        }
      }))
      
      // Update context with analysis results and full text content
      updateContext({
        researchFiles: (businessContext.researchFiles || []).map(f => 
          f.id === fileId 
            ? { 
                ...f, 
                aiLabels: labels || [], 
                aiAnalysis: summary || '',
                fullTextContent: fullText || ''
              }
            : f
        )
      })
      
      toast.success('File analyzed successfully')
    } catch (error) {
      console.error('Analysis error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to analyze file')
    } finally {
      setAnalyzingFiles(prev => {
        const next = new Set(prev)
        next.delete(fileId)
        return next
      })
    }
  }, [files])

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-4">
        Upload research documents, PDFs, and text files. They will be analyzed using AI and labeled for use in blog content creation.
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/20'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          or click to browse • Max 10MB per file
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          PDF, TXT, MD, DOC, DOCX
        </p>
      </div>

      {/* Files List */}
      {isLoading && files.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3 bg-secondary/50 border border-border rounded-lg animate-pulse">
              <div className="h-4 w-48 bg-muted rounded mb-2" />
              <div className="h-3 w-32 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file) => {
            const Icon = getFileIcon(file.type)
            const isFileUploading = uploading === file.name

            return (
              <div
                key={file.id}
                className="group p-3 bg-secondary/40 border border-border rounded-lg hover:bg-secondary/60 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-medium truncate">{file.name}</p>
                      {file.isAnalyzing && (
                        <Sparkles className="h-3 w-3 animate-pulse text-primary" />
                      )}
                      {file.aiLabels && (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {formatFileSize(file.size)} • {file.type || 'Unknown type'} • {formatUploadTime(file.uploadedAt)}
                    </p>

                    {/* AI Labels */}
                    {file.aiLabels && file.aiLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {file.aiLabels.map((label, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* AI Summary */}
                    {file.aiSummary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {file.aiSummary}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isFileUploading ? (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                    ) : (
                      <>
                        {!file.aiLabels && !file.isAnalyzing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => analyzeFile(file.id)}
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
                            title="Analyze with AI"
                          >
                            <Sparkles className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                          title="Remove file"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No research files uploaded yet"
          description="Upload PDFs, text files, and research documents to be analyzed and labeled for blog content creation."
          size="md"
        />
      )}
    </div>
  )
}

