/**
 * ABOUTME: Loading state for authenticated routes
 * ABOUTME: Shows skeleton UI during page loads
 */

export default function AuthenticatedLoading() {
  return (
    <div className="h-full bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-72 bg-muted rounded animate-pulse" />
        </div>

        {/* Content skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Table skeleton */}
        <div className="space-y-3">
          <div className="h-10 bg-muted rounded animate-pulse" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
