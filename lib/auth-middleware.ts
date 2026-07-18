/**
 * ABOUTME: Unified authentication middleware for API endpoints (localStorage-based)
 * ABOUTME: No Supabase - uses x-user-id header or returns mock user for local dev
 */

import { NextRequest } from 'next/server'
import { getUserIdFromRequest } from './dev-mode-helper'

/**
 * Authenticate a request and return the user ID
 *
 * Since we're using localStorage auth (no Supabase), auth works via:
 * 1. x-user-id header set by the client
 * 2. API key in Authorization header (for external access)
 * 3. Fallback to local dev user
 */
export async function authenticateRequest(request: NextRequest): Promise<string | null> {
  // Check for user ID header (set by client-side auth)
  const userId = request.headers.get('x-user-id')
  if (userId) {
    return userId
  }

  // Check for API key auth (for external/programmatic access)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer bgpt_')) {
    // For now, accept any API key format - can add validation later
    // Return a consistent user ID for API key access
    return 'api-key-user'
  }

  // In local dev mode, always return a mock user (valid UUID)
  // This allows the app to work without any auth backend
  console.log('[AUTH] No auth header - using local dev user')
  return getUserIdFromRequest(request)
}

/**
 * Get user ID or throw 401
 */
export async function requireAuth(request: NextRequest): Promise<string> {
  const userId = await authenticateRequest(request)
  if (!userId) {
    throw new Error('Authentication required')
  }
  return userId
}
