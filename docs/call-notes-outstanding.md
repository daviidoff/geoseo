# Call Notes - Outstanding Items

**Last Updated:** 2026-01-20

## ✅ SOLVED

### Billing & Credits
- [x] **Credit deduction always runs**: PRO uses 'soft' enforcement - credits deducted but no blocking (invisible to user)
- [x] **PRO plan credits**: Set to 999,999 credits in `lib/config/pricing.config.ts`
- [x] **Variable credit costs**: Keywords now charge based on quantity (1 credit per 10 keywords)
  - `lib/config/pricing.config.ts` - Added `getKeywordCreditUnits()` helper
  - `app/api/generate-keywords/route.ts` - Uses keyword count for credits
  - `app/api/keywords/generate/route.ts` - Uses keyword count for credits
  - Blogs already charge per blog (8 credits × quantity)

### Bug Fixes
- [x] **Company Context hallucination**: Fixed with `url_context` + `google_search` + `response_schema` (commit `67b3cfe`)
- [x] **Mentions check failing**: Service refactored with proper Gemini grounding (`services/mentions/service.py`)
- [x] **SERP data incomplete**: Added Meta Tags and Website URL (commit `38ae54d`)
- [x] **Blog refresh CSV parsing**: Fixed naive `split(',')` breaking on HTML content with commas
  - Now uses Papaparse for proper CSV parsing (commit `353535b`)
  - `components/blogs/BlogGeneratorBasic.tsx` - proper handling of quoted fields

### Feature Additions
- [x] **Background generation**: Navigate away - jobs continue with notifications (`useBackgroundJobs.ts`, `BackgroundJobIndicator.tsx`)
- [x] **Blog download formats**: TXT, HTML, PDF, DOCX, XLSX exports in `BlogGeneratorBasic.tsx` and `BlogHistory.tsx`
- [x] **History download formats**: TXT, MD, PDF, DOCX dropdown for blog entries in `history/page.tsx`
- [x] **Refresh any format**: Refresh mode generates blogs that support all export formats
- [x] **Analytics URL input**: URL from contexts selectable via dropdown in Health Check
  - `components/shared/ContextUrlSelector.tsx` - Reusable dropdown for saved context URLs
  - `components/aeo/HealthCheckPanel.tsx` - Added "Use saved URL" button
- [x] **Research files in blog generation**: Business context + research files now passed to blog pipeline
  - `services/blog/models.py` - Added `CompanyContextInput` with `research_files` field
  - `services/blog/pipeline.py` - Uses pre-provided context, adds research files to custom instructions
  - `lib/api/python-backend.ts` - Added `CompanyContextInput` interface
  - `app/api/generate-blog/route.ts` - Transforms and forwards `business_context` to Python backend
  - `lib/schemas/api.ts` - Extended `businessContextSchema` with all context fields including `researchFiles`
- [x] **Business context in keywords generation**: Full context + research files now passed to keywords pipeline
  - `services/keywords/models.py` - Added `CompanyContextInput`, `system_instructions`, `custom_instructions`
  - `services/keywords/pipeline.py` - Uses pre-provided context, skips Stage 1 when context provided
  - `services/keywords/router.py` - Passes context and instructions to pipeline
  - `services/keywords/stage1/stage1_models.py` - Added `tone`, `content_themes`, `opencontext_called` fields
  - `lib/api/python-backend.ts` - Added context and instructions to `KeywordsJobRequest`
  - `lib/schemas/api.ts` - Added `keywordCompanyContextSchema`, `system_instructions`, `custom_instructions`
  - `app/api/generate-keywords/route.ts` - Builds and forwards context to Python backend
  - `app/api/jobs/keywords/route.ts` - Transforms camelCase to snake_case field names
  - `components/keywords/KeywordGenerator.tsx` - Passes `currentBusinessContext` to job request

### UI/UX Improvements
- [x] **Rename "Logs" → "History"**: Renamed `app/(authenticated)/log/` → `history/`, updated nav and breadcrumbs
- [x] **Research and Sources**: Hidden from Context page (commented out in `ContextForm.tsx`)
- [x] **History tab positioning**: Added History tabs to Keywords and Analytics pages (matching Blogs pattern)
  - `app/(authenticated)/keywords/page.tsx` - Generate | History tabs
  - `app/(authenticated)/analytics/page.tsx` - Health Check | Mentions | History tabs
  - `components/keywords/KeywordsHistory.tsx` - Keywords-specific history component
  - `components/aeo/AnalyticsHistory.tsx` - Analytics-specific history component

### Testing & Reliability
- [x] **Test script for reliability**: Load test script at `python-backend/test_services_load.py`
  - Tests all 5 services: keywords, blog, context, mentions, health
  - Configurable requests (`-n 1000`) and concurrency (`-c 5`)
  - Measures failure rate, avg/min/max processing time
  - Usage: `python test_services_load.py --requests 1000`
- [x] **Fallback retry (DRY)**: ALL services now use ONE core GeminiClient with built-in retry:
  - `core/gemini_client.py` - unified client with exponential backoff (MAX_RETRIES=4, BASE_DELAY=1.0s)
  - `core/config.py` - GeminiConfig with ServiceType enum (KEYWORDS, BLOG, CONTEXT, MENTIONS)
  - **Keywords service**: All stages (1-7) refactored to use core GeminiClient
  - **Blog service**: All stages (1-5) refactored to use core GeminiClient
  - **Context service**: Uses core GeminiClient with ServiceType.CONTEXT
  - **OpenAnalytics**: `shared/gemini_client.py` - added retry (separate repo)
  - **Deleted duplicates**: `services/blog/shared/gemini_client.py`, `services/context/shared/gemini_client.py`
- [x] **100% reliability achieved**: Load test passes 50/50 (10 requests × 5 services)
  - JSON parsing fix: Apply repair to balanced extracted text + improved regex for newlines (commit `1022950`)
  - Health check retry: Added 3-retry with exponential backoff for URL fetch (commit `2b879a0`)

---

## ❌ OUTSTANDING

_No outstanding items!_

---

## Summary

| Category | Solved | Outstanding |
|----------|--------|-------------|
| Testing & Reliability | 3 | 0 |
| Billing & Credits | 3 | 0 |
| Bug Fixes | 4 | 0 |
| Feature Additions | 7 | 0 |
| UI/UX Improvements | 3 | 0 |
| Infrastructure | 1 | 0 |
| **Total** | **21** | **0** |
