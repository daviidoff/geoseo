'use client'

import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  href?: string
}

export function Logo({ className = '', showText = true, size = 'md', href = '/' }: LogoProps) {
  const logoSizeMap = {
    sm: 28,
    md: 36,
    lg: 44,
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  const logoSize = logoSizeMap[size]

  return (
    <Link
      href={href}
      className={`group flex items-center gap-2.5 transition-all hover:opacity-90 flex-shrink-0 ${className}`}
    >
      <div className="group-hover:scale-105 transition-transform">
        <Image
          src="/logo.svg"
          alt="HyperNiche AI"
          width={logoSize}
          height={logoSize}
          priority
          className="flex-shrink-0"
        />
      </div>
      {showText && (
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          <span className={`font-bold tracking-tight ${textSizeClasses[size]} bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 bg-clip-text text-transparent whitespace-nowrap`}>
            HyperNiche
          </span>
          <span className={`font-medium ${textSizeClasses[size]} text-muted-foreground whitespace-nowrap`}>
            AI
          </span>
        </div>
      )}
    </Link>
  )
}


