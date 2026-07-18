// ABOUTME: Footer section for HyperNiche AI landing page
// ABOUTME: Logo, links, and copyright

import Link from "next/link";
import Image from "next/image";

export function FooterSection() {
  return (
    <footer className="border-t border-border/50 bg-secondary/30 py-12">
      <div className="container mx-auto px-4">
        {/* Vision statement - centered above footer content */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted-foreground italic">
            Democratizing AI visibility for everyone.
          </p>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="HyperNiche AI"
              width={28}
              height={28}
            />
            <span className="text-xl font-bold bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 bg-clip-text text-transparent">HyperNiche</span>
            <span className="text-xl font-medium text-foreground">AI</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} HyperNiche AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}




