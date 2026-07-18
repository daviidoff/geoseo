/**
 * ABOUTME: Account deletion confirmation dialog
 * ABOUTME: Requires typing "DELETE" to confirm permanent account deletion
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { clearUserData } from '@/lib/auth/local-storage'

export function DeleteAccountDialog() {
  const router = useRouter()
  const { signOut, session } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConfirmed = confirmText === 'DELETE'

  const handleDelete = async () => {
    if (!isConfirmed) return

    setIsDeleting(true)
    setError(null)

    try {
      // Call the delete API endpoint
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // Add auth token if available (Supabase mode)
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || errorData.message || 'Failed to delete account')
        return
      }

      const data = await response.json()

      // If localStorage mode, clear local data
      if (data.localStorage) {
        clearUserData()
      }

      // Sign out and redirect
      await signOut()
      router.push('/?deleted=true')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isDeleting) {
      setOpen(newOpen)
      if (!newOpen) {
        // Reset state when closing
        setConfirmText('')
        setError(null)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-fit">
          Delete Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-destructive">Delete Account</DialogTitle>
              <DialogDescription className="mt-1">
                This action cannot be undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>This will permanently delete:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Your account and profile information</li>
              <li>All your clients and their data</li>
              <li>All generated keywords, blogs, and analyses</li>
              <li>Your billing history and subscription</li>
            </ul>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="confirm-delete" className="text-sm font-medium">
              Type <span className="font-mono font-bold">DELETE</span> to confirm
            </label>
            <Input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={isDeleting}
              className="font-mono"
              autocomplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              'Delete Account'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
