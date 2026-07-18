/**
 * ABOUTME: Logo strips for social proof on landing page
 * ABOUTME: AI platforms we optimize for + Trusted by clients
 */

'use client'

// AI Platform logos - shows which AI search engines we optimize for
const AI_PLATFORMS = [
  { name: 'ChatGPT', icon: '🤖' },
  { name: 'Perplexity', icon: '🔍' },
  { name: 'Claude', icon: '🧠' },
  { name: 'Gemini', icon: '✨' },
]

// Trusted by clients from SCAILE
const TRUSTED_BY = [
  { name: 'Parto', logo: '🚀' },
  { name: 'Building Radar', logo: '🏗️' },
  { name: 'Impossible Cloud', logo: '☁️' },
]

export function AIPlatformsStrip() {
  return (
    <div className="py-6 border-b border-border/30">
      <div className="container mx-auto px-4">
        <p className="text-xs text-muted-foreground text-center mb-4 uppercase tracking-wider">
          Optimize for AI Search Engines
        </p>
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
          {AI_PLATFORMS.map((platform) => (
            <div
              key={platform.name}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="text-xl opacity-70">{platform.icon}</span>
              <span className="text-sm font-medium">{platform.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TrustedByStrip() {
  return (
    <div className="py-8 bg-muted/30 border-y border-border/30">
      <div className="container mx-auto px-4">
        <p className="text-xs text-muted-foreground text-center mb-6 uppercase tracking-wider">
          Trusted by innovative companies
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
          {TRUSTED_BY.map((company) => (
            <div
              key={company.name}
              className="flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <span className="text-2xl">{company.logo}</span>
              <span className="text-sm font-semibold tracking-tight">{company.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
