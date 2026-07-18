# Mono Python Service

Unified AI backend combining all services into a single FastAPI application.

## Services

| Service | Endpoint | Description |
|---------|----------|-------------|
| **Keywords** | `/api/v1/keywords` | AI-powered SEO keyword generation (6-stage pipeline with SERP analysis) |
| **Blog** | `/api/v1/blog` | AI-powered blog article generation (7-stage pipeline with cleanup & similarity) |
| **Context** | `/api/v1/context` | Company context extraction with GTM classification |
| **Mentions** | `/api/v1/mentions` | AI visibility check with Gemini + Google Search grounding |
| **Health Check** | `/api/v1/health-check` | AEO website health scoring (29 checks across 4 categories) |

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run the server
uvicorn api:app --reload --port 8000

# Or run directly
python api.py
```

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## Endpoints

### Health & Stats
- `GET /health` - Global health check
- `GET /stats` - Job store statistics

### Keywords Service
- `POST /api/v1/keywords/jobs` - Create keyword generation job
- `GET /api/v1/keywords/jobs` - List jobs
- `GET /api/v1/keywords/jobs/{job_id}` - Get job status
- `GET /api/v1/keywords/jobs/{job_id}/export/json` - Export as JSON
- `GET /api/v1/keywords/jobs/{job_id}/export/csv` - Export as CSV
- `DELETE /api/v1/keywords/jobs/{job_id}` - Delete job
- `POST /api/v1/keywords/generate` - Sync generation (limited)
- `POST /api/v1/keywords/refresh` - Refresh keywords from seeds

### Blog Service
- `POST /api/v1/blog/jobs` - Create blog generation job
- `GET /api/v1/blog/jobs` - List jobs
- `GET /api/v1/blog/jobs/{job_id}` - Get job status
- `GET /api/v1/blog/jobs/{job_id}/articles` - Get articles
- `DELETE /api/v1/blog/jobs/{job_id}` - Delete job
- `POST /api/v1/blog/refresh` - Refresh article content with current data

### Context Service
- `POST /api/v1/context/jobs` - Create context extraction job
- `GET /api/v1/context/jobs` - List jobs
- `GET /api/v1/context/jobs/{job_id}` - Get job status
- `DELETE /api/v1/context/jobs/{job_id}` - Delete job
- `POST /api/v1/context/analyze` - Sync extraction

### Mentions Service
- `POST /api/v1/mentions/jobs` - Create mentions check job
- `GET /api/v1/mentions/jobs` - List jobs
- `GET /api/v1/mentions/jobs/{job_id}` - Get job status
- `DELETE /api/v1/mentions/jobs/{job_id}` - Delete job
- `POST /api/v1/mentions/check` - Sync visibility check

### Health Check Service (AEO)
- `POST /api/v1/health-check/jobs` - Create health check job
- `GET /api/v1/health-check/jobs` - List jobs
- `GET /api/v1/health-check/jobs/{job_id}` - Get job status
- `DELETE /api/v1/health-check/jobs/{job_id}` - Delete job
- `POST /api/v1/health-check/check` - Sync health check

## Architecture

```
python-backend/
├── api.py                 # Main FastAPI app
├── core/
│   ├── config.py          # Unified configuration
│   ├── gemini_client.py   # Shared Gemini client
│   ├── job_store.py       # In-memory job storage
│   ├── prompt_loader.py   # Prompt loading utilities
│   └── clients/           # External API clients
│       ├── serper_client.py      # Serper.dev SERP API (backup for rate limits)
│       └── seranking_client.py   # SE Ranking API (low priority)
├── services/
│   ├── keywords/          # Keyword generation (6-stage pipeline)
│   │   ├── stage1-6/      # Pipeline stages (including SERP analysis)
│   │   └── pipeline.py    # Pipeline orchestrator
│   ├── blog/              # Blog generation (7-stage pipeline)
│   │   ├── stage1-5/      # Core pipeline stages
│   │   ├── stage_cleanup/ # HTML cleanup & validation
│   │   ├── stage_similarity/ # Content deduplication
│   │   ├── shared/        # Shared utilities (Schema.org, HTML renderer)
│   │   └── pipeline.py    # Pipeline orchestrator
│   ├── context/           # Context extraction
│   │   └── opencontext/   # OpenContext implementation
│   ├── mentions/          # AI visibility check
│   │   └── service.py     # Mentions analysis (Gemini + Google Search)
│   └── health/            # AEO health check service
└── prompts/               # Prompt templates
```

## Pipeline Details

### Keywords Pipeline (6 Stages)
1. **Stage 1**: AI keyword generation from company context
2. **Stage 2**: Question extraction and intent classification
3. **Stage 3**: Keyword deduplication and clustering
4. **Stage 4**: Scoring and prioritization
5. **Stage 5**: Final formatting and export
6. **Stage 6**: SERP analysis with Serper.dev (volume, difficulty, AEO opportunity)

### Blog Pipeline (7 Stages)
1. **Stage 1**: Company context extraction (OpenContext)
2. **Stage 2**: Article writing with Gemini
3. **Stage 3**: Quality check and improvements
4. **Stage 4**: URL verification and link fixing
5. **Stage 5**: Internal link injection
6. **Cleanup**: HTML cleanup and validation
7. **Similarity**: Content deduplication check

## Integration with Next.js Frontend

The service is designed to work with the hyperniche-ai Next.js frontend.

Example frontend call:
```typescript
const response = await fetch('http://localhost:8000/api/v1/keywords/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    company_name: 'Stripe',
    company_url: 'https://stripe.com',
    target_count: 50,
  }),
});

const { job_id } = await response.json();

// Poll for results
const status = await fetch(`http://localhost:8000/api/v1/keywords/jobs/${job_id}`);
```

## Environment Variables

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key
# or
GOOGLE_API_KEY=your_google_api_key

# Optional - for enhanced features
SERPER_API_KEY=your_serper_key          # Backup for Google Search rate limits
SE_RANKING_API_KEY=your_seranking_key   # Competitor gap analysis (low priority)
```

## Status

- [x] Keywords service with 6-stage pipeline (including SERP analysis)
- [x] Blog service with 7-stage pipeline (cleanup + similarity)
- [x] Context extraction with GTM classification
- [x] Mentions check (Gemini + Google Search grounding)
- [x] Schema.org JSON-LD output (Article + FAQPage)
- [x] Competitor categories (names vs types)
- [x] SSRF protection
- [x] Security headers middleware
- [x] Serper.dev as backup for Google Search rate limits
- [x] TypeScript client (`lib/api/python-backend.ts`)

## TODO

- [ ] Add Redis job store option for production
- [ ] Add Docker deployment
- [ ] Add authentication/API keys
- [ ] Add rate limiting
