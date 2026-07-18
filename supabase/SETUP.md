# Supabase Setup Guide

## Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned
3. Copy your project credentials from Settings > API

### 2. Configure Environment Variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Set to false to enable auth (true bypasses auth during development)
NEXT_PUBLIC_DEV_MODE=true
```

### 3. Run Migrations

**Option A: Via Supabase CLI**
```bash
# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

**Option B: Via Dashboard**
1. Go to SQL Editor in your Supabase dashboard
2. Copy contents of `migrations/00005_clean_schema.sql`
3. Run the SQL

### 4. Configure Authentication

In Supabase Dashboard > Authentication > URL Configuration:
- Site URL: `http://localhost:3000` (or your production URL)
- Redirect URLs: `http://localhost:3000/auth/callback`

#### Enable LinkedIn OAuth (Optional)
1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Create an app and get Client ID/Secret
3. Add credentials in Supabase Dashboard > Authentication > Providers > LinkedIn

## Database Schema

8 tables for an agency tool with billing and scheduling:

### User & Billing Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `user_profiles` | User data + billing (single source of truth) | user_id, email, full_name, avatar_url, stripe_customer_id, plan_type, credits_remaining |
| `credit_transactions` | Credit purchase/usage history | amount, type, balance_after |
| `scheduled_runs` | Scheduled cron jobs | cron_expression, job_type, next_run_at |

### Content Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `clients` | Companies the agency manages | name, website, industry, brand_voice |
| `assets` | Uploaded files per client | name, type, storage_path, ai_labels |
| `keywords` | Generated keywords per client | keyword, intent, search_volume |
| `blogs` | Generated blog content per client | title, content, status |
| `analyses` | AEO/health check results | type, score, results (JSONB) |

### Entity Relationship

```
auth.users (Supabase Auth)
  │
  ├── user_profiles (all user data + billing)
  │     └── credit_transactions (payment history)
  │
  ├── scheduled_runs (cron jobs)
  │
  └── clients (companies they manage)
        │
        ├── assets (files)
        ├── keywords (generated keywords)
        ├── blogs (generated content)
        └── analyses (AEO checks)
```

### Row Level Security (RLS)

All tables have RLS enabled. Users can only access their own data:
- `user_profiles`: Own profile only
- `credit_transactions`: Own transactions only (insert via service role)
- `scheduled_runs`: Full CRUD for own schedules
- `clients`: Own clients only
- `assets/keywords/blogs/analyses`: Only for own clients

### Database Functions

| Function | Purpose |
|----------|---------|
| `deduct_credits(user_id, amount, description)` | Deducts credits and logs transaction |
| `add_credits(user_id, amount, type, description)` | Adds credits and logs transaction |
| `handle_new_user()` | Trigger: Creates user_profile on signup with 50 free credits |

## TypeScript Types

Import database types:

```typescript
import {
  Database,
  Tables,
  UserProfile,  // Single source of truth for user data
  User,         // Alias for UserProfile (backward compat)
  Client,
  Keyword,
  Blog,
  CreditTransaction,
  ScheduledRun
} from '@/lib/database.types'

// Use in Supabase client
const supabase = createClient<Database>()

// Type a query result
const { data } = await supabase.from('clients').select('*')
// data is Client[] | null

// Access user data (includes billing)
const { data: profile } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('user_id', userId)
  .single()
// profile is UserProfile | null
```

## Troubleshooting

### "Supabase not configured" errors
- Verify all three env vars are set correctly
- Check for typos in the URL or keys

### RLS policy errors
- Ensure migrations have been run
- Check that the user is authenticated

### Auth callback issues
- Verify redirect URLs in Supabase dashboard match your app URL
- Check Site URL matches your app URL

## Local Development

```bash
# Start local Supabase (requires Docker)
supabase start

# View local dashboard
open http://localhost:54323

# Stop local Supabase
supabase stop
```

Local credentials are shown when you run `supabase start`.
