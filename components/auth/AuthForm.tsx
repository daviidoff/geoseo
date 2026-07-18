/**
 * ABOUTME: Login form for administrator-provisioned Supabase accounts
 * ABOUTME: Supports email/password login and password reset
 */

'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { logError } from '@/lib/errors'
import { useAuth } from '@/contexts/AuthContext'

interface AuthFormProps {
  returnUrl?: string
}

export function AuthForm({ returnUrl = '/context' }: AuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const { signIn, resetPassword } = useAuth()

  const handleEmailAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    if (!email || !password) {
      setError('Please enter both email and password')
      setIsLoading(false)
      return
    }

    try {
      const success = await signIn(email, password)
      if (!success) {
        setError('Invalid email or password')
      } else {
        window.location.href = returnUrl
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed'
      setError(errorMessage)
      logError(err instanceof Error ? err : new Error(errorMessage), {
        source: 'AuthForm',
        action: 'signin',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setIsResettingPassword(true)
    setError(null)
    setMessage(null)

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
    } catch {
      setError('Failed to send reset email. Please try again.')
    } finally {
      setIsResettingPassword(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" aria-live="polite" className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {message && (
        <div role="status" aria-live="polite" className="mb-4 rounded-md bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-600 dark:text-green-400">
          {message}
        </div>
      )}

      <form onSubmit={handleEmailAuth} className="space-y-3">
        <input
          type="email"
          name="email"
          placeholder="Email"
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
          required
          disabled={isLoading || isResettingPassword}
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <div className="space-y-2">
          <input
            type="password"
            name="password"
            placeholder="Password"
            minLength={8}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            required
            disabled={isLoading || isResettingPassword}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="text-right">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isResettingPassword}
              className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            >
              {isResettingPassword ? 'Sending...' : 'Forgot password?'}
            </button>
          </div>
        </div>
        <Button type="submit" disabled={isLoading || isResettingPassword} className="w-full min-h-[44px]">
          {isLoading ? 'Please wait...' : 'Sign In'}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Access is limited to accounts created by an administrator.
      </p>
    </div>
  )
}
