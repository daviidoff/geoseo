/**
 * ABOUTME: Waitlist signup modal for early access
 * ABOUTME: Email-only form for minimal friction
 */

'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Sparkles, CheckCircle2, Mail } from 'lucide-react'

interface WaitlistModalProps {
  isOpen: boolean
  onClose: () => void
  source?: string
}

export function WaitlistModal({ isOpen, onClose, source = 'landing' }: WaitlistModalProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitState, setSubmitState] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  // Capture UTM params from URL
  const [utmParams, setUtmParams] = useState<{
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
  }>({})

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setUtmParams({
        utmSource: params.get('utm_source') || undefined,
        utmMedium: params.get('utm_medium') || undefined,
        utmCampaign: params.get('utm_campaign') || undefined,
      })
    }
  }, [])

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSubmitState('idle')
      setMessage('')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setSubmitState('error')
      setMessage('Please enter your email address')
      return
    }

    setIsSubmitting(true)
    setSubmitState('idle')

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          source,
          ...utmParams,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSubmitState('success')
        setMessage(data.message || "You're on the list!")
        setEmail('')
      } else {
        setSubmitState('error')
        setMessage(data.error || 'Failed to join waitlist')
      }
    } catch {
      setSubmitState('error')
      setMessage('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Join the Waitlist"
      titleIcon={Sparkles}
      titleIconColor="text-purple-500"
      size="sm"
    >
      {submitState === 'success' ? (
        <div className="py-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            You&apos;re on the list!
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {message}
          </p>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Be the first to know when GeoSEO launches. Get early access and exclusive benefits.
          </p>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="waitlist-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {submitState === 'error' && message && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {message}
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Join Waitlist
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            No spam. We&apos;ll only email you about launch updates.
          </p>
        </form>
      )}
    </Modal>
  )
}
