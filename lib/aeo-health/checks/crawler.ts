/**
 * AI Crawler Access Checks - 4 AEO-specific checks
 *
 * Analyzes robots.txt to determine which AI crawlers can access the site:
 * - GPTBot (OpenAI/ChatGPT)
 * - Claude-Web (Anthropic)
 * - PerplexityBot (Perplexity AI)
 * - CCBot (Common Crawl - trains many LLMs)
 */

import type { CheckResult } from './technical'

interface RobotRules {
  [userAgent: string]: {
    disallow_all: boolean
    allow_all: boolean
  }
}

export function parseRobotsTxt(robotsTxt: string | null): RobotRules {
  if (!robotsTxt) return {}

  const rules: RobotRules = {}
  let currentAgents: string[] = []

  for (const line of robotsTxt.split('\n')) {
    const trimmed = line.trim()

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue

    // Parse User-agent
    if (trimmed.toLowerCase().startsWith('user-agent:')) {
      const agent = trimmed.split(':', 2)[1].trim().toLowerCase()
      currentAgents = [agent]
      if (!rules[agent]) {
        rules[agent] = { disallow_all: false, allow_all: true }
      }
    }
    // Parse Disallow
    else if (trimmed.toLowerCase().startsWith('disallow:') && currentAgents.length > 0) {
      const path = trimmed.split(':', 2)[1].trim()
      for (const agent of currentAgents) {
        if (!rules[agent]) {
          rules[agent] = { disallow_all: false, allow_all: true }
        }
        if (path === '/' || path === '/*') {
          rules[agent].disallow_all = true
          rules[agent].allow_all = false
        } else if (path) {
          rules[agent].allow_all = false
        }
      }
    }
    // Parse Allow
    else if (trimmed.toLowerCase().startsWith('allow:') && currentAgents.length > 0) {
      const path = trimmed.split(':', 2)[1].trim()
      for (const agent of currentAgents) {
        if (!rules[agent]) {
          rules[agent] = { disallow_all: false, allow_all: true }
        }
        if (path === '/' || path === '/*') {
          rules[agent].disallow_all = false
          rules[agent].allow_all = true
        }
      }
    }
  }

  return rules
}

export function isCrawlerAllowed(rules: RobotRules, crawlerName: string): boolean {
  // Check specific rule first
  if (rules[crawlerName]) {
    return !rules[crawlerName].disallow_all
  }

  // Check wildcard rule
  if (rules['*']) {
    return !rules['*'].disallow_all
  }

  // Default: allowed if no rules
  return true
}

export function runAeoCrawlerChecks(robotsTxt: string | null): CheckResult[] {
  const issues: CheckResult[] = []
  const rules = parseRobotsTxt(robotsTxt)

  // === 1. GPTBOT (OpenAI) ===
  const gptbotAllowed = isCrawlerAllowed(rules, 'gptbot')

  if (!gptbotAllowed) {
    issues.push({
      check: 'gptbot_access',
      category: 'aeo_crawler',
      passed: false,
      severity: 'error',
      message: 'GPTBot is blocked in robots.txt',
      recommendation: "Remove 'Disallow: /' for GPTBot to ensure visibility in ChatGPT",
      score_impact: 8
    })
  } else {
    issues.push({
      check: 'gptbot_access',
      category: 'aeo_crawler',
      passed: true,
      severity: 'pass',
      message: 'GPTBot (OpenAI) is allowed',
      recommendation: '',
      score_impact: 8
    })
  }

  // === 2. CLAUDE-WEB (Anthropic) ===
  const claudeAllowed =
    isCrawlerAllowed(rules, 'claudebot') &&
    isCrawlerAllowed(rules, 'claude-web') &&
    isCrawlerAllowed(rules, 'anthropic-ai')

  if (!claudeAllowed) {
    issues.push({
      check: 'claude_access',
      category: 'aeo_crawler',
      passed: false,
      severity: 'warning',
      message: 'Claude-Web/Anthropic crawler is blocked',
      recommendation: 'Remove blocks for ClaudeBot, Claude-Web, and Anthropic-AI',
      score_impact: 5
    })
  } else {
    issues.push({
      check: 'claude_access',
      category: 'aeo_crawler',
      passed: true,
      severity: 'pass',
      message: 'Claude-Web (Anthropic) is allowed',
      recommendation: '',
      score_impact: 5
    })
  }

  // === 3. PERPLEXITYBOT ===
  const perplexityAllowed = isCrawlerAllowed(rules, 'perplexitybot')

  if (!perplexityAllowed) {
    issues.push({
      check: 'perplexitybot_access',
      category: 'aeo_crawler',
      passed: false,
      severity: 'warning',
      message: 'PerplexityBot is blocked in robots.txt',
      recommendation: "Remove 'Disallow: /' for PerplexityBot",
      score_impact: 5
    })
  } else {
    issues.push({
      check: 'perplexitybot_access',
      category: 'aeo_crawler',
      passed: true,
      severity: 'pass',
      message: 'PerplexityBot is allowed',
      recommendation: '',
      score_impact: 5
    })
  }

  // === 4. CCBOT (Common Crawl) ===
  const ccbotAllowed = isCrawlerAllowed(rules, 'ccbot')

  if (!ccbotAllowed) {
    issues.push({
      check: 'ccbot_access',
      category: 'aeo_crawler',
      passed: false,
      severity: 'notice',
      message: 'CCBot (Common Crawl) is blocked',
      recommendation: 'Consider allowing CCBot - Common Crawl data trains many LLMs',
      score_impact: 4
    })
  } else {
    issues.push({
      check: 'ccbot_access',
      category: 'aeo_crawler',
      passed: true,
      severity: 'pass',
      message: 'CCBot (Common Crawl) is allowed',
      recommendation: '',
      score_impact: 4
    })
  }

  return issues
}

export function extractCrawlerSummary(robotsTxt: string | null) {
  const rules = parseRobotsTxt(robotsTxt)

  const allowed: string[] = []
  const blocked: string[] = []

  const crawlerChecks: Array<[string, string]> = [
    ['gptbot', 'GPTBot'],
    ['claudebot', 'Claude-Web'],
    ['perplexitybot', 'PerplexityBot'],
    ['ccbot', 'CCBot'],
    ['googleother', 'GoogleOther'],
  ]

  for (const [crawlerKey, crawlerName] of crawlerChecks) {
    if (isCrawlerAllowed(rules, crawlerKey)) {
      allowed.push(crawlerName)
    } else {
      blocked.push(crawlerName)
    }
  }

  return {
    robots_txt_found: robotsTxt !== null,
    ai_crawlers_allowed: allowed,
    ai_crawlers_blocked: blocked,
    wildcard_disallow: rules['*']?.disallow_all || false,
  }
}
