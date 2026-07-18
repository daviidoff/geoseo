/**
 * ABOUTME: Authentication form component with Supabase
 * ABOUTME: Supports email/password with OTP verification
 */

'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { logError } from '@/lib/errors'
import { useAuth } from '@/contexts/AuthContext'
import { validatePassword } from '@/lib/validation/auth'
import { PasswordStrength } from './PasswordStrength'

interface AuthFormProps {
  returnUrl?: string
}

export function AuthForm({ returnUrl = '/context' }: AuthFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const { signIn, signUp, resetPassword, signInWithGoogle } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const handleEmailAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const fullName = formData.get('fullName') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
      setError('Please enter both email and password')
      setIsLoading(false)
      return
    }

    if (mode === 'signup' && !fullName) {
      setError('Please enter your name')
      setIsLoading(false)
      return
    }

    if (mode === 'signup' && !validatePassword(password)) {
      setError('Password must be at least 8 characters with letters and numbers')
      setIsLoading(false)
      return
    }

    try {
      if (mode === 'signup') {
        const result = await signUp(email, password, fullName)
        if (result.error) {
          // Check if user already exists - switch to sign in mode with email pre-filled
          const errorLower = result.error.toLowerCase()
          if (errorLower.includes('already registered') || 
              errorLower.includes('already exists') || 
              errorLower.includes('user already') ||
              errorLower.includes('email already')) {
            setMode('signin')
            setEmail(email)
            setPassword('')
            setMessage('This email is already registered. Please sign in instead.')
            setError(null)
          } else {
            setError(result.error)
          }
        } else {
          // Redirect to verification page with email
          router.push(`/auth/verify?email=${encodeURIComponent(email)}`)
        }
      } else {
        const success = await signIn(email, password)
        if (!success) {
          setError('Invalid email or password')
        } else {
          window.location.href = returnUrl
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed'
      setError(errorMessage)
      logError(err instanceof Error ? err : new Error(errorMessage), {
        source: 'AuthForm',
        action: mode,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsResettingPassword(true)
    setError(null)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string

    if (!email) {
      setError('Please enter your email address')
      setIsResettingPassword(false)
      return
    }

    try {
      const result = await resetPassword(email)
      if (result.error) {
        setError(result.error)
      } else {
        setMessage('Check your email for a password reset link')
      }
    } catch (err) {
      setError('Failed to send reset email. Please try again.')
    } finally {
      setIsResettingPassword(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError('Failed to sign in with Google')
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-md bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-600 dark:text-green-400"
        >
          {message}
        </div>
      )}

      {/* Email/Password form */}
      <form onSubmit={handleEmailAuth} className="space-y-3">
        {mode === 'signup' && (
          <input
            type="text"
            name="fullName"
            placeholder="Name"
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            required
            disabled={isLoading || isResettingPassword}
            autoComplete="name"
          />
        )}
        <input
          type="email"
          name="email"
          placeholder="Email"
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
          required
          disabled={isLoading || isResettingPassword}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="space-y-2">
          <input
            type="password"
            name="password"
            placeholder={mode === 'signup' ? 'Password (min 8 chars, letters & numbers)' : 'Password'}
            minLength={8}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            required
            disabled={isLoading || isResettingPassword}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'signup' && <PasswordStrength password={password} />}
          {mode === 'signin' && (
            <div className="text-right">
              <button
                type="button"
                onClick={(e) => {
                  const form = e.currentTarget.closest('form')
                  if (form) {
                    handleForgotPassword({ preventDefault: () => {}, currentTarget: form } as React.FormEvent<HTMLFormElement>)
                  }
                }}
                disabled={isResettingPassword}
                className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              >
                {isResettingPassword ? 'Sending...' : 'Forgot password?'}
              </button>
            </div>
          )}
        </div>
        <Button
          type="submit"
          disabled={isLoading || isResettingPassword}
          className="w-full min-h-[44px]"
        >
          {isLoading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted-foreground">or continue with</span>
        </div>
      </div>

      {/* Google Sign In */}
      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleSignIn}
        disabled={isLoading || isGoogleLoading || isResettingPassword}
        className="w-full min-h-[44px] flex items-center justify-center gap-2"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
      </Button>

      {/* Toggle sign in / sign up */}
      <div className="text-center text-sm text-muted-foreground">
        {mode === 'signin' ? (
          <>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              className="text-primary hover:underline font-medium"
              onClick={() => { setMode('signup'); setPassword(''); setError(null); setMessage(null) }}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              className="text-primary hover:underline font-medium"
              onClick={() => { setMode('signin'); setPassword(''); setError(null); setMessage(null) }}
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </div>
  )
}
