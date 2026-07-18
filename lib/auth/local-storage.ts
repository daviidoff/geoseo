/**
 * ABOUTME: localStorage-based auth system (no Supabase dependency)
 * ABOUTME: Stores user profile and session in browser localStorage
 */

export interface LocalUser {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  organization?: string
  created_at: string
  updated_at: string
}

const STORAGE_KEY = 'hyperniche_user'
const SESSION_KEY = 'hyperniche_session'

/**
 * Generate a unique user ID
 */
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Get current user from localStorage
 */
export function getLocalUser(): LocalUser | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as LocalUser
  } catch {
    return null
  }
}

/**
 * Save user to localStorage
 */
export function saveLocalUser(user: Partial<LocalUser>): LocalUser {
  const existing = getLocalUser()
  const now = new Date().toISOString()

  const updatedUser: LocalUser = {
    id: existing?.id || generateUserId(),
    email: user.email || existing?.email || '',
    full_name: user.full_name ?? existing?.full_name,
    avatar_url: user.avatar_url ?? existing?.avatar_url,
    organization: user.organization ?? existing?.organization,
    created_at: existing?.created_at || now,
    updated_at: now,
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser))
    localStorage.setItem(SESSION_KEY, 'active')
  }

  return updatedUser
}

/**
 * Create a demo user (for unauthenticated access)
 */
export function createDemoUser(): LocalUser {
  return saveLocalUser({
    email: 'demo@hyperniche.ai',
    full_name: 'Demo User',
  })
}

/**
 * Check if user is logged in
 */
export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SESSION_KEY) === 'active' && getLocalUser() !== null
}

/**
 * Log out user
 */
export function logoutUser(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
  // Keep user data for potential re-login
}

/**
 * Clear all user data
 */
export function clearUserData(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(SESSION_KEY)
}

/**
 * Get user ID for API calls (works with or without login)
 */
export function getUserId(): string {
  const user = getLocalUser()
  if (user) return user.id

  // Generate anonymous ID for non-logged-in users
  let anonId = typeof window !== 'undefined'
    ? localStorage.getItem('hyperniche_anon_id')
    : null

  if (!anonId) {
    anonId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    if (typeof window !== 'undefined') {
      localStorage.setItem('hyperniche_anon_id', anonId)
    }
  }

  return anonId
}
