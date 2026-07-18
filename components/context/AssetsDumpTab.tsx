'use client'

import { useCallback, useState, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Image, X, CheckCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'sonner'
import { useContextFiles, type ContextFile } from '@/hooks/useContextFiles'
import { useContextStorage, type ContextFileReference } from '@/hooks/useContextStorage'

const ACCEPTED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface AssetFile extends ContextFile {
  aiLabels?: string[]
  aiAnalysis?: string
  isAnalyzing?: boolean
}

// Image MIME types
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']

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

export function AssetsDumpTab() {
  const { files, uploadFile, deleteFile, isLoading } = useContextFiles()
  const { businessContext, updateContext } = useContextStorage()
  const [uploading, setUploading] = useState<string | null>(null)
  const [analyzingAssets, setAnalyzingAssets] = useState<Set<string>>(new Set())
  const [assetAnalysis, setAssetAnalysis] = useState<Record<string, { labels: string[], summary: string }>>({})

  // Filter to only image files
  const assets = useMemo(() => {
    return files
      .filter(file => IMAGE_TYPES.includes(file.type) || file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i))
      .map(file => ({
        ...file,
        aiLabels: assetAnalysis[file.id]?.labels,
        aiAnalysis: assetAnalysis[file.id]?.summary,
        isAnalyzing: analyzingAssets.has(file.id),
      })) as AssetFile[]
  }, [files, assetAnalysis, analyzingAssets])

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
            assets: [...(businessContext.assets || []), fileRef]
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
  }, [uploadFile, businessContext.assets, updateContext])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_IMAGE_TYPES,
    multiple: true,
    maxSize: MAX_FILE_SIZE,
  })

  const removeAsset = useCallback(async (assetId: string) => {
    try {
      await deleteFile(assetId)
      // Remove from context
      updateContext({
        assets: (businessContext.assets || []).filter(a => a.id !== assetId)
      })
      // Remove analysis data
      setAssetAnalysis(prev => {
        const next = { ...prev }
        delete next[assetId]
        return next
      })
      // deleteFile already shows success toast via useContextFiles
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to remove asset')
    }
  }, [deleteFile, businessContext.assets, updateContext])

  const analyzeAsset = useCallback(async (assetId: string) => {
    const asset = assets.find(a => a.id === assetId)
    if (!asset) return

    setAnalyzingAssets(prev => new Set(prev).add(assetId))

    try {
      const response = await fetch('/api/analyze-asset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetId,
          filePath: asset.path || asset.id, // Use path from ContextFile
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Analysis failed' }))
        throw new Error(error.error || 'Failed to analyze asset')
      }

      const { labels, summary, fullDescription } = await response.json()
      
      setAssetAnalysis(prev => ({
        ...prev,
        [assetId]: {
          labels: labels || [],
          summary: summary || ''
        }
      }))
      
      // Update context with analysis results and full description
      updateContext({
        assets: (businessContext.assets || []).map(a => 
          a.id === assetId 
            ? { 
                ...a, 
                aiLabels: labels || [], 
                aiAnalysis: summary || '',
                fullDescription: fullDescription || ''
              }
            : a
        )
      })
      
      toast.success('Asset analyzed successfully')
    } catch (error) {
      console.error('Analysis error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to analyze asset')
    } finally {
      setAnalyzingAssets(prev => {
        const next = new Set(prev)
        next.delete(assetId)
        return next
      })
    }
  }, [assets])

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-4">
        Upload images, graphs, and visual assets. They will be analyzed using AI and labeled for use in blog content creation.
      </div>

      {/* Dropzone - Always visible to allow multiple uploads */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/20'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">
          {isDragActive ? 'Drop images here' : 'Drag & drop images here'}
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          or click to browse • Max 10MB per file
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          JPG, PNG, GIF, WebP, SVG
        </p>
      </div>

      {/* Assets Grid */}
      {isLoading && assets.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-video bg-secondary/50 rounded animate-pulse" />
          ))}
        </div>
      ) : assets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group relative border border-border rounded-lg overflow-hidden bg-secondary/40 hover:bg-secondary/60 transition-colors"
            >
              {/* Image Preview */}
              <div className="aspect-video bg-muted relative overflow-hidden">
                {asset.url ? (
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                    onError={async (e) => {
                      // If URL fails, try to get public URL from Supabase
                      if (!asset.url?.startsWith('http')) {
                        try {
                          const response = await fetch(`/api/context-files/download?path=${encodeURIComponent(asset.path)}`)
                          if (response.ok) {
                            const blob = await response.blob()
                            const url = URL.createObjectURL(blob)
                            e.currentTarget.src = url
                          } else {
                            e.currentTarget.style.display = 'none'
                          }
                        } catch {
                          e.currentTarget.style.display = 'none'
                        }
                      } else {
                        e.currentTarget.style.display = 'none'
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    <Image className="h-8 w-8 opacity-50" />
                  </div>
                )}
                {asset.isAnalyzing && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <div className="text-center">
                      <Sparkles className="h-6 w-6 mx-auto mb-2 animate-pulse text-primary" />
                      <p className="text-xs text-muted-foreground">Analyzing...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Asset Info */}
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(asset.size)} • {formatUploadTime(asset.uploadedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {asset.aiLabels ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => analyzeAsset(asset.id)}
                        disabled={asset.isAnalyzing}
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Analyze with AI"
                      >
                        <Sparkles className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAsset(asset.id)}
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                      title="Remove asset"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* AI Labels */}
                {asset.aiLabels && asset.aiLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {asset.aiLabels.map((label, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* AI Analysis */}
                {asset.aiAnalysis && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {asset.aiAnalysis}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Image}
          title="No assets uploaded yet"
          description="Upload images, graphs, and visual assets to be analyzed and labeled for blog content creation."
          size="md"
        />
      )}
    </div>
  )
}

