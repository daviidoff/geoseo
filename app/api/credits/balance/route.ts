/**
 * ABOUTME: Legacy credits balance API - redirects to usage-based billing
 * ABOUTME: Kept for backwards compatibility, returns usage data
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest): Promise<Response> {
  // Redirect to the new billing/balance endpoint
  const url = new URL(request.url)
  url.pathname = '/api/billing/balance'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(url.toString(), {
      headers: request.headers,
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Credits] Fetch error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch balance' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    clearTimeout(timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Balance fetch timeout' }, { status: 504 })
    }
    throw error
  }
}
