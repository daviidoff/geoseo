/**
 * ABOUTME: Loading state for landing pages
 * ABOUTME: Shows minimal loading indicator
 */

export default function LandingLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}
