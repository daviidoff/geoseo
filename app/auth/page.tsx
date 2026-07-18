/**
 * ABOUTME: Authentication page with Supabase
 * ABOUTME: Supports email/password and Google OAuth (redirects to landing in waitlist mode)
 */

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthForm } from '@/components/auth/AuthForm'
import { Logo } from '@/components/brand/Logo'
import { useAuth } from '@/contexts/AuthContext'

const WAITLIST_MODE = process.env.NEXT_PUBLIC_WAITLIST_MODE === 'true'

function isValidReturnUrl(url: string): boolean {
  if (!url.startsWith('/') || url.startsWith('//')) return false
  if (url.includes(':')) return false
  return true
}

function AuthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const { user, loading } = useAuth()
  const errorParam = searchParams.get('error')

  useEffect(() => {
    // In waitlist mode, redirect to landing page with waitlist modal trigger
    if (WAITLIST_MODE) {
      router.replace('/?waitlist=true')
      return
    }

    if (loading) return

    if (user) {
      const returnUrl = searchParams.get('returnUrl') || '/context'
      router.replace(isValidReturnUrl(returnUrl) ? returnUrl : '/context')
      return
    }

    setIsCheckingAuth(false)
  }, [user, loading, router, searchParams])

  if (isCheckingAuth || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo size="lg" showText={false} />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Left side - Login form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div id="main-content" className="w-full max-w-md bg-card border border-border rounded-lg overflow-hidden shadow-lg" tabIndex={-1}>
          {/* Mobile header */}
          <div className="lg:hidden relative h-32 overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <h2 className="text-2xl font-bold tracking-tight">
                <span className="text-white">HyperNiche</span>
                <span className="text-white/70">AI</span>
              </h2>
              <p className="text-white/90 text-xs font-medium">
                Dominate your niche in AI search
              </p>
            </div>
          </div>

          <div className="px-6 py-5 text-center">
            <h1 className="text-base font-semibold text-foreground">Welcome</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to continue</p>
          </div>

          {errorParam && (
            <div className="mx-6 mb-4 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
              {errorParam}
            </div>
          )}

          <div className="px-6 py-6">
            <AuthForm returnUrl={searchParams.get('returnUrl') || '/context'} />
          </div>
        </div>
      </div>

      {/* Right side - Desktop branded panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center p-12">
          <div className="text-center">
            <h2 className="text-4xl xl:text-5xl font-bold tracking-tight mb-4">
              <span className="text-white">HyperNiche</span>
              <span className="text-white/70">AI</span>
            </h2>
            <p className="text-white/90 text-xl xl:text-2xl font-medium mb-8">
              Dominate your niche in AI search.
            </p>

            {/* Value props */}
            <div className="space-y-3 text-left max-w-xs mx-auto">
              <div className="flex items-center gap-3 text-white/90">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
                <span>Rank in ChatGPT, Perplexity & Claude</span>
              </div>
              <div className="flex items-center gap-3 text-white/90">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
                <span>Set up in 5 minutes</span>
              </div>
              <div className="flex items-center gap-3 text-white/90">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
                <span>Administrator-managed access</span>
              </div>
            </div>

            {/* Vision */}
            <p className="mt-12 text-white/60 text-sm italic">
              Democratizing AI visibility for everyone.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
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
      <AuthPageContent />
    </Suspense>
  )
}
