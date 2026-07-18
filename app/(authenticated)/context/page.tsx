/**
 * Context page for analyzing company websites
 * Extract business context from domain analysis
 */

'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy load context form
const ContextForm = dynamic(
  () => import('@/components/context/ContextForm').then(mod => ({ default: mod.ContextForm })),
  {
    loading: () => (
      <div className="h-full flex flex-col">
        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-2 px-6 pt-4">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>

          {/* Form Fields */}
          <div className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    ),
    ssr: false,
  }
)

export default function ContextPage() {
  return <ContextForm />
}

