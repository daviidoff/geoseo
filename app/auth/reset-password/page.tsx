/**
 * ABOUTME: Reset password page - handles password recovery flow
 * ABOUTME: Users arrive here from Supabase email link with recovery tokens
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/Logo'
import { createClient } from '@/lib/supabase/client'
import { validatePassword } from '@/lib/validation/auth'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  // Check for recovery session on mount
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      if (!supabase) {
        setError('Authentication service not available')
        setIsVerifying(false)
        return
      }

      // Check if we have a valid session (user clicked recovery link)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        setError('Failed to verify reset link. Please request a new one.')
        setIsVerifying(false)
        return
      }

      if (session) {
        setHasSession(true)
      } else {
        // No session - either link expired or invalid
        setError('Reset link has expired or is invalid. Please request a new password reset.')
      }

      setIsVerifying(false)
    }

    // Listen for auth state changes (handles the recovery flow)
    const supabase = createClient()
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setHasSession(true)
          setIsVerifying(false)
        }
      })

      // Check existing session
      checkSession()

      return () => {
        subscription.unsubscribe()
      }
    } else {
      setError('Authentication service not available')
      setIsVerifying(false)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate passwords
    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters with letters and numbers')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      if (!supabase) {
        setError('Authentication service not available')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(true)

      // Sign out and redirect to login after a short delay
      setTimeout(async () => {
        await supabase.auth.signOut()
        router.push('/auth?reset=success')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setIsLoading(false)
    }
  }

  // Loading state while verifying
  if (isVerifying) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo size="lg" showText={false} />
          </div>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Verifying reset link...</span>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md bg-card border border-border rounded-lg overflow-hidden shadow-lg">
          <div className="px-6 py-6 text-center">
            <div className="mx-auto mb-4 flex justify-center">
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <h1 className="text-lg font-semibold text-foreground mb-2">
              Password Updated
            </h1>
            <p className="text-sm text-muted-foreground">
              Your password has been successfully reset. Redirecting to sign in...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Error state (invalid/expired link)
  if (error && !hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md bg-card border border-border rounded-lg overflow-hidden shadow-lg">
          <div className="px-6 py-6 text-center border-b border-border">
            <div className="mx-auto mb-4 flex justify-center">
              <Logo size="lg" showText={false} />
            </div>
            <h1 className="text-lg font-semibold text-foreground mb-2">
              Reset Link Invalid
            </h1>
          </div>
          <div className="px-6 py-6">
            <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20 mb-4">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <Button
              onClick={() => router.push('/auth')}
              className="w-full"
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Password reset form
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-lg overflow-hidden shadow-lg">
        <div className="px-6 py-6 text-center border-b border-border">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo size="lg" showText={false} />
          </div>
          <h1 className="text-lg font-semibold text-foreground mb-1">
            Set New Password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        <div className="px-6 py-6">
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20 mb-4">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password (min 8 chars, letters & numbers)"
                minLength={8}
                required
                disabled={isLoading}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                minLength={8}
                required
                disabled={isLoading}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[44px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => router.push('/auth')}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
