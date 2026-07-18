'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { BlogCard } from './BlogCard'
import {
  Search,
  Plus,
  Download,
  Trash2,
  RefreshCw,
  LayoutGrid,
  List,
  Filter,
  SortAsc,
  SortDesc,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  BlogListItem,
  BlogStatus,
  BlogContentType,
  BlogFilterOptions,
  BlogSortOptions,
  BlogExportFormat,
} from '@/lib/types/blogs'

/**
 * Default filter state
 */
const DEFAULT_FILTERS: BlogFilterOptions = {
  status: 'all',
  contentType: 'all',
  tags: [],
  searchQuery: '',
  dateRange: { from: null, to: null },
}

/**
 * Default sort state
 */
const DEFAULT_SORT: BlogSortOptions = {
  column: 'updatedAt',
  direction: 'desc',
}

interface BlogLibraryProps {
  /** List of blogs to display */
  blogs: BlogListItem[]
  /** Loading state */
  isLoading?: boolean
  /** Total count for pagination */
  totalCount?: number
  /** Current page (1-indexed) */
  currentPage?: number
  /** Page size */
  pageSize?: number
  /** Callback when page changes */
  onPageChange?: (page: number) => void
  /** Callback to create new blog */
  onCreateNew?: () => void
  /** Callback to view a blog */
  onView?: (blogId: string) => void
  /** Callback to edit a blog */
  onEdit?: (blogId: string) => void
  /** Callback to refresh a blog */
  onRefresh?: (blogId: string) => void
  /** Callback to export blogs */
  onExport?: (blogIds: string[], format: BlogExportFormat) => void
  /** Callback to copy blog content */
  onCopy?: (blogId: string) => void
  /** Callback to delete blogs */
  onDelete?: (blogIds: string[]) => void
  /** Additional className */
  className?: string
}

/**
 * BlogLibrary Component
 *
 * Main library interface for managing generated blogs.
 * Supports filtering, sorting, bulk selection, and various actions.
 */
export function BlogLibrary({
  blogs,
  isLoading = false,
  totalCount = 0,
  currentPage = 1,
  pageSize = 20,
  onPageChange,
  onCreateNew,
  onView,
  onEdit,
  onRefresh,
  onExport,
  onCopy,
  onDelete,
  className,
}: BlogLibraryProps) {
  // UI state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<BlogFilterOptions>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<BlogSortOptions>(DEFAULT_SORT)
  const [showFilters, setShowFilters] = useState(false)

  // Get unique values for filter options
  const { statuses, contentTypes, allTags } = useMemo(() => {
    const statusSet = new Set<BlogStatus>()
    const contentTypeSet = new Set<BlogContentType>()
    const tagSet = new Set<string>()

    blogs.forEach((blog) => {
      statusSet.add(blog.status)
      contentTypeSet.add(blog.contentType)
      blog.tags.forEach((tag) => tagSet.add(tag))
    })

    return {
      statuses: Array.from(statusSet),
      contentTypes: Array.from(contentTypeSet),
      allTags: Array.from(tagSet).sort(),
    }
  }, [blogs])

  // Filter and sort blogs
  const filteredBlogs = useMemo(() => {
    let filtered = blogs.filter((blog) => {
      // Status filter
      if (filters.status !== 'all' && blog.status !== filters.status) {
        return false
      }
      // Content type filter
      if (filters.contentType !== 'all' && blog.contentType !== filters.contentType) {
        return false
      }
      // Tags filter
      if (filters.tags.length > 0) {
        if (!filters.tags.some((tag) => blog.tags.includes(tag))) {
          return false
        }
      }
      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        return (
          blog.title.toLowerCase().includes(query) ||
          blog.keyword.toLowerCase().includes(query) ||
          (blog.excerpt?.toLowerCase().includes(query) ?? false)
        )
      }
      return true
    })

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0
      switch (sort.column) {
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'keyword':
          comparison = a.keyword.localeCompare(b.keyword)
          break
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        case 'wordCount':
          comparison = a.wordCount - b.wordCount
          break
        case 'aeoScore':
          comparison = (a.aeoScore ?? 0) - (b.aeoScore ?? 0)
          break
      }
      return sort.direction === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [blogs, filters, sort])

  // Selection handlers
  const toggleSelection = useCallback((blogId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(blogId)
      } else {
        next.delete(blogId)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredBlogs.map((b) => b.id)))
  }, [filteredBlogs])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Toggle sort
  const toggleSort = useCallback((column: BlogSortOptions['column']) => {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc',
    }))
  }, [])

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  // Bulk actions
  const handleBulkExport = useCallback(
    (format: BlogExportFormat) => {
      if (onExport && selectedIds.size > 0) {
        onExport(Array.from(selectedIds), format)
      }
    },
    [onExport, selectedIds]
  )

  const handleBulkDelete = useCallback(() => {
    if (onDelete && selectedIds.size > 0) {
      onDelete(Array.from(selectedIds))
      clearSelection()
    }
  }, [onDelete, selectedIds, clearSelection])

  // Pagination
  const totalPages = Math.ceil(totalCount / pageSize)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  // Check if any filters are active
  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.contentType !== 'all' ||
    filters.tags.length > 0 ||
    filters.searchQuery !== ''

  // Empty state
  if (!isLoading && blogs.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        <EmptyState
          icon={FileText}
          title="No Blogs Yet"
          description="Create your first AEO-optimized blog article to get started."
          action={
            onCreateNew
              ? {
                  label: 'Create New Blog',
                  onClick: onCreateNew,
                }
              : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Blog Library</h2>
          <p className="text-sm text-muted-foreground">
            {totalCount} blog{totalCount !== 1 ? 's' : ''} total
          </p>
        </div>
        {onCreateNew && (
          <Button onClick={onCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Blog
          </Button>
        )}
      </div>

      {/* Search and filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search blogs..."
                value={filters.searchQuery}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
                }
                className="pl-9"
              />
            </div>
          </div>

          {/* Filter toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>

            <select
              value={`${sort.column}-${sort.direction}`}
              onChange={(e) => {
                const [column, direction] = e.target.value.split('-') as [
                  BlogSortOptions['column'],
                  BlogSortOptions['direction']
                ]
                setSort({ column, direction })
              }}
              className="h-9 px-3 py-1 border border-input rounded-md text-sm bg-background"
            >
              <option value="updatedAt-desc">Recently Updated</option>
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
              <option value="wordCount-desc">Most Words</option>
              <option value="aeoScore-desc">Highest AEO</option>
            </select>

            {/* View mode toggle */}
            <div className="flex border border-input rounded-md">
              <button
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'list' && 'bg-primary text-primary-foreground'
                )}
                onClick={() => setViewMode('list')}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'grid' && 'bg-primary text-primary-foreground'
                )}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t">
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  status: e.target.value as BlogStatus | 'all',
                }))
              }
              className="h-9 px-3 py-1 border border-input rounded-md text-sm bg-background"
            >
              <option value="all">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={filters.contentType}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  contentType: e.target.value as BlogContentType | 'all',
                }))
              }
              className="h-9 px-3 py-1 border border-input rounded-md text-sm bg-background"
            >
              <option value="all">All Types</option>
              {contentTypes.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Bulk selection bar */}
      {selectedIds.size > 0 && (
        <Card className="p-3 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={selectedIds.size === filteredBlogs.length}
                onCheckedChange={(checked) => {
                  if (checked) {
                    selectAll()
                  } else {
                    clearSelection()
                  }
                }}
              />
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {onExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkExport('html')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredBlogs.length} of {blogs.length} blogs
        </span>
        {selectedIds.size === 0 && filteredBlogs.length > 0 && (
          <Button variant="ghost" size="sm" onClick={selectAll}>
            Select all
          </Button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Blog list */}
      {!isLoading && filteredBlogs.length === 0 && hasActiveFilters && (
        <EmptyState
          variant="filtered"
          title="No matching blogs"
          description="Try adjusting your filters or search query"
          clearFilter={{
            label: 'Clear filters',
            onClick: clearFilters,
          }}
          size="sm"
        />
      )}

      {!isLoading && filteredBlogs.length > 0 && (
        <div
          className={cn(
            viewMode === 'grid' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
            viewMode === 'list' && 'space-y-3'
          )}
        >
          {filteredBlogs.map((blog) => (
            <BlogCard
              key={blog.id}
              blog={blog}
              viewMode={viewMode}
              isSelected={selectedIds.has(blog.id)}
              onSelect={(selected) => toggleSelection(blog.id, selected)}
              onView={onView ? () => onView(blog.id) : undefined}
              onEdit={onEdit ? () => onEdit(blog.id) : undefined}
              onRefresh={onRefresh ? () => onRefresh(blog.id) : undefined}
              onExport={
                onExport
                  ? (format) => onExport([blog.id], format)
                  : undefined
              }
              onCopy={onCopy ? () => onCopy(blog.id) : undefined}
              onDelete={onDelete ? () => onDelete([blog.id]) : undefined}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPrevPage}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNextPage}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
