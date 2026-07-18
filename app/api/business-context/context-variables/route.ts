/**
 * ABOUTME: Business Context Variables API (localStorage-based auth)
 * ABOUTME: Returns mock context variables - no database
 *
 * GET /api/business-context/context-variables - Get all business context
 * PUT /api/business-context/context-variables - Update business context
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDevModeUser } from '@/lib/dev-mode-helper'

// In-memory storage for context variables (resets on server restart)
let mockContextVariables: Record<string, unknown> = {}
let mockBusinessContext: Record<string, unknown> = {}
let mockGtmProfile: Record<string, unknown> = {}

export async function GET() {
  try {
    getDevModeUser() // Verify auth

    return NextResponse.json({
      contextVariables: mockContextVariables,
      businessContext: mockBusinessContext,
      gtmProfile: mockGtmProfile
    })
  } catch (error) {
    console.error('Error fetching business context:', error)
    return NextResponse.json({ error: 'Failed to fetch business context' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    getDevModeUser() // Verify auth
    const body = await request.json()

    const {
      // Context Variables
      tone,
      valueProposition,
      targetCountries,
      productDescription,
      competitors,
      targetIndustries,
      complianceFlags,
      marketingGoals,
      // Company & Contact
      companyName,
      companyWebsite,
      contactEmail,
      contactPhone,
      linkedInUrl,
      twitterUrl,
      githubUrl,
      // Business Context
      icp,
      countries,
      products,
      targetKeywords,
      competitorKeywords,
      // GTM Profile
      gtmPlaybook,
      productType,
    } = body

    // Update mock storage
    mockContextVariables = {
      tone: tone || mockContextVariables.tone,
      valueProposition: valueProposition || mockContextVariables.valueProposition,
      targetCountries: targetCountries || mockContextVariables.targetCountries,
      productDescription: productDescription || mockContextVariables.productDescription,
      competitors: competitors || mockContextVariables.competitors,
      targetIndustries: targetIndustries || mockContextVariables.targetIndustries,
      complianceFlags: complianceFlags || mockContextVariables.complianceFlags,
      marketingGoals: marketingGoals || mockContextVariables.marketingGoals,
      companyName: companyName || mockContextVariables.companyName,
      companyWebsite: companyWebsite || mockContextVariables.companyWebsite,
      contactEmail: contactEmail || mockContextVariables.contactEmail,
      contactPhone: contactPhone || mockContextVariables.contactPhone,
      linkedInUrl: linkedInUrl || mockContextVariables.linkedInUrl,
      twitterUrl: twitterUrl || mockContextVariables.twitterUrl,
      githubUrl: githubUrl || mockContextVariables.githubUrl,
    }

    mockBusinessContext = {
      icp: icp || mockBusinessContext.icp,
      countries: countries || mockBusinessContext.countries || [],
      products: products || mockBusinessContext.products || [],
      targetKeywords: targetKeywords || mockBusinessContext.targetKeywords || [],
      competitorKeywords: competitorKeywords || mockBusinessContext.competitorKeywords || [],
    }

    mockGtmProfile = {
      gtmPlaybook: gtmPlaybook || mockGtmProfile.gtmPlaybook,
      productType: productType || mockGtmProfile.productType,
      gtmPlaybookAISuggested: false,
      productTypeAISuggested: false,
      gtmPlaybookManuallyOverridden: false,
      productTypeManuallyOverridden: false,
    }

    return NextResponse.json({
      success: true,
      contextVariables: mockContextVariables,
      businessContext: mockBusinessContext,
      gtmProfile: mockGtmProfile
    })
  } catch (error) {
    console.error('Error updating business context:', error)
    return NextResponse.json({ error: 'Failed to update business context' }, { status: 500 })
  }
}
