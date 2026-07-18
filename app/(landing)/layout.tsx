/**
 * Landing Page Layout
 * 
 * This layout is for public landing pages (marketing, SEO-optimized).
 * No authentication required - pure marketing content.
 * 
 * The root layout (app/layout.tsx) provides Providers, Toaster, etc.
 * This layout is nested inside it and adds landing-specific metadata.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hyperniche AI - AI-Powered Content Generation',
  description: 'Generate SEO-optimized keywords and blogs with AI. Create content that ranks.',
  keywords: ['AI content', 'SEO keywords', 'blog generation', 'content marketing', 'AEO'],
  openGraph: {
    title: 'Hyperniche AI - AI-Powered Content Generation',
    description: 'Generate SEO-optimized keywords and blogs with AI',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hyperniche AI',
    description: 'Generate SEO-optimized keywords and blogs with AI',
  },
}

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // No additional layout wrapper needed - root layout handles Providers, Toaster, etc.
  // This layout exists primarily for route organization and metadata
  return <>{children}</>
}
