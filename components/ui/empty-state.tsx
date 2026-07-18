/**
 * EmptyState Component
 * 
 * Reusable empty state component following DRY, SOLID, and KISS principles.
 * Provides consistent empty state UI across the application.
 * 
 * Usage:
 * <EmptyState
 *   icon={FileText}
 *   title="No batches yet"
 *   description="Get started by processing your first CSV file"
 *   action={{ label: "Create Batch", onClick: () => router.push('/agents') }}
 * />
 */

import React, { ReactNode } from 'react'
import { LucideIcon, Search, X } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Icon to display (from lucide-react) */
  icon?: LucideIcon
  /** Emoji to display instead of icon */
  emoji?: string
  /** Main title text */
  title: string
  /** Description text below title */
  description?: string
  /** Optional action button */
  action?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline'
  }
  /** Optional secondary action button */
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  /** Optional clear filter action (for filtered/search empty states) */
  clearFilter?: {
    label: string
    onClick: () => void
  }
  /** Optional custom content */
  children?: ReactNode
  /** Additional className */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Variant type for different contexts */
  variant?: 'default' | 'search' | 'chart' | 'table' | 'filtered'
}

export function EmptyState({
  icon: Icon,
  emoji,
  title,
  description,
  action,
  secondaryAction,
  clearFilter,
  children,
  className,
  size = 'md',
  variant = 'default',
}: EmptyStateProps) {
  // Default icons for specific variants
  const defaultIcons = {
    search: Search,
    filtered: Search,
    chart: undefined,
    table: undefined,
    default: undefined,
  }
  
  const displayIcon = Icon || defaultIcons[variant]
  const iconSizes = {
    sm: 'h-10 w-10',
    md: 'h-16 w-16',
    lg: 'h-20 w-20',
  }

  const titleSizes = {
    sm: 'text-sm font-semibold',
    md: 'text-lg font-semibold',
    lg: 'text-xl font-bold',
  }

  const variantStyles = {
    default: '',
    search: 'py-8',
    chart: 'py-8',
    table: 'py-12',
    filtered: 'py-8',
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 text-center animate-fade-in',
        variantStyles[variant],
        variant === 'default' && 'py-12',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {emoji ? (
        <div className={cn('mb-6', size === 'sm' ? 'text-4xl' : size === 'md' ? 'text-5xl' : 'text-6xl')}>
          <span role="img" aria-hidden="true">{emoji}</span>
        </div>
      ) : displayIcon && (
        <div className={cn('text-muted-foreground mb-6 p-4 rounded-2xl bg-secondary/30 border border-border/50 shadow-sm', iconSizes[size])}>
          {React.createElement(displayIcon, { className: "h-full w-full opacity-50", "aria-hidden": "true" })}
        </div>
      )}
      
      <h3 className={cn('text-foreground mb-3', titleSizes[size])}>
        {title}
      </h3>

      {description && (
        <p className="text-sm text-muted-foreground mb-8 max-w-md leading-relaxed">
          {description}
        </p>
      )}
      
      {(action || secondaryAction || clearFilter) && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || 'default'}
              size={size === 'sm' ? 'default' : 'lg'}
              className="gap-2 sm:min-h-[44px]"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
              size={size === 'sm' ? 'default' : 'lg'}
              className="gap-2 sm:min-h-[44px]"
            >
              {secondaryAction.label}
            </Button>
          )}
          {clearFilter && (
            <Button
              onClick={clearFilter.onClick}
              variant="ghost"
              size={size === 'sm' ? 'default' : 'lg'}
              className="gap-2 sm:min-h-[44px]"
            >
              <X className="h-4 w-4" />
              {clearFilter.label}
            </Button>
          )}
        </div>
      )}
      
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

