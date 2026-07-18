# OpenAnalytics

AI-powered AEO (Answer Engine Optimization) analytics platform with health checks and visibility analysis.

## Architecture

Stage-based architecture aligned with [openblog](https://github.com/federicodeponte/openblog):

```
openanalytics/
├── shared/                    # Shared components
│   ├── gemini_client.py       # Unified Gemini client
│   ├── models.py              # Request/Response schemas
│   ├── scoring.py             # Tiered AEO scoring system
│   ├── fetcher.py             # Async HTML/robots.txt fetcher
│   └── constants.py           # Configuration
├── stage health/              # Health Check stage
│   ├── stage_health.py        # Main orchestrator
│   └── health_models.py       # Stage models
├── stage mentions/            # Mentions Check stage
│   ├── stage_mentions.py      # Main orchestrator
│   └── mentions_models.py     # Stage models
├── checks/                    # Individual check modules
│   ├── technical.py           # 16 technical SEO checks
│   ├── structured_data.py     # 6 schema.org checks
│   ├── aeo_crawler.py         # 4 AI crawler access checks
│   └── authority.py           # 3 authority signal checks
├── pipeline/                  # Pipeline orchestration
│   └── run_pipeline.py        # Main orchestrator + CLI
├── service/                   # Service layer
│   └── analytics_service.py   # High-level business logic
├── api.py                     # FastAPI endpoints
└── CLAUDE.md                  # Project documentation
```

## Services

1. **Health Check** - 29 AEO checks with tiered scoring (0-100)
2. **Mentions Check** - AI-powered hyperniche query generation
3. **Full Analysis** - Combined health + mentions (parallel)

## Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/federicodeponte/openanalytics.git
cd openanalytics

# Install dependencies
pip install -r requirements.txt
playwright install chromium  # Optional: for JS rendering

# Set API key
export GEMINI_API_KEY=your_key_here
# Or create .env.local file:
echo "GEMINI_API_KEY=your_key_here" > .env.local
```

### Run API Server

```bash
# Direct
python api.py

# Or with uvicorn
uvicorn api:app --host 0.0.0.0 --port 8000
```

Server runs at: `http://localhost:8000`

### Run CLI Pipeline

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

## API Endpoints

### Health Check

```bash
curl -X POST http://localhost:8000/health \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

Response:
```json
{
  "url": "https://example.com",
  "score": 75.0,
  "grade": "B",
  "band": "Strong",
  "band_color": "#84cc16",
  "checks_passed": 22,
  "checks_failed": 7,
  "tier_details": {
    "tier0": {"passed": true, "cap": 100, "reason": "AI can access site"},
    "tier1": {"passed": true, "cap": 100, "reason": "Has essential elements"},
    "tier2": {"passed": false, "cap": 85, "reason": "Issue: incomplete Organization schema"}
  },
  "execution_time": 0.56
}
```

### Mentions Check

```bash
curl -X POST http://localhost:8000/mentions \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "SCAILE",
    "industry": "AI Marketing",
    "products": ["AEO Platform", "Health Check"],
    "target_audience": "B2B SaaS companies",
    "num_queries": 10
  }'
```

Response:
```json
{
  "company_name": "SCAILE",
  "queries_generated": [
    {"query": "best AEO platform for B2B SaaS companies", "dimension": "UNBRANDED_HYPERNICHE"},
    {"query": "SCAILE alternatives", "dimension": "Competitive"}
  ],
  "visibility": 30.0,
  "mentions": 3,
  "presence_rate": 100.0,
  "quality_score": 3.0,
  "execution_time": 45.2,
  "ai_calls": 11
}
```

### Full Analysis

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "company_name": "Example Corp",
    "industry": "SaaS"
  }'
```

## Tiered Scoring System

The health check uses a hierarchical scoring system:

| Tier | Name | Cap if Failed | Example |
|------|------|---------------|---------|
| 0 | Critical | 10 | Blocks all AI crawlers |
| 1 | Essential | 45-55 | No Organization schema |
| 2 | Important | 70-95 | Incomplete schema, thin content |
| 3 | Excellence | 100 | Full optimization |

**Final score = min(Tier 0 cap, Tier 1 cap, Tier 2 cap, base score)**

## Grade Scale

| Grade | Score | Description |
|-------|-------|-------------|
| A+ | 90+ | Exceptional |
| A | 80-89 | Excellent |
| B | 65-79 | Good |
| C | 45-64 | Fair |
| D | 25-44 | Poor |
| F | <25 | Critical |

## Query Distribution (Mentions)

- **70% UNBRANDED** - Tests real organic discovery
- **20% COMPETITIVE** - Comparison/alternative queries
- **10% BRANDED** - Brand awareness queries

## Docker Deployment

```bash
docker build -t openanalytics .
docker run -p 8000:8000 -e GEMINI_API_KEY=your_key openanalytics
```

## Railway Deployment

```bash
railway login
railway link
railway up
```

Set `GEMINI_API_KEY` in Railway dashboard.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| GEMINI_API_KEY | Yes | Gemini API key |
| SERPER_API_KEY | No | Serper API key for search grounding |
| PORT | No | Server port (default: 8000) |

## Dependencies

- `google-genai>=0.2.0` - Gemini API client
- `fastapi>=0.104.0` - API framework
- `pydantic>=2.5.0` - Data validation
- `httpx>=0.25.0` - Async HTTP client
- `beautifulsoup4>=4.12.0` - HTML parsing
- `playwright>=1.40.0` - JS rendering (optional)

## Performance

- Health Check: ~0.5-2s (depends on JS rendering)
- Mentions Check: ~30-60s (10 queries)
- Full Analysis: ~30-60s (parallel)

## License

MIT
