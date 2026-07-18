# OpenAnalytics

AI-powered AEO (Answer Engine Optimization) analytics platform with health checks and visibility analysis.

## Architecture

```
Stage Health (per URL)
     ↓
┌────┴────┐
▼         ▼
[29 checks]   parallel
  │
  ▼
Tiered Score → Grade → Band

Stage Mentions (per company)
     ↓
┌────┴────┐
▼         ▼
[Query Gen] → [AI Test]  parallel queries
  │
  ▼
Visibility Score → Quality
```

## Stages

| Stage | Name | AI Calls | Purpose |
|-------|------|----------|---------|
| Health | AEO Health Check | 0 | 29 checks across 4 categories, tiered scoring |
| Mentions | AI Visibility | 1 + N | Generate hyperniche queries, test with Gemini |

## Data Flow

- **HealthStageInput**: URL → FetchResult → Checks → TieredScore → HealthStageOutput
- **MentionsStageInput**: Company info → Query generation → AI testing → MentionsStageOutput
- **Pipeline**: Can run both stages in parallel

## Project Structure

```
openanalytics/
├── shared/                    # Shared components
│   ├── gemini_client.py       # Unified Gemini client
│   ├── models.py              # Request/Response schemas
│   ├── scoring.py             # Tiered AEO scoring system
│   ├── fetcher.py             # Async HTML/robots.txt fetcher
│   ├── constants.py           # GEMINI_MODEL, AI_CRAWLERS, etc.
│   └── __init__.py            # Package exports
├── stage health/              # Health Check stage
│   ├── stage_health.py        # Main orchestrator
│   ├── health_models.py       # Stage-specific models
│   └── __init__.py            # Package exports
├── stage mentions/            # Mentions Check stage
│   ├── stage_mentions.py      # Main orchestrator
│   ├── mentions_models.py     # Stage-specific models
│   └── __init__.py            # Package exports
├── checks/                    # Individual check modules
│   ├── technical.py           # 16 technical SEO checks
│   ├── structured_data.py     # 6 schema.org checks
│   ├── aeo_crawler.py         # 4 AI crawler access checks
│   └── authority.py           # 3 authority signal checks
├── pipeline/                  # Pipeline orchestration
│   ├── run_pipeline.py        # Main orchestrator + CLI
│   └── __init__.py            # Package exports
├── service/                   # Service layer
│   ├── analytics_service.py   # High-level business logic
│   └── __init__.py            # Package exports
├── api.py                     # FastAPI endpoints
├── requirements.txt           # Python dependencies
└── CLAUDE.md                  # This file
```

## Key Design Decisions

1. **Shared GeminiClient**: All stages use `shared.gemini_client.GeminiClient` for consistency
2. **Tiered Scoring**: Score is minimum of Tier 0/1/2 caps and base score
3. **Micro-API Pattern**: Each stage is JSON in → JSON out, can run standalone
4. **Parallel Processing**: Health and Mentions stages can run in parallel
5. **Service Layer**: High-level business logic in `service/` for API endpoints

## Tiered Scoring System

The AEO funnel:
1. **CAN AI ACCESS?** → If blocked, nothing else matters (Tier 0)
2. **CAN AI UNDERSTAND?** → Schema.org is essential (Tier 1)
3. **IS CONTENT STRUCTURED?** → Technical SEO (Tier 2)
4. **IS IT TRUSTWORTHY?** → Authority signals (Tier 3)

| Tier | Name | Cap if Failed | Example |
|------|------|---------------|---------|
| 0 | Critical | 10 | Blocks all AI crawlers |
| 1 | Essential | 45-55 | No Organization schema |
| 2 | Important | 70-95 | Incomplete schema, thin content |
| 3 | Excellence | 100 | Full optimization |

## Environment Variables

```
GEMINI_API_KEY=your-gemini-api-key
SERPER_API_KEY=optional-serper-key-for-search
```

## Usage

### API Server

```bash
# Start server
python api.py

# Or with uvicorn
uvicorn api:app --host 0.0.0.0 --port 8000
```

### CLI

```bash
# Health check only
python pipeline/run_pipeline.py --url https://example.com --health-only

# Mentions check only
python pipeline/run_pipeline.py --company "Example Corp" --industry "SaaS" --mentions-only

# Full analysis
python pipeline/run_pipeline.py --url https://example.com --company "Example Corp"

# With output file
python pipeline/run_pipeline.py --url https://example.com -o results/output.json
```

### API Endpoints

```bash
# Health check
curl -X POST http://localhost:8000/health \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Mentions check
curl -X POST http://localhost:8000/mentions \
  -H "Content-Type: application/json" \
  -d '{"company_name": "Example Corp", "industry": "SaaS"}'

# Full analysis
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "company_name": "Example Corp"}'
```

## Dependencies

- `google-genai>=1.0` - Gemini API client
- `pydantic>=2.0` - Data validation
- `httpx>=0.25` - Async HTTP client
- `python-dotenv>=1.0` - Environment variables
- `beautifulsoup4>=4.12` - HTML parsing
- `fastapi>=0.100` - API framework
- `uvicorn>=0.23` - ASGI server
- `playwright>=1.40` - JS rendering (optional)

## Health Check Categories

### Technical SEO (16 checks)
- Title tag, meta description, canonical, robots meta
- H1/H2 structure, HTTPS, response time, sitemap
- Content word count, hreflang, etc.

### Structured Data (6 checks)
- Organization schema completeness
- FAQ/HowTo schemas, sameAs links
- Content freshness dates

### AI Crawler Access (4 checks)
- GPTBot, Claude-Web, PerplexityBot, CCBot
- Checks robots.txt for blocking

### Authority Signals (3 checks)
- About page, contact info, social proof

## Mentions Check Query Distribution

- **70% UNBRANDED**: Test real organic discovery
- **20% COMPETITIVE**: Comparison/alternative queries
- **10% BRANDED**: Brand awareness queries

## Grade Scale

| Grade | Score | Description |
|-------|-------|-------------|
| A+ | 90+ | Exceptional - passes all tiers with excellence |
| A | 80-89 | Excellent - full schema, good optimization |
| B | 65-79 | Good - has schema, some gaps |
| C | 45-64 | Fair - missing schema or has issues |
| D | 25-44 | Poor - major gaps, partial AI access |
| F | <25 | Critical - blocks AI or fundamental issues |

## Visibility Bands

| Band | Score | Color |
|------|-------|-------|
| Excellent | 80+ | #22c55e (green) |
| Strong | 65-79 | #84cc16 (lime) |
| Moderate | 45-64 | #eab308 (yellow) |
| Weak | 25-44 | #f97316 (orange) |
| Critical | <25 | #ef4444 (red) |
