/**
 * ABOUTME: App preview section with animated demos of key features
 * ABOUTME: Tab-based showcase - Keyword Research, Blog Pipeline, Health Audit, Bulk Processing
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, FileText, Shield, Layers, Play, RotateCcw, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const features = [
  {
    id: 'keywords',
    label: 'Keyword Research',
    icon: Search,
    description: 'AI-optimized keywords with AEO scores and search intent',
  },
  {
    id: 'blog',
    label: 'Blog Pipeline',
    icon: FileText,
    description: '8-stage automated content generation workflow',
  },
  {
    id: 'health',
    label: 'Health Audit',
    icon: Shield,
    description: '29-point technical SEO and AEO health analysis',
  },
  {
    id: 'bulk',
    label: 'Bulk Processing',
    icon: Layers,
    description: 'Process hundreds of keywords or articles at once',
  },
] as const

type FeatureId = typeof features[number]['id']

// Demo data for animations
const keywordData = [
  { keyword: 'AI-powered B2B solutions', intent: 'Info', score: 95 },
  { keyword: 'Enterprise SaaS platform', intent: 'Trans', score: 92 },
  { keyword: 'Business automation tools', intent: 'Info', score: 88 },
  { keyword: 'Cloud workflow management', intent: 'Nav', score: 85 },
  { keyword: 'Digital transformation software', intent: 'Comm', score: 82 },
]

const blogStages = [
  { name: 'Research', status: 'complete' },
  { name: 'Outline', status: 'complete' },
  { name: 'Draft', status: 'complete' },
  { name: 'AEO Optimize', status: 'active' },
  { name: 'Citations', status: 'pending' },
  { name: 'Schema', status: 'pending' },
  { name: 'Review', status: 'pending' },
  { name: 'Publish', status: 'pending' },
]

const healthChecks = [
  { name: 'Meta title optimization', score: 100, status: 'pass' },
  { name: 'Schema markup present', score: 100, status: 'pass' },
  { name: 'FAQ schema implementation', score: 75, status: 'warn' },
  { name: 'Internal linking structure', score: 90, status: 'pass' },
  { name: 'Mobile responsiveness', score: 100, status: 'pass' },
]

const bulkResults = [
  { keyword: 'AI customer service', status: 'complete', articles: 3 },
  { keyword: 'Chatbot implementation', status: 'complete', articles: 2 },
  { keyword: 'Automation workflows', status: 'processing', articles: 0 },
  { keyword: 'ML integration guide', status: 'queued', articles: 0 },
]

export function AppPreviewSection() {
  const [activeFeature, setActiveFeature] = useState<FeatureId>('keywords')
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const hasAutoPlayed = useRef(false)

  // Auto-play when section comes into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAutoPlayed.current && !isPlaying) {
            hasAutoPlayed.current = true
            setTimeout(() => startDemo(), 500)
          }
        })
      },
      { threshold: 0.3 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [isPlaying])

  const startDemo = () => {
    if (isPlaying) return
    setIsPlaying(true)
    setProgress(0)

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsPlaying(false)
          return 100
        }
        return prev + 5
      })
    }, 150)
  }

  const resetDemo = () => {
    setProgress(0)
    setIsPlaying(false)
    hasAutoPlayed.current = false
  }

  const renderDemo = () => {
    switch (activeFeature) {
      case 'keywords':
        return <KeywordDemo progress={progress} />
      case 'blog':
        return <BlogDemo progress={progress} />
      case 'health':
        return <HealthDemo progress={progress} />
      case 'bulk':
        return <BulkDemo progress={progress} />
    }
  }

  return (
    <section ref={sectionRef} className="py-20 bg-secondary/20" id="app-preview">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            See GeoSEO in Action
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Powerful tools that help you dominate AI search. Watch how each feature works.
          </p>
        </div>

        {/* Feature tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <button
                key={feature.id}
                onClick={() => {
                  setActiveFeature(feature.id)
                  resetDemo()
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  activeFeature === feature.id
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-background text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{feature.label}</span>
              </button>
            )
          })}
        </div>

        {/* Feature description */}
        <p className="text-center text-sm text-muted-foreground mb-6">
          {features.find((f) => f.id === activeFeature)?.description}
        </p>

        {/* Demo container */}
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl border border-border bg-card shadow-xl overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-background/50 rounded-md px-3 py-1 text-xs text-muted-foreground">
                  internal.geoseo
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={isPlaying ? undefined : progress > 0 ? resetDemo : startDemo}
                  disabled={isPlaying}
                  className="h-7 text-xs"
                >
                  {isPlaying ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Running...
                    </>
                  ) : progress > 0 ? (
                    <>
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Replay
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 mr-1" />
                      Play Demo
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Demo content */}
            <div className="p-6 min-h-[350px] bg-background/50">
              {renderDemo()}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Individual demo components
function KeywordDemo({ progress }: { progress: number }) {
  const visibleRows = Math.floor((progress / 100) * keywordData.length)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">AEO Keyword Analysis</h3>
        {progress >= 100 && (
          <span className="text-xs text-green-500 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {keywordData.length} keywords analyzed
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2 text-muted-foreground font-medium">Keyword</th>
              <th className="text-left px-4 py-2 text-muted-foreground font-medium">Intent</th>
              <th className="text-left px-4 py-2 text-muted-foreground font-medium">AEO Score</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {keywordData.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  'border-b border-border/50 transition-all duration-300',
                  i < visibleRows ? 'opacity-100' : 'opacity-0'
                )}
              >
                <td className="px-4 py-2">{row.keyword}</td>
                <td className="px-4 py-2">
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded',
                      row.intent === 'Info' && 'bg-blue-500/10 text-blue-500',
                      row.intent === 'Trans' && 'bg-purple-500/10 text-purple-500',
                      row.intent === 'Nav' && 'bg-green-500/10 text-green-500',
                      row.intent === 'Comm' && 'bg-orange-500/10 text-orange-500'
                    )}
                  >
                    {row.intent}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="text-green-500 font-semibold">{row.score}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {progress < 100 && progress > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Analyzing keywords... {progress}%
        </div>
      )}
    </div>
  )
}

function BlogDemo({ progress }: { progress: number }) {
  const activeStage = Math.floor((progress / 100) * blogStages.length)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Blog Generation Pipeline</h3>
        {progress >= 100 && (
          <span className="text-xs text-green-500 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Article ready
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 bg-muted/10">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
          {blogStages.map((stage, i) => {
            const isComplete = i < activeStage
            const isActive = i === activeStage && progress < 100
            const isPending = i > activeStage

            return (
              <div key={stage.name} className="flex flex-col items-center min-w-[70px]">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                    isComplete && 'bg-green-500 text-white',
                    isActive && 'bg-purple-500 text-white animate-pulse',
                    isPending && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 text-center">
                  {stage.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {progress > 20 && (
        <div className="rounded-lg border border-border p-4 bg-background/50">
          <div className="text-xs text-muted-foreground mb-2">Preview:</div>
          <div className="text-sm text-foreground line-clamp-3">
            <span className="font-semibold">How AI is Transforming B2B Sales</span>
            <br />
            <span className="text-muted-foreground">
              Artificial intelligence is revolutionizing how businesses approach sales...
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function HealthDemo({ progress }: { progress: number }) {
  const visibleChecks = Math.floor((progress / 100) * healthChecks.length)
  const overallScore = progress >= 100 ? 93 : Math.floor(progress * 0.93)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">29-Point Health Audit</h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">{overallScore}</div>
          <div className="text-xs text-muted-foreground">Overall Score</div>
        </div>
      </div>

      <div className="space-y-2">
        {healthChecks.map((check, i) => (
          <div
            key={check.name}
            className={cn(
              'flex items-center justify-between rounded-lg border border-border p-3 transition-all duration-300',
              i < visibleChecks ? 'opacity-100' : 'opacity-0'
            )}
          >
            <div className="flex items-center gap-3">
              {check.status === 'pass' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              <span className="text-sm text-foreground">{check.name}</span>
            </div>
            <span
              className={cn(
                'text-sm font-medium',
                check.score >= 90 ? 'text-green-500' : 'text-yellow-500'
              )}
            >
              {check.score}%
            </span>
          </div>
        ))}
      </div>

      {progress < 100 && progress > 0 && (
        <div className="text-xs text-muted-foreground">
          Checking {Math.floor((progress / 100) * 29)} of 29 factors...
        </div>
      )}
    </div>
  )
}

function BulkDemo({ progress }: { progress: number }) {
  const processedCount = Math.floor((progress / 100) * bulkResults.length)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Bulk Keyword Processing</h3>
        <span className="text-xs text-muted-foreground">
          {processedCount} of {bulkResults.length} complete
        </span>
      </div>

      <div className="space-y-2">
        {bulkResults.map((item, i) => {
          const isComplete = i < processedCount
          const isProcessing = i === processedCount && progress < 100

          return (
            <div
              key={item.keyword}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3">
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : isProcessing ? (
                  <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-muted" />
                )}
                <span className="text-sm text-foreground">{item.keyword}</span>
              </div>
              <div className="text-right">
                {isComplete ? (
                  <span className="text-xs text-green-500">{item.articles || 3} articles</span>
                ) : isProcessing ? (
                  <span className="text-xs text-purple-500">Processing...</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Queued</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {progress >= 100 && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
          <span className="text-sm text-green-600">
            Batch complete! 8 articles generated from 4 keywords.
          </span>
        </div>
      )}
    </div>
  )
}
