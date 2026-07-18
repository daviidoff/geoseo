/**
 * ABOUTME: Wrapper component that switches between waitlist modal and normal link behavior
 * ABOUTME: Controlled by NEXT_PUBLIC_WAITLIST_MODE env variable
 */

'use client'

import { useState, ReactNode } from 'react'
import Link from 'next/link'
import { WaitlistModal } from './WaitlistModal'
import { Button, ButtonProps } from '@/components/ui/button'

const WAITLIST_MODE = process.env.NEXT_PUBLIC_WAITLIST_MODE === 'true'

interface WaitlistCTAProps {
  /** URL to navigate to when not in waitlist mode */
  href: string
  /** Button content */
  children: ReactNode
  /** Source tracking for analytics */
  source?: string
  /** Button variant */
  variant?: ButtonProps['variant']
  /** Button size */
  size?: ButtonProps['size']
  /** Additional button classes */
  className?: string
  /** Whether to use asChild pattern (for custom button styling) */
  asChild?: boolean
}

export function WaitlistCTA({
  href,
  children,
  source = 'cta',
  variant,
  size,
  className,
}: WaitlistCTAProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (WAITLIST_MODE) {
    return (
      <>
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={() => setIsModalOpen(true)}
        >
          {children}
        </Button>
        <WaitlistModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          source={source}
        />
      </>
    )
  }

  // Normal link behavior when not in waitlist mode
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link href={href}>{children}</Link>
    </Button>
  )
}

/**
 * Hook for components that need more control over the modal
 * Returns whether waitlist mode is active and modal state controls
 */
export function useWaitlistMode() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return {
    isWaitlistMode: WAITLIST_MODE,
    isModalOpen,
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false),
  }
}
