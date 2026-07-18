'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Search, BookOpen, PenTool, CheckCircle, Zap, Info, AlertCircle } from 'lucide-react'

interface ActivityLogEntry {
  timestamp?: string
  type?: string
  message: string
  icon?: string
  source_data?: any
}

interface ActivityFeedProps {
  logs: ActivityLogEntry[]
  className?: string
}

// Map backend stage keys to specific, informative messages
const SPECIFIC_MESSAGES: Record<string, string> = {
  // Research phase
  'querying_sources': 'Searching academic databases...',
  'analyzing_website': 'Analyzing website content...',
  'fetching_data': 'Fetching data from sources...',
  'starting_research': 'Starting research...',
  'research_complete': 'Research phase complete',

  // Analysis phase
  'analyzing_keywords': 'Analyzing keyword potential...',
  'analyzing_content': 'Analyzing content...',
  'processing_data': 'Processing data...',

  // Writing phase
  'starting_composition': 'Beginning composition...',
  'writing_content': 'Writing content...',
  'generating_blog': 'Generating blog post...',
  'generating_keywords': 'Generating keywords...',
  'content_complete': 'Content complete',

  // Compile phase
  'assembling_results': 'Assembling results...',
  'formatting_output': 'Formatting output...',
  'compilation_complete': 'Compilation complete',

  // Export phase
  'preparing_export': 'Preparing export...',
  'export_complete': 'Export complete',
}

// Format message - use specific message if available, otherwise use raw message
function formatMessage(message: string, _log: ActivityLogEntry): string {
  // Check if the message matches a specific key
  const key = message.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '')
  if (SPECIFIC_MESSAGES[key]) {
    return SPECIFIC_MESSAGES[key]
  }

  // Check for count pattern and make it specific
  if (message.includes('keywords') || message.includes('found')) {
    const countMatch = message.match(/(\d+)/)
    if (countMatch) {
      return `Found ${countMatch[1]} results`
    }
  }

  // Return original message (but strip emojis for cleaner look)
  return message.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').replace(/[\u2600-\u27FF]/g, '').trim()
}

// Map emoji icons to Lucide icons
const getIcon = (type?: string, emoji?: string) => {
  // Map by type first
  if (type === 'search' || type === 'research') return <Search className="h-3.5 w-3.5" />
  if (type === 'found') return <BookOpen className="h-3.5 w-3.5" />
  if (type === 'writing') return <PenTool className="h-3.5 w-3.5" />
  if (type === 'milestone' || type === 'complete') return <CheckCircle className="h-3.5 w-3.5" />
  if (type === 'error') return <AlertCircle className="h-3.5 w-3.5" />

  // Map by emoji
  if (emoji?.includes('search') || emoji?.includes('magnify')) return <Search className="h-3.5 w-3.5" />
  if (emoji?.includes('book') || emoji?.includes('found') || emoji?.includes('discover')) return <BookOpen className="h-3.5 w-3.5" />
  if (emoji?.includes('write') || emoji?.includes('pen')) return <PenTool className="h-3.5 w-3.5" />
  if (emoji?.includes('check') || emoji?.includes('done') || emoji?.includes('complete')) return <CheckCircle className="h-3.5 w-3.5" />
  if (emoji?.includes('bolt') || emoji?.includes('fast') || emoji?.includes('zap')) return <Zap className="h-3.5 w-3.5" />

  return <Info className="h-3.5 w-3.5" />
}

const getIconColor = (type?: string) => {
  if (type === 'search' || type === 'research') return 'text-blue-500'
  if (type === 'found') return 'text-emerald-500'
  if (type === 'writing') return 'text-purple-500'
  if (type === 'milestone' || type === 'complete') return 'text-amber-500'
  if (type === 'error') return 'text-red-500'
  return 'text-muted-foreground'
}

export function ActivityFeed({ logs, className }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs.length])

  return (
    <div className={cn(
      "rounded-lg border bg-card/50 overflow-hidden flex flex-col",
      className
    )}>
      {/* Header - Clean, minimal */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-sm font-medium">Activity</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {logs.length} events
        </span>
      </div>

      {/* Scrollable log area - Light themed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-1 min-h-[200px] max-h-[300px] bg-muted/5 font-mono text-xs"
      >
        {logs.length === 0 ? (
          // Initialization sequence while waiting
          <div className="space-y-2">
            <LogEntry
              icon={<Zap className="h-3.5 w-3.5" />}
              iconColor="text-blue-500"
              message="Task queued successfully"
              timestamp={new Date().toISOString()}
              isNew={false}
            />
            <LogEntry
              icon={<Info className="h-3.5 w-3.5" />}
              iconColor="text-muted-foreground"
              message="Initializing AI engine..."
              timestamp={new Date().toISOString()}
              isNew={false}
            />
            <div className="flex items-center gap-2 py-1.5 text-muted-foreground">
              <Search className="h-3.5 w-3.5 text-amber-500" />
              <span className="animate-pulse">Connecting to services...</span>
              <span className="ml-auto cursor-blink">|</span>
            </div>
          </div>
        ) : (
          <>
            {logs.slice(-20).map((log, i) => (
              <LogEntry
                key={i}
                icon={getIcon(log.type, log.icon)}
                iconColor={getIconColor(log.type)}
                message={formatMessage(log.message, log)}
                timestamp={log.timestamp}
                isNew={i === logs.length - 1}
              />
            ))}
            {/* Blinking cursor at end */}
            <div className="flex items-center gap-2 py-1 text-muted-foreground">
              <span className="w-3.5" />
              <span className="cursor-blink">|</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface LogEntryProps {
  icon: React.ReactNode
  iconColor: string
  message: string
  timestamp?: string
  isNew: boolean
}

function LogEntry({ icon, iconColor, message, timestamp, isNew }: LogEntryProps) {
  const time = timestamp ? new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) : ''

  return (
    <div className={cn(
      "flex items-start gap-2 py-1.5 rounded px-1 -mx-1 transition-colors",
      isNew && "log-entry-new bg-primary/5"
    )}>
      <span className={cn("flex-shrink-0 mt-0.5", iconColor)}>
        {icon}
      </span>
      <span className="flex-1 text-foreground break-words">
        {message}
      </span>
      {time && (
        <span className="text-muted-foreground/60 text-[10px] flex-shrink-0 tabular-nums">
          {time}
        </span>
      )}
    </div>
  )
}
