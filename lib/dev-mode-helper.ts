/**
 * ABOUTME: Auth helper for API routes - deprecated, use Supabase auth directly
 * ABOUTME: Returns null when user is not authenticated (no demo fallback)
 */

/**
 * Get user from request - returns null if not authenticated
 * @deprecated Use createClient() from @/lib/supabase/server and check auth.getUser() instead
 */
export function getDevModeUser() {
  // No longer returns mock data - use Supabase auth
  console.warn('[AUTH] getDevModeUser() is deprecated - use Supabase auth directly')
  return null
}

/**
 * Check if we're in dev/local mode (no Supabase)
 */
export function isDevMode(): boolean {
  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !supabaseUrl
}

/**
 * Get user ID from request - returns null if not found
 * @deprecated Use createClient() from @/lib/supabase/server and check auth.getUser() instead
 */
export function getUserIdFromRequest(request: Request): string | null {
  // Check for user ID in headers (set by client)
  const userId = request.headers.get('x-user-id')
  if (userId) return userId

  // No fallback - return null if not authenticated
  return null
}
