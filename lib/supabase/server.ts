/**
 * ABOUTME: Supabase server client for server-side auth and DB operations
 * ABOUTME: Uses cookies for session management in Server Components and API routes
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Return a stub if Supabase is not configured
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase Server] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
        exchangeCodeForSession: async () => ({ error: new Error('Supabase not configured') }),
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error('Supabase not configured') }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error('Supabase not configured') }) }) }),
        update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error('Supabase not configured') }) }) }) }),
        delete: () => ({ eq: async () => ({ error: new Error('Supabase not configured') }) }),
        upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error('Supabase not configured') }) }) })
      })
    } as any
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
    },
  })
}

/**
 * Create a Supabase admin client with service role key
 * Use this for operations that need to bypass RLS
 */
export async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[Supabase Admin] Missing SUPABASE_SERVICE_ROLE_KEY')
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Ignore errors in Server Components
        }
      },
    },
  })
}
