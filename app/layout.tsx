import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'
import { CookieConsent } from '@/components/ui/cookie-consent'

export const metadata: Metadata = {
  title: {
    default: 'HyperNiche AI — Dominate Your Niche in AI Search',
    template: '%s | HyperNiche AI',
  },
  description: 'Dominate your niche in AI search. Rank in ChatGPT, Perplexity & Claude. AEO-optimized content in minutes, no technical skills needed.',
  keywords: ['AEO', 'Answer Engine Optimization', 'AI visibility', 'AI search', 'ChatGPT SEO', 'Perplexity optimization', 'AI content strategy', 'keyword research'],
  authors: [{ name: 'SCAILE' }],
  creator: 'SCAILE',
  publisher: 'SCAILE',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://aeo.scaile.tech'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'HyperNiche AI',
    title: 'HyperNiche AI — Dominate Your Niche in AI Search',
    description: 'Dominate your niche in AI search. Rank in ChatGPT, Perplexity & Claude. Set up in 5 minutes.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'HyperNiche AI — Dominate Your Niche in AI Search',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HyperNiche AI — Dominate Your Niche in AI Search',
    description: 'Dominate your niche in AI search. Rank in ChatGPT, Perplexity & Claude. Set up in 5 minutes.',
    images: ['/og-image.svg'],
    creator: '@scailetech',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-icon.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
  },
      manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
        <Toaster
          position="top-center"
          closeButton
          duration={4000}
          visibleToasts={3}
          gap={8}
          toastOptions={{
            className: [
              'border border-border/50 bg-card/95 backdrop-blur-md text-foreground',
              'shadow-lg shadow-black/5 dark:shadow-black/20',
              'rounded-xl px-4 py-3',
              'animate-in fade-in-0 slide-in-from-top-4 zoom-in-95 duration-300',
            ].join(' '),
            style: {
              '--toast-close-button-start': '0.75rem',
            } as React.CSSProperties,
          }}
        />
        <CookieConsent />
        {/* Live region for screen reader announcements */}
        <div
          id="live-region"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />
        <div
          id="live-region-assertive"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          className="sr-only"
        />
      </body>
    </html>
  )
}
