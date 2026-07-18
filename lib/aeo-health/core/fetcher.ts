/**
 * Async fetcher for HTML content and robots.txt
 *
 * Fetches both the main page HTML and robots.txt in parallel for comprehensive analysis.
 */

export interface FetchResult {
  html: string | null
  finalUrl: string
  robotsTxt: string | null
  sitemapFound: boolean
  htmlResponseTimeMs: number
  totalFetchTimeMs: number
  statusCode: number
  error?: string | null
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; AEO-HealthCheck/3.0; +https://hyperniche.ai)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
}

async function fetchUrl(url: string, timeout = 30000): Promise<[string | null, number, string, number]> {
  const start = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    const text = await response.text()
    const elapsed = Date.now() - start

    return [text, response.status, response.url, elapsed]
  } catch (error) {
    const elapsed = Date.now() - start
    return [null, 0, url, elapsed]
  }
}

async function fetchRobotsTxt(baseUrl: string): Promise<string | null> {
  try {
    const url = new URL(baseUrl)
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`

    const response = await fetch(robotsUrl, {
      headers: HEADERS,
      redirect: 'follow',
    })

    if (response.status === 200) {
      return await response.text()
    }
    return null
  } catch {
    return null
  }
}

async function fetchSitemap(baseUrl: string): Promise<boolean> {
  try {
    const url = new URL(baseUrl)
    const sitemapUrl = `${url.protocol}//${url.host}/sitemap.xml`

    const response = await fetch(sitemapUrl, {
      headers: HEADERS,
      redirect: 'follow',
    })

    if (response.status === 200) {
      const contentType = response.headers.get('content-type')?.toLowerCase() || ''
      const text = await response.text()

      // Valid sitemap should be XML or contain XML content
      if (contentType.includes('xml') || text.trim().startsWith('<?xml')) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

export async function fetchWebsite(url: string, timeout = 30000): Promise<FetchResult> {
  const startTime = Date.now()

  // Normalize URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }

  // Fetch HTML, robots.txt, and sitemap in parallel
  const [htmlResult, robotsTxt, sitemapFound] = await Promise.all([
    fetchUrl(url, timeout),
    fetchRobotsTxt(url),
    fetchSitemap(url),
  ])

  const [html, statusCode, finalUrl, htmlResponseTimeMs] = htmlResult
  const totalFetchTimeMs = Date.now() - startTime

  if (html === null) {
    return {
      html: null,
      finalUrl,
      robotsTxt,
      sitemapFound,
      htmlResponseTimeMs,
      totalFetchTimeMs,
      statusCode,
      error: `Failed to fetch ${url}`,
    }
  }

  return {
    html,
    finalUrl,
    robotsTxt,
    sitemapFound,
    htmlResponseTimeMs,
    totalFetchTimeMs,
    statusCode,
  }
}
