/**
 * ABOUTME: Supabase admin client for system-level operations
 * ABOUTME: Used only for webhooks, cron jobs, and other non-user operations
 */

import { createClient } from '@supabase/supabase-js'

// Create admin client for system operations (webhooks, cron jobs)
// This should ONLY be used when there is no user session available
function createAdminClientSync() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[Supabase] Missing SUPABASE_SERVICE_ROLE_KEY for admin client')
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Export admin client for system-level operations only (webhooks, cron jobs)
export const supabaseAdmin = createAdminClientSync()

// Factory function for creating admin client (used by review API routes)
export function createAdminSupabaseClient() {
  return supabaseAdmin
}

export const createServerSupabaseClient = async () => {
  // Use the regular server client from lib/supabase/server.ts instead
  const { createClient } = await import('@/lib/supabase/server')
  return createClient()
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
