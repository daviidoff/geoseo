/**
 * ABOUTME: Main navigation header component for authenticated pages
 * ABOUTME: Shows app title, navigation links, user email, and sign out button
 * ABOUTME: Uses AuthContext for localStorage-based authentication
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, Moon, Sun, Monitor, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/Logo'
import { useTheme } from 'next-themes'
import { useMobile } from '@/hooks/useMobile'
import { CreditBalance } from '@/components/billing/CreditBalance'

// Custom hook to safely use navigation hooks
function useClientNavigation() {
  const [router, setRouter] = useState<any>(null)
  const pathname = usePathname()

  useEffect(() => {
    // Use window.location for navigation instead of Next.js hooks to avoid context issues
    if (typeof window !== 'undefined') {
      // Create a mock router that uses window.location
      const mockRouter = {
        push: (url: string) => {
          window.location.href = url
        },
        refresh: () => {
          window.location.reload()
        }
      }

      setRouter(mockRouter)
    }
  }, [])

  return { router, pathname }
}

export function Nav() {
  const [hasMounted, setHasMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { userEmail, userAvatar, signOut } = useAuth()
  const { router, pathname } = useClientNavigation()
  const { isMobile, isTablet } = useMobile()
  const isMobileOrTablet = isMobile || isTablet

  // Prevent hydration mismatch for CSS transitions
  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    try {
      // Use AuthContext signOut for localStorage-based auth
      await signOut()
      // signOut already redirects to home page
    } catch (err) {
      console.error('Failed to sign out:', err)
      // Force redirect to home page on error
      window.location.href = '/'
    }
  }

  // Navigation flow: CONTEXT → KEYWORDS → BLOGS → ANALYTICS → HISTORY
  const navLinks = [
    { href: '/context', label: 'CONTEXT', isGeneration: false },
    { href: '/keywords', label: 'KEYWORDS', isGeneration: true },
    { href: '/blogs', label: 'BLOGS', isGeneration: true },
    { href: '/analytics', label: 'ANALYTICS', isGeneration: true },
    { href: '/history', label: 'HISTORY', isGeneration: false },
  ]

  // Helper function to check if a link is active (including sub-routes)
  const isLinkActive = (linkHref: string): boolean => {
    if (pathname === linkHref) return true
    return pathname.startsWith(linkHref + '/')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pt-2 sm:pt-4">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="bg-background/95 backdrop-blur-xl border-2 border-foreground/20 rounded-xl">
          <div className="flex h-16 sm:h-14 items-center justify-center gap-2 px-4 sm:px-6 relative">
          {/* Left Side: Logo + Mobile Menu */}
          <div className="flex items-center gap-3 flex-shrink-0 absolute left-4 sm:left-6">
            {/* Mobile/Tablet: Hamburger Menu Button */}
            {isMobileOrTablet && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-9 w-9"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            )}
            <Logo size="sm" href={pathname || '/context'} />
          </div>

          {/* Desktop: Centered Navigation Links */}
          {!isMobileOrTablet && (
            <nav className="flex items-center justify-center" aria-label="Main navigation">
              <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 border border-foreground/10 shadow-sm relative h-10 sm:h-9">
                {navLinks.map((link) => {
                  const isActive = isLinkActive(link.href)
                  const isGeneration = link.isGeneration
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      prefetch={true}
                      className={cn(
                        'relative px-5 h-9 sm:h-8 text-sm font-medium transition-all duration-200 rounded-md z-10',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        'flex items-center justify-center whitespace-nowrap',
                        isActive
                          ? 'text-foreground font-semibold'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {isActive && (
                        <div className="absolute inset-0 bg-background border border-foreground/20 shadow-sm rounded-md transition-all duration-200" />
                      )}
                      <span className="relative z-10">{link.label}</span>
                    </Link>
                  )
                })}
              </div>
            </nav>
          )}

          {/* Right Side Actions - Positioned on right */}
          <div className="flex items-center justify-end flex-shrink-0 absolute right-4 sm:right-6">
            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-lg transition-all hover:bg-accent/50 border border-transparent hover:border-border/40 p-0"
                  data-testid="user-menu-button"
                  aria-label="User menu"
                  aria-haspopup="true"
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt="Profile"
                      className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg object-cover border border-border/40 grayscale"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                      <span className="text-lg" role="img" aria-label="Profile">🤖</span>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 shadow-lg border-border/50">
                <DropdownMenuLabel>
                  <div className="flex items-center gap-3 py-2">
                    {userAvatar ? (
                      <img
                        src={userAvatar}
                        alt="Profile"
                        className="w-10 h-10 rounded-lg object-cover border border-border/40 grayscale"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                        <span className="text-xl" role="img" aria-label="Profile">🤖</span>
                      </div>
                    )}
                    <div className="flex flex-col space-y-0.5 flex-1 min-w-0">
                      <p className="text-sm font-semibold">My Account</p>
                      {userEmail && (
                        <p className="text-xs text-muted-foreground truncate">
                          {userEmail}
                        </p>
                      )}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Usage Display */}
                <div className="px-3 py-2">
                  <CreditBalance compact={true} showCard={false} showUpgradeButton={false} />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault()
                    if (router) {
                      router.push('/profile')
                    }
                  }}
                  className="cursor-pointer py-2.5"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span className="text-sm">Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Theme switcher with sliding indicator */}
                <div className="px-3 py-2.5">
                  <div className="relative flex items-center p-1 bg-muted rounded-xl border border-border/50">
                    {/* Sliding indicator */}
                    <div
                      className={cn(
                        "absolute top-1 bottom-1 w-[calc(33.333%-2px)] rounded-lg shadow-sm border border-border/30 transition-all duration-300 ease-out",
                        "bg-gradient-to-b from-background to-background/90"
                      )}
                      style={{
                        left: theme === 'light' ? '4px' : theme === 'dark' ? 'calc(33.333% + 2px)' : 'calc(66.666%)',
                      }}
                    />
                    {/* Light */}
                    <button
                      onClick={() => setTheme('light')}
                      className={cn(
                        "relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition-all duration-200",
                        theme === 'light'
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground/70'
                      )}
                      aria-label="Light mode"
                    >
                      <Sun className={cn("h-3.5 w-3.5 transition-transform", theme === 'light' && "text-amber-500")} />
                      <span className="text-[11px] font-medium">Light</span>
                    </button>
                    {/* Dark */}
                    <button
                      onClick={() => setTheme('dark')}
                      className={cn(
                        "relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition-all duration-200",
                        theme === 'dark'
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground/70'
                      )}
                      aria-label="Dark mode"
                    >
                      <Moon className={cn("h-3.5 w-3.5 transition-transform", theme === 'dark' && "text-blue-400")} />
                      <span className="text-[11px] font-medium">Dark</span>
                    </button>
                    {/* System */}
                    <button
                      onClick={() => setTheme('system')}
                      className={cn(
                        "relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition-all duration-200",
                        theme === 'system'
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground/70'
                      )}
                      aria-label="System theme"
                    >
                      <Monitor className={cn("h-3.5 w-3.5 transition-transform", theme === 'system' && "text-primary")} />
                      <span className="text-[11px] font-medium">Auto</span>
                    </button>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault()
                    handleSignOut()
                  }}
                  className="cursor-pointer text-destructive focus:text-destructive py-2.5"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span className="text-sm font-medium">Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Menu Overlay */}
      {isMobileOrTablet && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl lg:hidden">
          <div className="flex flex-col h-full pt-20 px-4">
            <div className="flex items-center justify-between mb-6">
              <Logo size="sm" href={pathname || '/context'} />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="h-9 w-9"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => {
                const isActive = isLinkActive(link.href)
                const isGeneration = link.isGeneration
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'px-4 py-3 rounded-lg text-base font-medium transition-all',
                      'flex items-center justify-between',
                      isActive
                        ? 'bg-background border border-foreground/20 shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span>{link.label}</span>
                    {isActive && <span className="text-xs">●</span>}
                  </Link>
                )
              })}
            </nav>
            <div className="mt-auto pt-6 border-t border-border">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt="Profile"
                      className="w-8 h-8 rounded-lg object-cover border border-border/40 grayscale"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                      <span className="text-base" role="img" aria-label="Profile">🤖</span>
                    </div>
                  )}
                  {userEmail && (
                    <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {userEmail}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
