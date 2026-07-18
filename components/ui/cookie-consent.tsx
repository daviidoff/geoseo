/**
 * ABOUTME: Cookie consent banner for GDPR compliance
 * ABOUTME: Shows on first visit, stores preference in localStorage
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      // Small delay to prevent flash on page load
      const timer = setTimeout(() => setShowBanner(true), 500)
      return () => clearTimeout(timer)
    }
  }, [])

  const acceptAll = () => {
    localStorage.setItem('cookie-consent', JSON.stringify({
      analytics: true,
      marketing: true,
      timestamp: Date.now()
    }))
    setShowBanner(false)
  }

  const acceptEssential = () => {
    localStorage.setItem('cookie-consent', JSON.stringify({
      analytics: false,
      marketing: false,
      timestamp: Date.now()
    }))
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur border-t border-border shadow-lg"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground text-center sm:text-left">
          We use cookies to enhance your experience and analyze site usage.{' '}
          <Link href="/privacy" className="underline hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={acceptEssential}
            className="whitespace-nowrap"
          >
            Essential Only
          </Button>
          <Button
            size="sm"
            onClick={acceptAll}
            className="whitespace-nowrap"
          >
            Accept All
          </Button>
        </div>
      </div>
    </div>
  )
}
