# HyperNiche AI

Agency tool for creating keywords, blogs, and analysis for different clients (company contexts).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                      │
│                    (Vercel / localhost:3000)                 │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌───────────────┐  ┌─────────────┐
│  Python Backend │  │   Supabase    │  │   Stripe    │
│    (FastAPI)    │  │ (PostgreSQL)  │  │ (Payments)  │
│     Render      │  │    + Auth     │  │             │
└─────────────────┘  └───────────────┘  └─────────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14 + React + TypeScript | UI, routing, API routes |
| Styling | Tailwind CSS + Radix UI | Component library |
| Backend | Python FastAPI | AI generation services |
| Database | Supabase (PostgreSQL) | Data persistence |
| Auth | Supabase Auth | User authentication |
| Payments | Stripe | Subscriptions & credits |
| AI | Google Gemini | Content generation |

## Database Schema

6 tables in Supabase:

| Table | Purpose |
|-------|---------|
| `users` | Agency staff (synced with auth.users) |
| `clients` | Companies the agency manages |
| `assets` | Uploaded files per client |
| `keywords` | Generated keywords per client |
| `blogs` | Generated blog content per client |
| `analyses` | AEO/health check results per client |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Required variables:
```bash
# AI
GEMINI_API_KEY=your-gemini-api-key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe (optional)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# Development
NEXT_PUBLIC_DEV_MODE=true  # Bypasses auth during development
```

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
app/
├── (authenticated)/     # Protected routes
│   ├── context/        # Client context management
│   ├── keywords/       # Keyword generation
│   ├── blogs/          # Blog generation
│   ├── analytics/      # Usage analytics
│   └── profile/        # User profile
├── api/                # Next.js API routes
└── auth/               # Authentication pages

backend/
└── main.py             # Python FastAPI backend

lib/
├── supabase/           # Supabase client setup
├── openblog/           # Blog generation engine
├── openkeyword/        # Keyword generation engine
└── opencontext/        # Context analysis engine

supabase/
└── migrations/         # Database migrations
```

## Key Features

### Client Context Management (`/context`)
- Create and manage company profiles
- Store brand voice, competitors, target audience
- AI-powered website analysis

### Keyword Generation (`/keywords`)
- Generate AEO-optimized keywords
- Intent classification
- Search volume estimates

### Blog Generation (`/blogs`)
- AI-generated blog articles
- Batch processing support
- AEO scoring

### Analytics (`/analytics`)
- AEO health checks
- Brand mention monitoring
- Usage tracking

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run E2E tests
npm run test:e2e
```

## Deployment

### Frontend (Vercel)
1. Connect GitHub repo to Vercel
2. Set environment variables
3. Deploy

### Backend (Render)
1. Create Python Web Service
2. Set `GEMINI_API_KEY` environment variable
3. Deploy from `backend/` directory

### Database (Supabase)
1. Create Supabase project
2. Run migrations: `supabase db push`
3. Configure auth providers

## License

MIT
