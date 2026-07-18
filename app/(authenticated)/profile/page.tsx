/**
 * ABOUTME: Profile/settings page for user account management
 * ABOUTME: Organized into tabs: Account, Usage, and Billing
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Mail, BarChart3, CreditCard, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useProfile } from '@/hooks/useProfile'

// Lazy load non-default tabs
const UsageDisplay = dynamic(
  () => import('@/components/billing/UsageDisplay').then((mod) => ({ default: mod.UsageDisplay })),
  { ssr: false }
)

const BillingDashboard = dynamic(
  () => import('@/components/billing/BillingDashboard'),
  { ssr: false }
)

export default function ProfilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, isLoading, error: profileError, updateProfile, refetch } = useProfile()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('account')
  const [isVerifyingSession, setIsVerifyingSession] = useState(false)

  // Form state
  const [fullName, setFullName] = useState('')
  const [organization, setOrganization] = useState('')

  // Verify Stripe session when returning from checkout
  const verifyStripeSession = useCallback(async (sessionId: string) => {
    setIsVerifyingSession(true)
    try {
      const response = await fetch('/api/stripe/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccessMessage(data.message || 'Payment successful! Your plan has been updated.')
        setActiveTab('billing')
        // Refresh profile to get updated plan
        if (refetch) refetch()
      } else {
        // Session might already be processed by webhook, just show billing
        setActiveTab('billing')
      }
    } catch (err) {
      console.error('Session verification error:', err)
      // Don't show error - webhook might have handled it
      setActiveTab('billing')
    } finally {
      setIsVerifyingSession(false)
      // Clear the session_id from URL
      window.history.replaceState({}, '', '/profile?tab=billing')
    }
  }, [refetch])

  // Check for session_id on mount
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const tab = searchParams.get('tab')

    if (sessionId) {
      verifyStripeSession(sessionId)
    } else if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams, verifyStripeSession])

  // Sync form state with profile when it loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setOrganization(profile.organization || '')
    }
  }, [profile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await updateProfile({
        full_name: fullName.trim() || null,
        organization: organization.trim() || null,
      })
      setSuccessMessage('Profile updated successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || isVerifyingSession) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 border-b border-border h-12" />
        <div className="flex-1 p-6">
          <div className="max-w-xl space-y-4">
            {isVerifyingSession ? (
              <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/30 bg-primary/10">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                <span className="text-sm font-medium">Verifying your payment...</span>
              </div>
            ) : (
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-12 bg-muted rounded" />
                <div className="h-12 bg-muted rounded" />
                <div className="h-12 bg-muted rounded" />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (profileError && !profile) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 border-b border-border h-12" />
        <div className="flex-1 p-6">
          <div className="max-w-xl">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">
                {profileError instanceof Error ? profileError.message : 'Failed to load profile'}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation - matches /blogs exactly */}
      <div className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b-0 h-12 bg-transparent p-0">
            <TabsTrigger
              value="account"
              className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
              <span className="sm:hidden">Account</span>
            </TabsTrigger>
            <TabsTrigger
              value="usage"
              className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Usage</span>
              <span className="sm:hidden">Usage</span>
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 flex items-center gap-2"
            >
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Billing</span>
              <span className="sm:hidden">Billing</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'account' && (
          <div className="p-6">
            <div className="max-w-xl space-y-6">
              {/* Success Message */}
              {successMessage && (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-green-500/30 bg-green-500/10 text-green-500">
                  <CheckCircle className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{successMessage}</span>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div>
                <h2 className="text-lg font-semibold">Account Information</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your account details
                </p>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                {/* Email (read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base font-medium">Email</Label>
                  <div className="flex items-center gap-3 h-10 px-3 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{profile?.email || 'Not available'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-base font-medium">Full Name</Label>
                  <Input
                    id="full_name"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isSaving}
                  />
                </div>

                {/* Organization */}
                <div className="space-y-2">
                  <Label htmlFor="organization" className="text-base font-medium">Organization</Label>
                  <Input
                    id="organization"
                    type="text"
                    placeholder="Enter your organization"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    disabled={isSaving}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/keywords')}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="p-6">
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Usage & Limits</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Track your usage and remaining credits
                </p>
              </div>
              <UsageDisplay />
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="p-6">
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Billing & Subscription</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your plan and payment details
                </p>
              </div>
              <BillingDashboard />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
