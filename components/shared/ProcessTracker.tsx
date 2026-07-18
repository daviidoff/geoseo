/**
 * Shared Process Tracker Component
 * Used by both Keywords and Blog generators for consistent UI
 */

import { useState, useEffect } from 'react'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface ProcessStage {
  name: string
  duration: number
  icon: string
  description: string
  color: string
  substeps?: string[]
}

interface ProcessTrackerProps {
  stages: Record<string, ProcessStage>
  currentStage: string
  progress: number
  logs: string[]
  isGenerating: boolean
  timeRemaining: number
  onToggleLogs?: () => void
  logsExpanded?: boolean
  title?: string
}

export function ProcessTracker({ 
  stages, 
  currentStage, 
  progress, 
  logs, 
  isGenerating, 
  timeRemaining, 
  onToggleLogs, 
  logsExpanded = true,
  title = "Generation Progress"
}: ProcessTrackerProps) {
  const [visibleStages, setVisibleStages] = useState<string[]>([])
  
  useEffect(() => {
    const stageKeys = Object.keys(stages)
    const currentIndex = stageKeys.indexOf(currentStage)
    
    if (currentIndex >= 0) {
      // Show current stage + next 2-3 stages for better UX
      const stagesToShow = stageKeys.slice(0, Math.min(currentIndex + 3, stageKeys.length))
      setVisibleStages(stagesToShow)
    }
  }, [currentStage, stages])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {isGenerating && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>ETA: {formatTime(timeRemaining)}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Overall Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stage Progress */}
      <div className="space-y-3">
        {visibleStages.map((stageKey) => {
          const stage = stages[stageKey]
          const isCurrent = stageKey === currentStage
          const isCompleted = Object.keys(stages).indexOf(stageKey) < Object.keys(stages).indexOf(currentStage)
          
          return (
            <div 
              key={stageKey}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                isCurrent 
                  ? 'bg-blue-50 border-blue-200' 
                  : isCompleted
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="text-xl">{stage.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${stage.color}`}>{stage.name}</span>
                  {isCurrent && (
                    <Badge variant="secondary" className="text-xs">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      Active
                    </Badge>
                  )}
                  {isCompleted && (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                      ✓ Done
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{stage.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Logs Section */}
      {logs.length > 0 && (
        <div className="border rounded-lg">
          <button
            onClick={onToggleLogs}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
          >
            <span className="font-medium text-gray-900">Generation Logs ({logs.length})</span>
            {logsExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          
          {logsExpanded && (
            <div className="border-t">
              <div className="max-h-64 overflow-y-auto p-3">
                <div className="space-y-1">
                  {logs.slice(-20).map((log, index) => (
                    <div key={index} className="text-xs font-mono text-gray-600 break-words">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}