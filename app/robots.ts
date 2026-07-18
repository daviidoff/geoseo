/**
 * ABOUTME: Robots.txt configuration for SEO
 * ABOUTME: Controls search engine crawling behavior
 */

import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hyperniche.ai'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/profile/',
          '/keywords/',
          '/blogs/',
          '/analytics/',
          '/context/',
          '/settings/',
          '/run/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
