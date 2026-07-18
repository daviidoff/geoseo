# GeoSEO Operations Guide

This file is the operational reference for humans and coding agents working on
GeoSEO. Keep commands and identifiers current, but never commit secret values.

## Repository and working directory

- GitHub: `https://github.com/daviidoff/geoseo`
- Default branch: `main`
- Local project root: `/Users/davidoff/Developement/scaile-seo-geo-bundle/repos/hyperniche`
- Frontend: Next.js application in the project root
- Backend: FastAPI application in `python-backend/`
- Database and authentication: Supabase
- Hosting: Railway

Before changing anything:

```bash
git status -sb
git pull --ff-only
```

Preserve unrelated local changes. Never use destructive Git commands to clean a
working tree that you did not create.

## Production overview

### Railway

- Project name: `geoseo`
- Project ID: `b38eb571-2505-4987-9c45-7a824552f6bf`
- Environment: `production`
- Environment ID: `d48fe8be-4f79-41a6-a82d-2b70191e2a56`

| Service | Service ID | Root | Public URL | Health check |
| --- | --- | --- | --- | --- |
| `geoseo-web` | `9ab3ad8f-e804-4cf1-9eb9-da84f49fba66` | repository root | `https://geoseo-web-production.up.railway.app` | `/api/health` |
| `geoseo-api` | `e3045514-6288-4732-9e86-ffbaffb8115c` | `python-backend/` | `https://geoseo-api-production.up.railway.app` | `/health` |

The frontend build and start configuration lives in `railway.json`. The backend
configuration lives in `python-backend/railway.json`.

### Supabase

- Project ref: `ztfspznjdfqgumzvtmtz`
- Project URL: `https://ztfspznjdfqgumzvtmtz.supabase.co`
- Migrations: `supabase/migrations/`
- Edge Functions: `supabase/functions/`
- Public signup is intentionally disabled. Users are created administratively.
- Production Site URL: `https://geoseo-web-production.up.railway.app`

Do not put the database password, service-role key, JWTs, API keys, or temporary
user passwords in this file, source files, commits, terminal output, or issues.

## Railway CLI

Confirm authentication and project state:

```bash
railway whoami
railway service list --json
```

Useful read-only checks:

```bash
railway deployment list \
  --project b38eb571-2505-4987-9c45-7a824552f6bf \
  --environment production \
  --service geoseo-web \
  --json

railway logs \
  --project b38eb571-2505-4987-9c45-7a824552f6bf \
  --environment production \
  --service geoseo-web \
  --lines 200

railway logs \
  --project b38eb571-2505-4987-9c45-7a824552f6bf \
  --environment production \
  --service geoseo-api \
  --lines 200
```

### Deploy the frontend

Run from the repository root. The explicit path and `--path-as-root` are
important so Railway includes `/railway.json` in the upload.

```bash
railway up . \
  --path-as-root \
  --detach \
  --json \
  --yes \
  --project b38eb571-2505-4987-9c45-7a824552f6bf \
  --environment production \
  --service geoseo-web \
  --message "Describe the frontend change"
```

### Deploy the backend

Run from `python-backend/`:

```bash
cd python-backend

railway up . \
  --path-as-root \
  --detach \
  --json \
  --yes \
  --project b38eb571-2505-4987-9c45-7a824552f6bf \
  --environment production \
  --service geoseo-api \
  --message "Describe the backend change"
```

After every deployment, poll the deployment status and verify the health URL.
Do not report success while the newest deployment is still `BUILDING` or
`DEPLOYING`.

```bash
curl -fsS https://geoseo-web-production.up.railway.app/api/health
curl -fsS https://geoseo-api-production.up.railway.app/health
```

### Manage variables safely

Use `--stdin` for secrets so their values are not embedded in command history:

```bash
printf '%s' "$SECRET_VALUE" | railway variable set VARIABLE_NAME \
  --stdin \
  --skip-deploys \
  --project b38eb571-2505-4987-9c45-7a824552f6bf \
  --environment production \
  --service geoseo-api
```

Redeploy the affected service after using `--skip-deploys`:

```bash
railway redeploy \
  --yes \
  --project b38eb571-2505-4987-9c45-7a824552f6bf \
  --environment production \
  --service geoseo-api
```

Important frontend variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PYTHON_BACKEND_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SIGNUPS_ENABLED=false`
- `GEMINI_API_KEY`

Important backend variables:

- `GEMINI_API_KEY`
- `GEMINI_MODEL_CONTEXT=gemini-3.1-flash-lite`
- `GEMINI_CONTEXT_USE_GOOGLE_SEARCH=false`
- `CORS_ORIGINS=https://geoseo-web-production.up.railway.app`
- Optional integrations: `SERPER_API_KEY`, `SE_RANKING_API_KEY`

Google Search grounding uses a separate Gemini quota and is intentionally
disabled for Context analysis. The Context service securely fetches public
website text and sends that content to Gemini. Only enable Search grounding
after confirming billing and quota in Google AI Studio.

## Supabase operations

Install and authenticate the Supabase CLI, then link the project:

```bash
supabase login
supabase link --project-ref ztfspznjdfqgumzvtmtz
```

Inspect migration state before applying anything:

```bash
supabase migration list
supabase db diff
```

Apply committed migrations:

```bash
supabase db push
```

Rules for database changes:

1. Add a new migration; do not edit a migration already applied to production.
2. Review generated SQL before `supabase db push`.
3. Preserve Row Level Security on user-owned tables.
4. Use the service-role key only on the server.
5. Never expose the service-role key through a `NEXT_PUBLIC_*` variable.
6. Back up or confirm a rollback path before destructive schema/data changes.

### Authentication

The application is login-only. Keep these settings aligned:

- Supabase Auth: **Allow new users to sign up** is off.
- Frontend: no signup form is rendered.
- Railway: `NEXT_PUBLIC_SIGNUPS_ENABLED=false`.
- Supabase Auth Site URL points to the production web URL.
- Required callback/reset URLs must be added to the Supabase redirect allowlist.

Create users through the Supabase Admin API, not public signup. Generate a strong
temporary password, set `email_confirm: true`, communicate the password through a
secure channel, and require it to be changed after first login. Never commit user
credentials.

## Local development

Frontend:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Backend, in a virtual environment:

```bash
cd python-backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```

Recommended local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Backend Swagger: `http://localhost:8000/docs`

Use `.env.local` for the frontend and `python-backend/.env` for the backend. Both
are ignored by Git. Start from `.env.example`; never replace placeholders there
with real values.

## Verification before committing

### Browser validation is required

For every user-visible change or production bug fix, validate the complete
affected workflow manually in the deployed application with Browser Use. Do not
treat a successful build, API response, health check, or unit test as sufficient
proof that the UI works.

The browser check must:

1. Reproduce the original user workflow with realistic data.
2. Exercise the relevant controls through the visible UI.
3. Verify the expected result is rendered, not merely returned by an API.
4. Reload the page when persistence is part of the feature and confirm the
   result remains available.
5. Inspect browser console errors and the relevant Railway logs.
6. Report exactly what was tested, including any untested edge cases.

Run browser validation again after the latest production deployment reaches
`SUCCESS`; a test against an older deployment does not count.

Frontend changes:

```bash
npm run build
```

Backend changes:

```bash
python3 -m py_compile \
  python-backend/core/config.py \
  python-backend/core/gemini_client.py \
  python-backend/services/context/opencontext/opencontext.py
```

Run targeted tests for the changed area when available. For production fixes,
also verify the real endpoint after deployment.

Context-analysis smoke test:

```bash
curl -sS --max-time 180 \
  -X POST https://geoseo-api-production.up.railway.app/api/v1/context/analyze \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://example.com/"}'
```

Expected: a JSON response with `"ai_called": true`. A response with
`"ai_called": false` means the service used its basic fallback; inspect backend
logs before treating that as success.

## Common failures

### `AI analysis failed`

Check backend logs for the precise cause:

- `API key present: False`: `GEMINI_API_KEY` is missing from `geoseo-api`.
- `429 RESOURCE_EXHAUSTED`: the selected model or Google Search grounding has no
  quota. Confirm `GEMINI_MODEL_CONTEXT` and keep Search grounding disabled unless
  billing supports it.
- `ai_called: false`: Gemini failed and the backend returned basic domain-only
  detection.
- JSON decoding errors: prefer the SDK's structured `response.parsed`; do not
  reparse valid schema output unnecessarily.

### Frontend cannot reach backend

- Confirm `PYTHON_BACKEND_URL=https://geoseo-api-production.up.railway.app`.
- Confirm backend `CORS_ORIGINS` contains only the current frontend production URL.
- Verify both health endpoints before changing application code.

### Authentication loops or invalid sessions

- Confirm frontend Supabase URL/key belong to project `ztfspznjdfqgumzvtmtz`.
- Confirm Supabase Site URL and redirect allowlist use the current Railway domain.
- Clear stale browser cookies only after verifying server configuration.
- Test credentials directly against Supabase before resetting a user's password.

## Git and release discipline

- Keep commits small and describe the operational outcome.
- Check `git diff --check` and scan staged changes for secrets before committing.
- Do not force-push `main`.
- Do not commit Railway/Supabase/Gemini secrets.
- Keep `main`, Railway production, and this guide synchronized after operational
  changes.
