/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for optimized production builds
  output: 'standalone',

  eslint: {
    // Don't fail build on ESLint errors in production
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't fail build on TypeScript errors in production (temporary for deployment)
    ignoreBuildErrors: true,
  },
  // Optimize build for Render free tier
  productionBrowserSourceMaps: false, // Disable source maps (faster build, less memory)
  swcMinify: true, // Use faster SWC minifier
  compress: true, // Enable gzip compression
  poweredByHeader: false, // Remove X-Powered-By header

  // Security headers for production
  headers: async () => {
    // CSP directives - strict but allows necessary functionality
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://www.google-analytics.com https://api.openai.com https://generativelanguage.googleapis.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: cspDirectives },
        ]
      },
      {
        // Cache static assets aggressively
        source: '/(.*)\\.(ico|png|jpg|jpeg|gif|webp|svg|woff|woff2)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ]
      },
      {
        // No cache for HTML pages
        source: '/((?!_next|api).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ]
      }
    ]
  },

  experimental: {
    turbo: {
      rules: {
        '*.css': [
          'css-loader',
          'postcss-loader',
        ],
      },
    },
  },
  webpack: (config, { isServer }) => {
    // Suppress warnings from Sentry's OpenTelemetry dependencies
    // These are known issues with require-in-the-middle in webpack
    config.ignoreWarnings = [
      { module: /node_modules\/require-in-the-middle/ },
      { module: /node_modules\/@opentelemetry/ },
    ]
    return config;
  },
}

module.exports = nextConfig