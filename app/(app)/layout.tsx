/**
 * App Layout - Authenticated Application Routes
 *
 * This layout is for authenticated app routes (keywords, blogs, etc.)
 * In localStorage mode, authentication is handled client-side via AuthContext.
 */

import { Nav } from '@/components/layout/nav'
import { SkipLink } from '@/components/ui/skip-link'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // In localStorage mode, authentication is handled client-side
  // The Nav component and individual pages use useAuth hook
  // to check authentication and redirect if needed

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      <SkipLink href="#main-content" />
      <Nav />
      <main
        id="main-content"
        className="flex-1 overflow-hidden pt-[92px] sm:pt-[88px] px-4 sm:px-6 lg:px-8 pb-2"
        tabIndex={-1}
      >
        <div className="h-full mx-auto max-w-[1400px] rounded-xl border-2 border-border bg-background/95 backdrop-blur-xl overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
