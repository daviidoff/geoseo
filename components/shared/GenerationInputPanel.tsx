/**
 * Shared Generation Input Panel Component
 * Provides consistent structure for both keyword and blog generators
 * Supports a sticky footer for action buttons
 */

'use client'

import { ReactNode, Children, isValidElement, cloneElement } from 'react'

interface GenerationInputPanelProps {
  title: string
  description: string
  children: ReactNode
  className?: string
}

export function GenerationInputPanel({ 
  title, 
  description, 
  children,
  className = ""
}: GenerationInputPanelProps) {
  // Separate sticky footer children from regular content
  const childArray = Children.toArray(children)
  const stickyFooter = childArray.find(
    (child) => isValidElement(child) && 
    typeof child.props?.className === 'string' && 
    child.props.className.includes('sticky')
  )
  const contentChildren = childArray.filter(
    (child) => !(isValidElement(child) && 
    typeof child.props?.className === 'string' && 
    child.props.className.includes('sticky'))
  )

  return (
    <div className={`h-full flex flex-col bg-card ${className}`}>
      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto p-6 pb-24">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-lg font-semibold mb-1 text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>

          {/* Content (excluding sticky footer) */}
          {contentChildren}
        </div>
      </div>

      {/* Sticky footer (if provided) */}
      {stickyFooter && isValidElement(stickyFooter) && cloneElement(stickyFooter, {
        className: "sticky bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border/50 shadow-lg"
      } as React.HTMLAttributes<HTMLElement>)}
    </div>
  )
}