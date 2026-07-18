/**
 * Health check endpoint for monitoring service availability.
 * Reports whether the production Supabase configuration is available without
 * exposing any credentials.
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const startTime = Date.now()
  const checks: Record<string, { status: 'ok' | 'error'; message?: string; duration?: number }> = {}
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  checks.environment = {
    status: supabaseConfigured ? 'ok' : 'error',
    message: supabaseConfigured
      ? 'Supabase authentication is configured'
      : 'Supabase environment variables are missing',
  }

  checks.database = {
    status: supabaseConfigured ? 'ok' : 'error',
    message: supabaseConfigured
      ? 'Supabase client configuration is available'
      : 'Database client is not configured',
  }

  const totalDuration = Date.now() - startTime

  return NextResponse.json(
    {
      status: supabaseConfigured ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || 'unknown',
      mode: supabaseConfigured ? 'supabase-auth' : 'localStorage-auth',
      checks,
      duration: totalDuration,
    },
    { status: supabaseConfigured ? 200 : 503 }
  )
}
