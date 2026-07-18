/**
 * ABOUTME: Hook for fetching and updating user profile
 * ABOUTME: Returns null when user is not authenticated (no demo fallback)
 */

import { useCallback } from 'react'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  organization: string | null
}

const fetcher = async (): Promise<UserProfile | null> => {
  // First try the API route
  try {
    const response = await fetch('/api/user/profile')
    if (response.ok) {
      const data = await response.json()
      if (data.profile && data.profile.user_id) {
        return {
          id: data.profile.user_id || data.profile.id,
          email: data.profile.email || '',
          full_name: data.profile.full_name || null,
          avatar_url: data.profile.avatar_url || null,
          organization: data.profile.organization || null,
        }
      }
    }
    // If API returns 401 or no profile, user is not authenticated
    if (response.status === 401) {
      return null
    }
  } catch (error) {
    console.warn('Failed to fetch profile from API:', error)
  }

  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return null // No Supabase = no auth = no profile
  }

  // Try Supabase directly
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    if (!supabase) {
      return null
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user) {
      // User is not authenticated
      return null
    }

    const userEmail = user.email || user.user_metadata?.email || ''

    const { data, error: fetchError } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, avatar_url, organization')
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // Create user profile
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({ user_id: user.id })
          .select('user_id, full_name, avatar_url, organization')
          .single()

        if (createError) {
          console.error('Error creating user profile:', createError)
          return null
        }
        return { id: newProfile.user_id, ...newProfile, email: userEmail }
      }
      console.error('Error fetching user profile:', fetchError)
      return null
    }

    return { id: data.user_id, ...data, email: userEmail }
  } catch (error) {
    console.error('Error in profile fetcher:', error)
    return null
  }
}

export function useProfile() {
  const { data: profile, isLoading, error, mutate } = useSWR<UserProfile | null>(
    'profile',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
      revalidateIfStale: false,
      keepPreviousData: false,
      revalidateOnMount: true,
    }
  )

  const { trigger: updateProfileTrigger } = useSWRMutation(
    'profile',
    async (_key, { arg }: { arg: Partial<UserProfile> }) => {
      if (!profile) {
        throw new Error('Cannot update profile: not authenticated')
      }
      
      // Try API route first
      try {
        const response = await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(arg),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.profile) {
            return {
              id: data.profile.user_id || data.profile.id || profile.id,
              email: data.profile.email || profile.email,
              full_name: data.profile.full_name ?? profile.full_name ?? null,
              avatar_url: data.profile.avatar_url ?? profile.avatar_url ?? null,
              organization: data.profile.organization ?? profile.organization ?? null,
            }
          }
        }
        throw new Error('Failed to update profile')
      } catch (error) {
        console.warn('Failed to update profile via API:', error)
        throw error
      }
    }
  )

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      try {
        const result = await updateProfileTrigger(updates)
        mutate(result, false)
        return true
      } catch (error) {
        mutate()
        throw error
      }
    },
    [updateProfileTrigger, mutate]
  )

  return {
    profile,
    isLoading,
    error,
    isAuthenticated: !!profile,
    updateProfile,
    refreshProfile: mutate,
    refetch: mutate, // Alias for compatibility
  }
}
