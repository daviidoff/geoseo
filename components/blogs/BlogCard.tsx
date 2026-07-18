'use client'

import { memo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  MoreHorizontal,
  FileText,
  Download,
  RefreshCw,
  Trash2,
  Eye,
  Copy,
  ExternalLink,
  Clock,
  BarChart3,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { BlogListItem, BlogStatus, BlogContentType } from '@/lib/types/blogs'

/**
 * Status badge styling
 */
const STATUS_STYLES: Record<BlogStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  generating: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  published: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

/**
 * Content type badge styling
 */
const CONTENT_TYPE_STYLES: Record<BlogContentType, string> = {
  single: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  batch: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  refresh: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

/**
 * Get AEO score color based on value
 */
function getAeoScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-blue-600 dark:text-blue-400'
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

interface BlogCardProps {
  blog: BlogListItem
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
  onView?: () => void
  onEdit?: () => void
  onRefresh?: () => void
  onExport?: (format: 'html' | 'docx' | 'pdf') => void
  onCopy?: () => void
  onDelete?: () => void
  viewMode?: 'grid' | 'list'
}

/**
 * BlogCard Component
 *
 * Displays a single blog item in either grid or list view.
 * Includes actions for viewing, editing, exporting, and deleting.
 */
function BlogCardComponent({
  blog,
  isSelected = false,
  onSelect,
  onView,
  onEdit,
  onRefresh,
  onExport,
  onCopy,
  onDelete,
  viewMode = 'list',
}: BlogCardProps) {
  const isGridView = viewMode === 'grid'

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-200',
        'hover:shadow-md hover:border-primary/50',
        isSelected && 'ring-2 ring-primary ring-offset-2',
        isGridView ? 'p-4' : 'p-4 flex items-center gap-4'
      )}
    >
      {/* Selection checkbox */}
      {onSelect && (
        <div
          className={cn(
            'flex-shrink-0',
            isGridView && 'absolute top-3 left-3 z-10'
          )}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            aria-label={`Select ${blog.title}`}
          />
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          'flex-1 min-w-0',
          isGridView && 'space-y-3',
          !isGridView && 'flex items-center gap-4'
        )}
      >
        {/* Title and keyword */}
        <div className={cn('min-w-0', !isGridView && 'flex-1')}>
          <h4
            className={cn(
              'font-medium truncate cursor-pointer hover:text-primary',
              isGridView ? 'text-base mb-1' : 'text-sm'
            )}
            onClick={onView}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (onView && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onView()
              }
            }}
          >
            {blog.title}
          </h4>
          <p className="text-xs text-muted-foreground truncate">
            {blog.keyword}
          </p>

          {/* Badges - only in grid view */}
          {isGridView && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className={STATUS_STYLES[blog.status]}>
                {blog.status}
              </Badge>
              <Badge variant="outline" className={CONTENT_TYPE_STYLES[blog.contentType]}>
                {blog.contentType}
              </Badge>
              {blog.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {blog.tags.length > 2 && (
                <span className="text-xs text-muted-foreground">
                  +{blog.tags.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Excerpt - only in grid view */}
          {isGridView && blog.excerpt && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {blog.excerpt}
            </p>
          )}
        </div>

        {/* Stats - list view */}
        {!isGridView && (
          <>
            <div className="flex items-center gap-1 text-xs text-muted-foreground w-20">
              <FileText className="h-3 w-3" />
              <span>{blog.wordCount.toLocaleString()}</span>
            </div>

            <div className={cn('w-16 text-center', getAeoScoreColor(blog.aeoScore))}>
              {blog.aeoScore !== null ? (
                <div className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  <span className="font-medium">{blog.aeoScore}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </div>

            <Badge className={cn('w-20 justify-center', STATUS_STYLES[blog.status])}>
              {blog.status}
            </Badge>

            <div className="flex items-center gap-1 text-xs text-muted-foreground w-24">
              <Clock className="h-3 w-3" />
              <span>{formatRelativeTime(blog.updatedAt)}</span>
            </div>
          </>
        )}

        {/* Stats footer - grid view */}
        {isGridView && (
          <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {blog.wordCount.toLocaleString()} words
              </span>
              {blog.aeoScore !== null && (
                <span className={cn('flex items-center gap-1', getAeoScoreColor(blog.aeoScore))}>
                  <BarChart3 className="h-3 w-3" />
                  AEO: {blog.aeoScore}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(blog.updatedAt)}
            </span>
          </div>
        )}
      </div>

      {/* Actions menu */}
      <div className="flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onView && (
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <FileText className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {onCopy && (
              <DropdownMenuItem onClick={onCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copy to clipboard
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {onRefresh && (
              <DropdownMenuItem onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh content
              </DropdownMenuItem>
            )}

            {onExport && (
              <>
                <DropdownMenuItem onClick={() => onExport('html')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export as HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('docx')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export as DOCX
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('pdf')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
              </>
            )}

            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  )
}

export const BlogCard = memo(BlogCardComponent)
