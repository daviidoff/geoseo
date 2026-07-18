/**
 * ABOUTME: Context provider for background jobs, enabling global job tracking.
 * ABOUTME: Share job state across all components without prop drilling.
 */

'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useBackgroundJobs, UseBackgroundJobsReturn } from '@/hooks/useBackgroundJobs'

const BackgroundJobsContext = createContext<UseBackgroundJobsReturn | null>(null)

interface BackgroundJobsProviderProps {
  children: ReactNode
}

export function BackgroundJobsProvider({ children }: BackgroundJobsProviderProps) {
  const backgroundJobs = useBackgroundJobs()

  return (
    <BackgroundJobsContext.Provider value={backgroundJobs}>
      {children}
    </BackgroundJobsContext.Provider>
  )
}

export function useBackgroundJobsContext(): UseBackgroundJobsReturn {
  const context = useContext(BackgroundJobsContext)
  if (!context) {
    throw new Error('useBackgroundJobsContext must be used within a BackgroundJobsProvider')
  }
  return context
}
