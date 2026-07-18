'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Activity, Target, History } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy load components
const HealthCheckPanel = dynamic(
  () => import('@/components/aeo/HealthCheckPanel').then(mod => ({ default: mod.HealthCheckPanel })),
  {
    loading: () => <AnalyticsSkeleton />,
    ssr: false,
  }
)

const MentionsCheckGenerator = dynamic(
  () => import('@/components/aeo/MentionsCheckGenerator').then(mod => ({ default: mod.MentionsCheckGenerator })),
  {
    loading: () => <AnalyticsSkeleton />,
    ssr: false,
  }
)

const AnalyticsHistory = dynamic(
  () => import('@/components/aeo/AnalyticsHistory'),
  {
    loading: () => <AnalyticsSkeleton />,
    ssr: false,
  }
)

function AnalyticsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  )
}

/**
 * ABOUTME: Unified Analytics Page - AEO Health Check + Mentions Check + History
 * ABOUTME: Standalone tools that work without business context requirement
 */
export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('health')

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full border-none">
          <TabsList className="w-full justify-start rounded-none border-none h-12 bg-transparent p-0">
            <TabsTrigger
              value="health"
              className="relative h-12 rounded-none border-b-0 data-[state=active]:border-b-2 data-[state=active]:border-foreground/50 data-[state=active]:bg-transparent px-4 flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Health Check</span>
              <span className="sm:hidden">Health</span>
            </TabsTrigger>
            <TabsTrigger
              value="mentions"
              className="relative h-12 rounded-none border-b-0 data-[state=active]:border-b-2 data-[state=active]:border-foreground/50 data-[state=active]:bg-transparent px-4 flex items-center gap-2"
            >
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Mentions Check</span>
              <span className="sm:hidden">Mentions</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="relative h-12 rounded-none border-b-0 data-[state=active]:border-b-2 data-[state=active]:border-foreground/50 data-[state=active]:bg-transparent px-4 flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              <span>History</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto bg-card">
        {activeTab === 'health' && <HealthCheckPanel />}
        {activeTab === 'mentions' && <MentionsCheckGenerator />}
        {activeTab === 'history' && <AnalyticsHistory />}
      </div>
    </div>
  )
}
