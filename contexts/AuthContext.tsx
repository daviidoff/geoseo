/**
 * ABOUTME: Auth context using Supabase
 * ABOUTME: Provides user state with email/password + OTP verification
 */

'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  userEmail: string | null
  userName: string | null
  userAvatar: string | null
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<boolean>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>
  verifyOtp: (email: string, token: string) => Promise<{ error?: string; success: boolean }>
  resendOtp: (email: string) => Promise<{ error?: string }>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: string }>
  // Legacy aliases for backward compatibility
  login: (email: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  userEmail: null,
  userName: null,
  userAvatar: null,
  isAuthenticated: false,
  signIn: async () => false,
  signUp: async () => ({}),
  verifyOtp: async () => ({ success: false }),
  resendOtp: async () => ({}),
  signInWithGoogle: async () => {},
  signOut: async () => {},
  resetPassword: async () => ({}),
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    const supabase = createClient()
    if (!supabase) return false

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    return !error
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName?: string): Promise<{ error?: string }> => {
    const supabase = createClient()
    if (!supabase) return { error: 'Supabase not configured' }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: fullName || '',
          email: email,
        },
      },
    })

    if (error) return { error: error.message }
    return {}
  }, [])

  const verifyOtp = useCallback(async (email: string, token: string): Promise<{ error?: string; success: boolean }> => {
    const supabase = createClient()
    if (!supabase) return { error: 'Supabase not configured', success: false }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    })

    if (error) return { error: error.message, success: false }
    
    // After successful verification, ensure user profile exists
    // The database trigger should have created it, but we upsert as a fallback
    if (data.user) {
      const fullName = data.user.user_metadata?.full_name || ''
      const { error: profileError } = await supabase.from('user_profiles').upsert({
        user_id: data.user.id,
        email: data.user.email,
        full_name: fullName,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      
      if (profileError) {
        console.error('[Auth] Failed to upsert user profile:', profileError.message)
        // Don't fail verification - the trigger should have handled this
      }
    }

    return { success: true }
  }, [])

  const resendOtp = useCallback(async (email: string): Promise<{ error?: string }> => {
    const supabase = createClient()
    if (!supabase) return { error: 'Supabase not configured' }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (error) return { error: error.message }
    return {}
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return

    // Preserve the current path so user returns to the same page after auth
    const currentPath = window.location.pathname
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', currentPath)

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }, [])

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient()
      
      // Sign out from Supabase if configured
      if (supabase) {
        await supabase.auth.signOut()
      }
    } catch (err) {
      console.error('Supabase signOut error:', err)
    }
    
    // Clear local state
    setUser(null)
    setSession(null)
    
    // Clear ALL localStorage-based session data
    if (typeof window !== 'undefined') {
      // Auth data
      localStorage.removeItem('hyperniche_session')
      localStorage.removeItem('hyperniche_user')
      localStorage.removeItem('hyperniche_anon_id')
      
      // Business context data
      localStorage.removeItem('bulk-gpt-business-context')
      localStorage.removeItem('bulk-gpt-saved-companies')
      localStorage.removeItem('bulk-gpt-analyzed-url')
      
      // Clear any Supabase auth tokens
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('sb-') || key.includes('supabase')
      )
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      // Force redirect to home page with full page reload
      window.location.replace('/')
    }
  }, [])

  const resetPassword = useCallback(async (email: string): Promise<{ error?: string }> => {
    const supabase = createClient()
    if (!supabase) return { error: 'Supabase not configured' }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) return { error: error.message }
    return {}
  }, [])

  // Legacy aliases
  const login = useCallback((email: string) => {
    console.warn('login() is deprecated, use signIn() instead')
  }, [])

  const logout = useCallback(() => {
    signOut()
  }, [signOut])

  const userEmail = user?.email ?? null
  const userName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null
  const userAvatar = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null
  const isAuthenticated = !!user

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        userEmail,
        userName,
        userAvatar,
        isAuthenticated,
        signIn,
        signUp,
        verifyOtp,
        resendOtp,
        signInWithGoogle,
        signOut,
        resetPassword,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
