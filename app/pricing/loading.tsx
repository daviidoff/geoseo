/**
 * ABOUTME: Loading state for pricing page
 * ABOUTME: Shows skeleton cards during load
 */

export default function PricingLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/30 to-background px-4 pt-32 pb-12">
      <div className="max-w-5xl mx-auto">
        {/* Header skeleton */}
        <div className="text-center mb-16 space-y-4">
          <div className="h-10 w-80 bg-muted rounded mx-auto animate-pulse" />
          <div className="h-5 w-96 bg-muted rounded mx-auto animate-pulse" />
        </div>

        {/* Card skeletons */}
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
