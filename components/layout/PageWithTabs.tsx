/**
 * ABOUTME: Shared layout component for pages with tabs
 * ABOUTME: DRY - provides consistent breadcrumb + tabs layout across all pages
 * ABOUTME: Compact breadcrumb integrated into tabs header area
 */

'use client'

import { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface TabConfig {
  value: string
  label: string
  icon?: ReactNode
  content: ReactNode
}

interface PageWithTabsProps {
  /** Default tab value */
  defaultValue: string
  /** Tab configurations */
  tabs: TabConfig[]
  /** Max width container class (unused, kept for API compatibility) */
  maxWidth?: string
  /** Controlled value (for URL-based tab switching) */
  value?: string
  /** Callback when tab changes */
  onValueChange?: (value: string) => void
}

export function PageWithTabs({
  defaultValue,
  tabs,
  // maxWidth kept for API compatibility but not used in current layout
  maxWidth: _maxWidth,
  value,
  onValueChange,
}: PageWithTabsProps) {
  return (
    <div className="h-full flex flex-col">
      <Tabs
        defaultValue={defaultValue}
        value={value}
        onValueChange={onValueChange}
        className="h-full flex flex-col"
      >
        <div className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <TabsList className="w-full justify-start rounded-none border-b-0 h-12 bg-transparent p-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 flex items-center gap-2"
              >
                {tab.icon && <span className="[&_svg]:h-4 [&_svg]:w-4 flex-shrink-0">{tab.icon}</span>}
                <span className="whitespace-nowrap">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="flex-1 overflow-auto mt-0 p-6"
          >
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
