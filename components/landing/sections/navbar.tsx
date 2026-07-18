// ABOUTME: Sticky navbar for HyperNiche AI landing page
// ABOUTME: Logo, nav links, and auth-aware CTA (supports waitlist mode)

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { WaitlistCTA } from "@/components/waitlist/WaitlistCTA";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#use-cases", label: "Use Cases" },
  { href: "/pricing", label: "Pricing" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient();
        if (!supabase) return;
        const { data: { user } } = await supabase.auth.getUser();
        setIsSignedIn(!!user);
      } catch {
        // Ignore auth errors on landing page
      }
    }
    checkAuth();
  }, []);

  // For anchor links, prepend "/" if not on home page
  const getHref = (href: string) => {
    if (href.startsWith("#")) {
      return isHomePage ? href : `/${href}`;
    }
    return href;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6" aria-label="Main navigation">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg" aria-label="HyperNiche AI - Go to homepage">
          <Image
            src="/logo.svg"
            alt="HyperNiche AI"
            width={32}
            height={32}
            priority
          />
          <span className="bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 bg-clip-text text-transparent">HyperNiche</span>
          <span className="font-medium text-foreground">AI</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6" role="navigation" aria-label="Desktop navigation links">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={getHref(link.href)}
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          {isSignedIn ? (
            <Button asChild size="sm" className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
              <Link href="/context">Dashboard</Link>
            </Button>
          ) : (
            <>
              <WaitlistCTA
                href="/auth"
                variant="ghost"
                size="sm"
                source="navbar-signin"
              >
                Sign In
              </WaitlistCTA>
              <WaitlistCTA
                href="/auth"
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                source="navbar-cta"
              >
                Get Started
              </WaitlistCTA>
            </>
          )}
        </div>

        {/* Mobile: Theme + Menu Toggle */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button
            className="p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden absolute top-14 left-0 right-0 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={getHref(link.href)}
                className={`text-sm py-2 ${
                  pathname === link.href
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <hr className="border-border/50 my-2" />
            {isSignedIn ? (
              <Button asChild className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
                <Link href="/context">Dashboard</Link>
              </Button>
            ) : (
              <WaitlistCTA
                href="/auth"
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                source="navbar-mobile"
              >
                Get Started
              </WaitlistCTA>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

