/**
 * ABOUTME: Email verification page with 8-digit OTP code input
 * ABOUTME: Users enter the code sent to their email to complete registration
 */

'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/Logo'
import { useAuth } from '@/contexts/AuthContext'

function VerifyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const { verifyOtp, resendOtp, user } = useAuth()

  const [otp, setOtp] = useState(['', '', '', '', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      router.replace('/context')
    }
  }, [user, router])

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError(null)

    // Auto-focus next input
    if (value && index < 7) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all digits entered
    if (value && index === 7 && newOtp.every(d => d !== '')) {
      handleVerify(newOtp.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8)
    if (pastedData.length === 8) {
      const newOtp = pastedData.split('')
      setOtp(newOtp)
      handleVerify(pastedData)
    }
  }

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join('')
    if (otpCode.length !== 8) {
      setError('Please enter the 8-digit code')
      return
    }

    if (!email) {
      setError('Email not found. Please go back and sign up again.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await verifyOtp(email, otpCode)
      if (result.error) {
        setError(result.error)
        setOtp(['', '', '', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      } else if (result.success) {
        // Redirect to app after successful verification
        router.push('/context')
      }
    } catch (err) {
      setError('Verification failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email || countdown > 0) return

    setIsResending(true)
    setError(null)
    setMessage(null)

    try {
      const result = await resendOtp(email)
      if (result.error) {
        setError(result.error)
      } else {
        setMessage('A new code has been sent to your email')
        setCountdown(60) // 60 second cooldown
        setOtp(['', '', '', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch (err) {
      setError('Failed to resend code. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo size="lg" showText={false} />
          </div>
          <h1 className="text-lg font-semibold mb-2">Invalid Link</h1>
          <p className="text-sm text-muted-foreground mb-4">
            No email address found. Please sign up first.
          </p>
          <Button onClick={() => router.push('/auth')} className="w-full">
            Go to Sign Up
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6">
        <div className="mx-auto mb-6 flex justify-center">
          <Logo size="lg" showText={false} />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold mb-2">Verify Your Email</h1>
          <p className="text-sm text-muted-foreground">
            We sent an 8-digit code to
          </p>
          <p className="text-sm font-medium text-foreground">{email}</p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive text-center"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-4 rounded-md bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-600 dark:text-green-400 text-center"
          >
            {message}
          </div>
        )}

        {/* OTP Input */}
        <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => { inputRefs.current[index] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleOtpChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              className="w-10 h-12 text-center text-lg font-semibold border border-border rounded-md bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              disabled={isLoading}
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        <Button
          onClick={() => handleVerify()}
          disabled={isLoading || otp.some(d => d === '')}
          className="w-full min-h-[44px] mb-4"
        >
          {isLoading ? 'Verifying...' : 'Verify Email'}
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          Didn&apos;t receive the code?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || countdown > 0}
            className="text-primary hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {countdown > 0 ? `Resend in ${countdown}s` : isResending ? 'Sending...' : 'Resend'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => router.push('/auth')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo size="lg" showText={false} />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <VerifyPageContent />
    </Suspense>
  )
}
