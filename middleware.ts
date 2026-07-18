import { type NextRequest, NextResponse } from "next/server"
import { createMiddlewareClient } from "@/lib/supabase/middleware"

/**
 * Request logging for production monitoring
 * Only logs API requests to avoid noise
 */
function logRequest(request: NextRequest, startTime: number, status: number) {
  // Only log in production and only for API routes
  if (process.env.NODE_ENV !== 'production') return
  if (!request.nextUrl.pathname.startsWith('/api')) return

  const duration = Date.now() - startTime
  const log = {
    method: request.method,
    path: request.nextUrl.pathname,
    status,
    duration: `${duration}ms`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
    userAgent: request.headers.get('user-agent')?.slice(0, 100) || 'unknown',
    timestamp: new Date().toISOString(),
  }

  // Use structured logging for production log aggregators
  console.log(JSON.stringify({ type: 'request', ...log }))
}

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/auth",
  "/auth/callback",
  "/auth/verify",
  "/auth/reset-password",
  "/pricing",
  "/privacy",
  "/terms",
  "/review",
  "/api/auth",
  "/api/review",
  "/api/webhooks",
  "/api/health",
  "/api/stripe/webhook",
]

// Routes that should be accessible without auth (static assets, etc.)
const STATIC_ROUTES = [
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]

function isPublicRoute(pathname: string): boolean {
  // Check exact matches and prefixes
  return PUBLIC_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + "/")
  )
}

function isStaticRoute(pathname: string): boolean {
  return STATIC_ROUTES.some(route => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  const startTime = Date.now()
  const { pathname } = request.nextUrl

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/auth", request.url))
  }

  // Skip static assets
  if (isStaticRoute(pathname)) {
    return NextResponse.next()
  }

  // Skip file extensions (images, etc.)
  if (pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)) {
    return NextResponse.next()
  }

  // DEV_MODE bypass - skip auth entirely during development
  if (process.env.NEXT_PUBLIC_DEV_MODE === "true") {
    logRequest(request, startTime, 200)
    return NextResponse.next()
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    logRequest(request, startTime, 200)
    return NextResponse.next()
  }

  // Check authentication for protected routes
  const { client, response } = await createMiddlewareClient(request)

  // If Supabase not configured, allow through (fall back to app-level checks)
  if (!client) {
    logRequest(request, startTime, 200)
    return NextResponse.next()
  }

  // Refresh session if exists
  const { data: { user }, error } = await client.auth.getUser()

  // If no user and trying to access protected route, redirect to auth
  if (!user || error) {
    const redirectUrl = new URL("/auth", request.url)
    redirectUrl.searchParams.set("returnUrl", pathname)
    logRequest(request, startTime, 302)
    return NextResponse.redirect(redirectUrl)
  }

  logRequest(request, startTime, 200)
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
