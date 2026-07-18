/**
 * Mutation-discriminating tests for HealthCheckPanel
 * Each test must catch a specific bug (mutant) and fail on plausible buggy implementations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { HealthCheckPanel } from '../HealthCheckPanel'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// Mock data factory
const createMockHealthCheckResponse = (overrides = {}) => ({
  success: true,
  url: 'https://test.com',
  final_url: 'https://test.com/',
  score: 45,
  grade: 'C',
  visibility_band: 'Moderate',
  visibility_color: '#eab308',
  issues: [
    {
      check: 'title_tag',
      category: 'technical',
      passed: false,
      severity: 'warning',
      message: 'Title too short',
      recommendation: 'Expand title to 30-65 characters',
      score_impact: 10
    }
  ],
  summary: {
    total_checks: 29,
    passed: 21,
    errors: 1,
    warnings: 4,
    notices: 3
  },
  metadata: {
    fetch_time_ms: 485,
    response_time_ms: 401,
    status_code: 200,
    sitemap_found: true,
    robots_txt_found: true
  },
  ...overrides
})

// MSW server setup
const server = setupServer(
  http.post('/api/aeo/health-check', () => {
    return HttpResponse.json(createMockHealthCheckResponse())
  })
)

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' })
  vi.clearAllMocks()
})

afterEach(() => {
  server.resetHandlers()
  server.close()
})

// Helper to run health check
const runHealthCheck = async (url: string) => {
  const user = userEvent.setup()
  const input = screen.getByLabelText(/Website URL/i)
  await user.clear(input)
  await user.type(input, url)
  await user.click(screen.getByRole('button', { name: /Run Health Check/i }))
}

describe('HealthCheckPanel - Negative Tests', () => {

  it('MUTANT: API returns 500 error - catches missing response.ok check', async () => {
    // BUG CAUGHT: Forgetting to check response.ok before calling .json()
    // EXPECTED: Component should handle error gracefully
    server.use(
      http.post('/api/aeo/health-check', () => {
        return HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
      })
    )

    render(<HealthCheckPanel />)
    await runHealthCheck('https://test.com')

    await waitFor(() => {
      expect(screen.queryByText(/Internal server error|Health check failed/i)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Results should NOT render on error
    expect(screen.queryByText(/Health Check Results/i)).not.toBeInTheDocument()
  })

  it('MUTANT: API returns invalid JSON - catches missing JSON parse error handling', async () => {
    // BUG CAUGHT: No try-catch around response.json()
    // EXPECTED: Component should show error message
    server.use(
      http.post('/api/aeo/health-check', () => {
        return new HttpResponse('This is not JSON', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )

    render(<HealthCheckPanel />)
    await runHealthCheck('https://test.com')

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('MUTANT: Empty URL submitted - catches missing URL validation', async () => {
    // BUG CAUGHT: Not validating !url.trim() before API call
    // EXPECTED: Button should be disabled, no API call made
    const apiCallSpy = vi.fn()
    server.use(
      http.post('/api/aeo/health-check', () => {
        apiCallSpy()
        return HttpResponse.json(createMockHealthCheckResponse())
      })
    )

    render(<HealthCheckPanel />)
    const button = screen.getByRole('button', { name: /Run Health Check/i })

    // Button should be disabled when URL is empty
    expect(button).toBeDisabled()

    // Even if we somehow click it, no API call should happen
    expect(apiCallSpy).not.toHaveBeenCalled()
  })
})

describe('HealthCheckPanel - Boundary Tests', () => {

  it('MUTANT: Score exactly 0 - catches score === 0 treated as falsy', async () => {
    // BUG CAUGHT: Using if (score) instead of if (score !== undefined)
    // EXPECTED: Should display 0.0 with correct red color
    server.use(
      http.post('/api/aeo/health-check', () => {
        return HttpResponse.json(createMockHealthCheckResponse({
          score: 0,
          grade: 'F'
        }))
      })
    )

    render(<HealthCheckPanel />)
    await runHealthCheck('https://test.com')

    await waitFor(() => {
      const scoreElement = screen.getByText('0.0')
      expect(scoreElement).toBeInTheDocument()
      expect(scoreElement).toHaveClass('text-red-600')
    }, { timeout: 5000 })
  })

  it('MUTANT: Score exactly 100 - catches off-by-one in >= comparisons', async () => {
    // BUG CAUGHT: Using score > 90 instead of score >= 90
    // EXPECTED: Should display 100.0 with green color
    server.use(
      http.post('/api/aeo/health-check', () => {
        return HttpResponse.json(createMockHealthCheckResponse({
          score: 100,
          grade: 'A+'
        }))
      })
    )

    render(<HealthCheckPanel />)
    await runHealthCheck('https://test.com')

    await waitFor(() => {
      const scoreElement = screen.getByText('100.0')
      expect(scoreElement).toBeInTheDocument()
      expect(scoreElement).toHaveClass('text-green-600')
    }, { timeout: 5000 })
  })

  it('MUTANT: Empty issues array - catches missing array guard', async () => {
    // BUG CAUGHT: Calling .reduce() or .map() without checking array.length
    // EXPECTED: Should show results but no accordion items
    server.use(
      http.post('/api/aeo/health-check', () => {
        return HttpResponse.json(createMockHealthCheckResponse({ issues: [] }))
      })
    )

    render(<HealthCheckPanel />)
    await runHealthCheck('https://test.com')

    await waitFor(() => {
      expect(screen.getByText(/Health Check Results/i)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Accordion should not render when issues array is empty
    expect(screen.queryByRole('button', { name: /technical/i })).not.toBeInTheDocument()
  })
})

describe('HealthCheckPanel - Weird Input Tests', () => {

  it('MUTANT: URL with unicode/emoji - catches URL encoding bugs', async () => {
    // BUG CAUGHT: Improper URL validation or encoding
    // EXPECTED: Should handle unicode characters in URL
    const weirdUrl = 'https://test.com/path/émojis/🚀/中文'

    server.use(
      http.post('/api/aeo/health-check', async ({ request }) => {
        const body = await request.json() as { url: string }
        // Verify the URL was passed correctly
        expect(body.url).toBe(weirdUrl)
        return HttpResponse.json(createMockHealthCheckResponse())
      })
    )

    render(<HealthCheckPanel />)
    await runHealthCheck(weirdUrl)

    await waitFor(() => {
      expect(screen.getByText(/Health Check Results/i)).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('MUTANT: API returns null fields - catches missing null checks', async () => {
    // BUG CAUGHT: Not checking if (recommendation) before rendering
    // EXPECTED: Should handle null recommendation gracefully
    server.use(
      http.post('/api/aeo/health-check', () => {
        return HttpResponse.json(createMockHealthCheckResponse({
          final_url: null,
          issues: [{
            check: 'test_check',
            category: 'technical',
            passed: false,
            severity: 'error',
            message: 'Test error message',
            recommendation: null, // NULL FIELD
            score_impact: 10
          }]
        }))
      })
    )

    render(<HealthCheckPanel />)
    await runHealthCheck('https://test.com')

    await waitFor(() => {
      // Should render message without crashing on null recommendation
      expect(screen.getByText(/Test error message/i)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Recommendation icon (💡) should not appear
    expect(screen.queryByText(/💡/)).not.toBeInTheDocument()
  })
})

describe('HealthCheckPanel - Regression Tests', () => {

  it('MUTANT: Results show immediately even if runningStatus not "complete"', async () => {
    // BUG: Original code used {result && runningStatus === 'complete'}
    // FIXED: Now uses just {result &&}
    // EXPECTED: Results display as soon as data exists, regardless of exact timing
    server.use(
      http.post('/api/aeo/health-check', async () => {
        // Simulate response arriving before state fully updates
        return HttpResponse.json(createMockHealthCheckResponse())
      })
    )

    render(<HealthCheckPanel />)
    await runHealthCheck('https://test.com')

    // Results should appear even if state transitions are still happening
    await waitFor(() => {
      expect(screen.getByText(/Health Check Results/i)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Verify actual results content is visible
    expect(screen.getByText(/45\.0/)).toBeInTheDocument()
    expect(screen.getByText(/Grade C/i)).toBeInTheDocument()
  })
})

describe('HealthCheckPanel - Type Safety Tests', () => {

  it('MUTANT: Score is NaN - catches missing isNaN check', async () => {
    // BUG CAUGHT: Not validating score is a valid number
    // EXPECTED: Should handle NaN gracefully with fallback color
    server.use(
      http.post('/api/aeo/health-check', () => {
        return HttpResponse.json(createMockHealthCheckResponse({
          score: NaN
        }))
      })
    )

    render(<HealthCheckPanel />)
    await runHealthCheck('https://test.com')

    // Should show error due to validation failing
    await waitFor(() => {
      expect(screen.getByText(/Invalid response format/i)).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('MUTANT: Missing required fields - catches incomplete response validation', async () => {
    // BUG CAUGHT: Not validating all required fields exist
    // EXPECTED: Should throw validation error
    server.use(
      http.post('/api/aeo/health-check', () => {
        return HttpResponse.json({
          success: true,
          url: 'https://test.com',
          // Missing: score, grade, issues, summary
        })
      })
    )

    render(<HealthCheckPanel />)
    await runHealthCheck('https://test.com')

    await waitFor(() => {
      expect(screen.getByText(/Invalid response format/i)).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('MUTANT: Mixed-case categories - catches category normalization bug', async () => {
    // BUG CAUGHT: Not normalizing category names to lowercase
    // EXPECTED: Should group same categories regardless of casing
    server.use(
      http.post('/api/aeo/health-check', () => {
        return HttpResponse.json(createMockHealthCheckResponse({
          issues: [
            { check: 'check1', category: 'Technical', passed: true, severity: 'pass', message: 'Test 1', recommendation: '', score_impact: 5 },
            { check: 'check2', category: 'technical', passed: false, severity: 'error', message: 'Test 2', recommendation: '', score_impact: 10 }
          ]
        }))
      })
    )

    render(<HealthCheckPanel />)
    await runHealthCheck('https://test.com')

    await waitFor(async () => {
      // Should have only ONE technical accordion (not two)
      const technicalButtons = screen.getAllByText(/technical/i)
      // Filter to only accordion triggers (buttons)
      const accordionTriggers = technicalButtons.filter(el => el.closest('button'))
      expect(accordionTriggers.length).toBe(1)
    }, { timeout: 5000 })
  })
})
