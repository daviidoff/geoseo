/**
 * Scoring Module v4.0 - Tiered Objective AEO Scoring
 *
 * v4.0 Overhaul: Hierarchical gated scoring based on AEO reality.
 *
 * The AEO funnel:
 * 1. CAN AI ACCESS? → If blocked, nothing else matters
 * 2. CAN AI UNDERSTAND? → Schema.org is essential for entity recognition
 * 3. IS CONTENT STRUCTURED? → Technical SEO for content extraction
 * 4. IS IT TRUSTWORTHY? → Authority signals for citation confidence
 *
 * Tier 0: CRITICAL (Gate) - Blocks ALL AI crawlers → Max score = 10
 * Tier 1: ESSENTIAL (Floor) - No Organization schema → Max score = 50
 * Tier 2: IMPORTANT (Ceiling) - Incomplete schema → Max score = 80
 * Tier 3: EXCELLENCE - Full optimization → Score up to 100
 */

import type { CheckResult } from '../checks/technical'

export interface TierResult {
  passed: boolean
  cap: number
  reason: string
}

export interface TierDetails {
  tier0: TierResult
  tier1: TierResult
  tier2: TierResult
  base_score: number
  limiting_tier: string
  limiting_reason: string
}

function evaluateTier0Critical(issues: CheckResult[]): TierResult {
  // Check AI crawler access
  const aiCrawlerChecks = ['gptbot_access', 'claude_access', 'perplexitybot_access', 'ccbot_access']
  const blockedCrawlers = issues.filter(
    issue => aiCrawlerChecks.includes(issue.check) && !issue.passed
  )

  // If ALL 4 major AI crawlers are blocked
  if (blockedCrawlers.length >= 4) {
    return { passed: false, cap: 10, reason: 'Blocks all AI crawlers - invisible to AI' }
  }

  // If 3 blocked (most AI can't access)
  if (blockedCrawlers.length >= 3) {
    return { passed: false, cap: 25, reason: `Blocks most AI crawlers (${blockedCrawlers.length}/4)` }
  }

  // Check for noindex directive
  for (const issue of issues) {
    if (issue.check === 'robots_meta') {
      const message = issue.message.toLowerCase()
      if (message.includes('noindex') && !issue.passed) {
        return { passed: false, cap: 5, reason: "Has noindex - won't be indexed by AI" }
      }
    }
  }

  return { passed: true, cap: 100, reason: 'AI can access site' }
}

function evaluateTier1Essential(issues: CheckResult[]): TierResult {
  let hasOrgSchema = false
  let hasTitle = false
  let hasHttps = false

  for (const issue of issues) {
    const message = issue.message.toLowerCase()

    if (issue.check === 'org_schema_completeness') {
      if (!message.includes('no organization schema')) {
        hasOrgSchema = true
      }
    } else if (issue.check === 'title_tag') {
      if (!message.includes('missing title')) {
        hasTitle = true
      }
    } else if (issue.check === 'https' && issue.passed) {
      hasHttps = true
    }
  }

  const missing: string[] = []
  if (!hasOrgSchema) missing.push('Organization schema')
  if (!hasTitle) missing.push('title tag')
  if (!hasHttps) missing.push('HTTPS')

  if (!hasOrgSchema) {
    return { passed: false, cap: 45, reason: "Missing Organization schema - AI can't identify entity" }
  }

  if (missing.length > 0) {
    return { passed: false, cap: 55, reason: `Missing essentials: ${missing.join(', ')}` }
  }

  return { passed: true, cap: 100, reason: 'Has essential elements' }
}

function evaluateTier2Important(issues: CheckResult[]): TierResult {
  let orgComplete = false
  let orgPartial = false
  let hasMetaDesc = false
  let goodContent = false
  let hasSameas = false

  for (const issue of issues) {
    const message = issue.message

    if (issue.check === 'org_schema_completeness') {
      if (!message.toLowerCase().includes('no organization schema')) {
        orgPartial = true
        // Check completeness percentage
        const match = message.match(/(\d+)%/)
        if (match) {
          const completeness = parseInt(match[1])
          if (completeness >= 70) {
            orgComplete = true
          }
        }
      }
    } else if (issue.check === 'meta_description') {
      if (!message.toLowerCase().includes('missing')) {
        hasMetaDesc = true
      }
    } else if (issue.check === 'content_word_count' && issue.passed) {
      goodContent = true
    } else if (issue.check === 'sameas_links' && issue.passed) {
      hasSameas = true
    }
  }

  const criticalIssues: string[] = []
  const importantIssues: string[] = []
  const minorIssues: string[] = []

  if (orgPartial && !orgComplete) {
    importantIssues.push('incomplete Organization schema')
  }

  if (!hasSameas) {
    importantIssues.push('no sameAs links')
  }

  if (!hasMetaDesc) {
    minorIssues.push('no meta description')
  }

  if (!goodContent) {
    minorIssues.push('thin content')
  }

  // Calculate cap
  if (criticalIssues.length > 0) {
    return { passed: false, cap: 70, reason: `Critical: ${criticalIssues.join(', ')}` }
  } else if (importantIssues.length >= 2) {
    return { passed: false, cap: 75, reason: `Issues: ${importantIssues.join(', ')}` }
  } else if (importantIssues.length === 1) {
    return { passed: false, cap: 85, reason: `Issue: ${importantIssues[0]}` }
  } else if (minorIssues.length >= 2) {
    return { passed: false, cap: 90, reason: `Minor issues: ${minorIssues.join(', ')}` }
  } else if (minorIssues.length === 1) {
    return { passed: false, cap: 95, reason: `Minor: ${minorIssues[0]}` }
  }

  return { passed: true, cap: 100, reason: 'Excellent AEO optimization' }
}

function calculateBaseScore(issues: CheckResult[]): number {
  let totalImpact = 0
  let earnedImpact = 0

  for (const issue of issues) {
    const impact = issue.score_impact || 5
    totalImpact += impact

    if (issue.passed) {
      earnedImpact += impact
    } else if (issue.severity === 'notice') {
      earnedImpact += impact * 0.7
    } else if (issue.severity === 'warning') {
      earnedImpact += impact * 0.3
    }
    // Errors get 0 credit
  }

  if (totalImpact > 0) {
    return (earnedImpact / totalImpact) * 100
  }
  return 0.0
}

export function calculateTieredScore(issues: CheckResult[]): [number, TierDetails] {
  // Evaluate each tier
  const tier0 = evaluateTier0Critical(issues)
  const tier1 = evaluateTier1Essential(issues)
  const tier2 = evaluateTier2Important(issues)

  // Calculate base score from checks
  const baseScore = calculateBaseScore(issues)

  // Final score is capped by all tiers
  const finalScore = Math.min(tier0.cap, tier1.cap, tier2.cap, baseScore)

  // Determine which tier is limiting the score
  let limitingTier = 'base'
  let limitingReason = 'Check performance'

  if (tier0.cap <= finalScore + 1) {
    limitingTier = 'tier0'
    limitingReason = tier0.reason
  } else if (tier1.cap <= finalScore + 1) {
    limitingTier = 'tier1'
    limitingReason = tier1.reason
  } else if (tier2.cap <= finalScore + 1) {
    limitingTier = 'tier2'
    limitingReason = tier2.reason
  }

  const tierDetails: TierDetails = {
    tier0,
    tier1,
    tier2,
    base_score: Math.round(baseScore * 10) / 10,
    limiting_tier: limitingTier,
    limiting_reason: limitingReason,
  }

  return [Math.round(finalScore * 10) / 10, tierDetails]
}

export function calculateOverallScore(issues: CheckResult[]): number {
  const [score] = calculateTieredScore(issues)
  return score
}

export function calculateGrade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 65) return 'B'
  if (score >= 45) return 'C'
  if (score >= 25) return 'D'
  return 'F'
}

export function calculateVisibilityBand(score: number): [string, string] {
  if (score >= 80) return ['Excellent', '#22c55e']
  if (score >= 65) return ['Strong', '#84cc16']
  if (score >= 45) return ['Moderate', '#eab308']
  if (score >= 25) return ['Weak', '#f97316']
  return ['Critical', '#ef4444']
}

export function countIssuesBySeverity(issues: CheckResult[]) {
  const counts = {
    passed: 0,
    errors: 0,
    warnings: 0,
    notices: 0,
  }

  for (const issue of issues) {
    const severity = issue.severity || 'notice'
    if (severity === 'pass') {
      counts.passed++
    } else if (severity === 'error') {
      counts.errors++
    } else if (severity === 'warning') {
      counts.warnings++
    } else if (severity === 'notice') {
      counts.notices++
    }
  }

  return counts
}
