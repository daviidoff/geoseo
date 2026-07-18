/**
 * ABOUTME: Business Context API (localStorage-based auth)
 * ABOUTME: Returns mock context - no database storage
 *
 * API Route: Business Context (Unified - DRY)
 * GET /api/business-context/business-context - Get all business context
 * PUT /api/business-context/business-context - Update business context
 *
 * Single unified endpoint for everything:
 * - Business Context Variables: tone, targetCountries, productDescription, competitors, targetIndustries, complianceFlags
 * - Business Context: icp, countries, products, target_keywords, competitor_keywords
 * - GTM Profile: gtmPlaybook, productType + AI tracking (confidence, suggestions, overrides)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDevModeUser } from '@/lib/dev-mode-helper';
import {
  businessContextUpdateSchema,
} from '@/lib/schemas/api';

// In-memory storage for business context (resets on server restart)
let mockContextVariables: Record<string, unknown> = {};
let mockBusinessContext: Record<string, unknown> = {};
let mockGtmProfile: Record<string, unknown> = {};

export async function GET() {
  try {
    getDevModeUser(); // Verify auth

    // Return in-memory mock context
    return NextResponse.json({
      contextVariables: mockContextVariables,
      businessContext: mockBusinessContext,
      gtmProfile: mockGtmProfile
    });
  } catch (error) {
    console.error('Error fetching business context:', error);
    return NextResponse.json({ error: 'Failed to fetch business context' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rawBody = await request.json();

    getDevModeUser(); // Verify auth

    // Validate request with Zod schema
    const parseResult = businessContextUpdateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      // Context Variables
      tone,
      targetCountries,
      productDescription,
      competitors,
      targetIndustries,
      complianceFlags,
      // Business Context
      icp,
      countries,
      products,
      valueProposition,
      marketingGoals,
      targetKeywords,
      competitorKeywords,
      // GTM Profile (basic)
      gtmPlaybook,
      productType,
      // GTM Profile (AI tracking)
      gtmPlaybookAISuggestion,
      productTypeAISuggestion,
      gtmPlaybookConfidence,
      productTypeConfidence,
      gtmPlaybookAISuggested,
      productTypeAISuggested
    } = parseResult.data;

    // Update in-memory storage
    if (tone !== undefined) mockContextVariables.tone = tone || null;
    if (targetCountries !== undefined) mockContextVariables.targetCountries = targetCountries || null;
    if (productDescription !== undefined) mockContextVariables.productDescription = productDescription || null;
    if (competitors !== undefined) mockContextVariables.competitors = competitors || null;
    if (targetIndustries !== undefined) mockContextVariables.targetIndustries = targetIndustries || null;
    if (complianceFlags !== undefined) mockContextVariables.complianceFlags = complianceFlags || null;

    // Business Context
    if (icp !== undefined) mockBusinessContext.icp = icp || null;
    if (countries !== undefined) mockBusinessContext.countries = countries || [];
    if (products !== undefined) mockBusinessContext.products = products || [];
    if (valueProposition !== undefined) mockBusinessContext.valueProposition = valueProposition || null;
    if (marketingGoals !== undefined) mockBusinessContext.marketingGoals = Array.isArray(marketingGoals) ? marketingGoals : [];
    if (targetKeywords !== undefined) mockBusinessContext.targetKeywords = targetKeywords || [];
    if (competitorKeywords !== undefined) mockBusinessContext.competitorKeywords = competitorKeywords || [];

    // GTM Profile
    if (gtmPlaybook !== undefined) mockGtmProfile.gtmPlaybook = gtmPlaybook || null;
    if (productType !== undefined) mockGtmProfile.productType = productType || null;
    if (gtmPlaybookAISuggestion !== undefined) mockGtmProfile.gtmPlaybookAISuggestion = gtmPlaybookAISuggestion;
    if (productTypeAISuggestion !== undefined) mockGtmProfile.productTypeAISuggestion = productTypeAISuggestion;
    if (gtmPlaybookConfidence !== undefined) mockGtmProfile.gtmPlaybookConfidence = gtmPlaybookConfidence;
    if (productTypeConfidence !== undefined) mockGtmProfile.productTypeConfidence = productTypeConfidence;
    if (gtmPlaybookAISuggested !== undefined) mockGtmProfile.gtmPlaybookAISuggested = gtmPlaybookAISuggested;
    if (productTypeAISuggested !== undefined) mockGtmProfile.productTypeAISuggested = productTypeAISuggested;

    return NextResponse.json({
      success: true,
      contextVariables: mockContextVariables,
      businessContext: mockBusinessContext,
      gtmProfile: mockGtmProfile
    });
  } catch (error) {
    console.error('Error updating business context:', error);
    return NextResponse.json({ error: 'Failed to update business context' }, { status: 500 });
  }
}

