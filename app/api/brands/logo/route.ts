import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain parameter required' },
        { status: 400 }
      )
    }

    const brandfetchApiKey = process.env.BRANDFETCH_API_KEY
    
    if (!brandfetchApiKey) {
      console.warn('[LOGO_API] Brandfetch API key not configured, using Google favicon fallback')
      // Fallback to Google favicon
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      return NextResponse.json({ logoUrl: faviconUrl, source: 'google_favicon' })
    }

    // Try Brandfetch API first
    try {
      const brandfetchResponse = await fetch(`https://api.brandfetch.io/v2/brands/${domain}`, {
        headers: {
          'Authorization': `Bearer ${brandfetchApiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (brandfetchResponse.ok) {
        const brandData = await brandfetchResponse.json()
        
        // Extract logo URL from Brandfetch response
        const logoUrl = brandData.logos?.[0]?.formats?.[0]?.src || 
                        brandData.logos?.[0]?.formats?.find((f: any) => f.format === 'png')?.src ||
                        brandData.icon?.formats?.[0]?.src

        if (logoUrl) {
          return NextResponse.json({ 
            logoUrl, 
            source: 'brandfetch',
            brandName: brandData.name 
          })
        }
      }
    } catch (brandfetchError) {
      console.warn('[LOGO_API] Brandfetch failed:', brandfetchError)
    }

    // Fallback to Google favicon
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    return NextResponse.json({ logoUrl: faviconUrl, source: 'google_favicon' })

  } catch (error) {
    console.error('[LOGO_API] Error:', error)
    
    // Always provide a fallback
    const domain = new URL(request.url).searchParams.get('domain')
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null
    
    return NextResponse.json({ 
      logoUrl: faviconUrl, 
      source: 'fallback',
      error: 'Logo fetch failed'
    })
  }
}