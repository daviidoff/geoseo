# Google OAuth Setup for HyperNiche AI

## Overview

This guide walks through setting up Google Sign-In for HyperNiche using Supabase Auth.

## Part 1: Google Cloud Console Setup

### Step 1: Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen first:
   - User Type: **External**
   - App name: `HyperNiche AI`
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add `email`, `profile`, `openid`
   - Test users: Add your email (for testing before verification)

### Step 2: Create OAuth Client ID

1. Application type: **Web application**
2. Name: `HyperNiche Web`
3. **Authorized JavaScript origins:**
   - Development: `http://localhost:3000`
   - Production: `https://your-domain.com`
4. **Authorized redirect URIs:**
   - Development: `http://localhost:54321/auth/v1/callback`
   - Production: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`

5. Click **Create** and copy:
   - **Client ID**: `xxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxx`

## Part 2: Supabase Dashboard Setup

### Step 1: Enable Google Provider

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and click to expand
5. Toggle **Enable Sign in with Google** to ON
6. Enter:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console
7. Click **Save**

### Step 2: Configure Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:

| Setting | Development | Production |
|---------|-------------|------------|
| Site URL | `http://localhost:3000` | `https://your-domain.com` |
| Redirect URLs | `http://localhost:3000/auth/callback` | `https://your-domain.com/auth/callback` |

## Part 3: Environment Variables

No additional environment variables needed. The Google OAuth flow is handled entirely through Supabase.

## Testing

### Local Development

1. Start your local Supabase: `npx supabase start`
2. Start the Next.js dev server: `npm run dev`
3. Go to `http://localhost:3000/auth`
4. Click "Continue with Google"
5. You should be redirected to Google, then back to `/context` after auth

### Production

For production, ensure:
1. Google Cloud OAuth consent screen is verified (if >100 users)
2. Production URLs are added to both Google Cloud and Supabase
3. Supabase Site URL is set to production domain

## Troubleshooting

### "redirect_uri_mismatch" Error

- Verify the redirect URI in Google Cloud Console matches exactly:
  - Local: `http://localhost:54321/auth/v1/callback`
  - Hosted: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

### "access_denied" Error

- Check if your email is in the test users list (Google Console)
- Or submit OAuth consent screen for verification

### User Not Redirected After Auth

- Check Supabase URL Configuration → Site URL
- Verify `/auth/callback` route exists and exchanges code

## Code Reference

- Auth Context: `contexts/AuthContext.tsx` (lines 161-175)
- Auth Form: `components/auth/AuthForm.tsx` (Google button)
- Callback: `app/auth/callback/route.ts`
