/**
 * ABOUTME: Health check endpoint (localStorage-based auth)
 * ABOUTME: No database checks - returns healthy in local mode
 *
 * Health check endpoint for monitoring service availability
 * Used by monitoring services (UptimeRobot, Pingdom, etc.)
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const startTime = Date.now()
  const checks: Record<string, { status: 'ok' | 'error'; message?: string; duration?: number }> = {}

  // Check environment variables (simplified - no Supabase required)
  checks.environment = {
    status: 'ok',
    message: 'Running in localStorage auth mode (no database)',
  }

  // No database checks - we're in local mode
  checks.database = {
    status: 'ok',
    message: 'Local mode - no database required',
  }

  const totalDuration = Date.now() - startTime

  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || 'unknown',
      mode: 'localStorage-auth',
      checks,
      duration: totalDuration,
    },
    { status: 200 }
  )
}

