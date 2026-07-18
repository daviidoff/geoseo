'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, RefreshCw, History } from 'lucide-react'

// Lazy load components for better performance
const BlogGeneratorBasic = dynamic(
  () => import('@/components/blogs/BlogGeneratorBasic'),
  {
    loading: () => <BlogSkeleton />,
    ssr: false,
  }
)

const BlogHistory = dynamic(
  () => import('@/components/blogs/BlogHistory'),
  {
    loading: () => <BlogSkeleton />,
    ssr: false,
  }
)

// Loading skeletons
function BlogSkeleton() {
  return (
    <div className="h-full flex">
      <div className="w-96 border-r border-border p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}

export default function BlogsPage() {
  const [activeTab, setActiveTab] = useState('generate')

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full border-none">
          <TabsList className="w-full justify-start rounded-none border-none h-12 bg-transparent p-0">
            <TabsTrigger
              value="generate"
              className="relative h-12 rounded-none border-b-0 data-[state=active]:border-b-2 data-[state=active]:border-foreground/50 data-[state=active]:bg-transparent px-4 flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Blog Gen</span>
              <span className="sm:hidden">Gen</span>
            </TabsTrigger>
            <TabsTrigger
              value="refresh"
              className="relative h-12 rounded-none border-b-0 data-[state=active]:border-b-2 data-[state=active]:border-foreground/50 data-[state=active]:bg-transparent px-4 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">Refresh</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="relative h-12 rounded-none border-b-0 data-[state=active]:border-b-2 data-[state=active]:border-foreground/50 data-[state=active]:bg-transparent px-4 flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
              <span className="sm:hidden">History</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto bg-card">
        {activeTab === 'history' ? (
          <BlogHistory />
        ) : (
          <BlogGeneratorBasic refreshMode={activeTab === 'refresh'} />
        )}
      </div>
    </div>
  )
}
