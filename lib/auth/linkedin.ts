// ABOUTME: LinkedIn OAuth authentication utility
// ABOUTME: In localStorage mode, LinkedIn OAuth is not available

'use client'

import { logError } from '@/lib/errors'

/**
 * Signs in user with LinkedIn OAuth
 * Note: Not available in localStorage mode - requires Supabase
 */
export async function signInWithLinkedIn() {
  console.warn('[LINKEDIN AUTH] LinkedIn OAuth not available in localStorage mode')
  throw new Error('LinkedIn OAuth is not available. Please use email/password authentication.')
}
