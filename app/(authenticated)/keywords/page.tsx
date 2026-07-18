/**
 * ABOUTME: Keyword generation page with tabs for Generate and History
 */

'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, History } from 'lucide-react'

// Lazy load components for better performance
const KeywordGenerator = dynamic(
  () => import('@/components/keywords/KeywordGenerator').then(mod => ({ default: mod.KeywordGenerator })),
  {
    loading: () => <KeywordSkeleton />,
    ssr: false,
  }
)

const KeywordsHistory = dynamic(
  () => import('@/components/keywords/KeywordsHistory'),
  {
    loading: () => <KeywordSkeleton />,
    ssr: false,
  }
)

// Loading skeleton
function KeywordSkeleton() {
  return (
    <div className="h-full p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="border rounded-lg">
        <div className="grid grid-cols-6 gap-4 p-4 border-b bg-muted/50">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="grid grid-cols-6 gap-4 p-4 border-b">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function KeywordsPage() {
  const [activeTab, setActiveTab] = useState('generate')

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Tab Navigation */}
      <div className="flex-shrink-0 border-b border-border">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none h-12 bg-transparent p-0">
            <TabsTrigger
              value="generate"
              className="relative h-12 rounded-none bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 flex items-center gap-2 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Generate</span>
              <span className="sm:hidden">Gen</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="relative h-12 rounded-none bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 flex items-center gap-2 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
            >
              <History className="h-4 w-4" />
              <span>History</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'history' ? (
          <KeywordsHistory />
        ) : (
          <KeywordGenerator />
        )}
      </div>
    </div>
  )
}
