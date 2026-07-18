# HyperNiche AI - Email System

## Architecture (DRY & MECE)

```
supabase/functions/
├── _shared/
│   ├── resend.ts              # Resend API client
│   └── email-templates.ts     # Global design system (9 templates)
│
├── send-auth-email/           # ALL auth emails (signup, recovery, magic link)
├── send-welcome-email/        # Welcome after email confirmation
└── send-subscription-email/   # ALL billing emails (5 types)
```

## Edge Functions (3 total)

| Function | Purpose | Triggered By |
|----------|---------|--------------|
| `send-auth-email` | Signup confirmation, password reset, magic link | Supabase Auth Hook |
| `send-welcome-email` | Welcome email after confirmation | Database trigger |
| `send-subscription-email` | Subscription created/updated/cancelled, payment failed, invoice | Stripe webhooks |

## Email Types Handled

### send-auth-email
- `signup` → Confirmation email
- `recovery` → Password reset
- `magiclink` → Magic link login
- `email_change` → Email change confirmation

### send-subscription-email
- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`
- `payment_failed`
- `invoice_paid`

## Global Design System

All templates defined in `_shared/email-templates.ts`:

**To change branding globally, edit ONE file:**

| What | Location |
|------|----------|
| Colors | `COLORS` object (lines 9-21) |
| Styles | `STYLES` object (lines 24-135) |
| Layout | `emailLayout()` (lines 140-195) |

## Setup

### 1. Secrets (already configured)
```
RESEND_API_KEY    ✓
SITE_URL          ✓
AUTH_HOOK_SECRET  ✓
```

### 2. Enable Auth Hook (Dashboard)
1. Go to: **Authentication → Hooks → Send Email**
2. Enable and set URI: `https://qogsvugxdosqshixqugf.supabase.co/functions/v1/send-auth-email`

## Testing

```bash
# Test auth email
curl -X POST 'https://qogsvugxdosqshixqugf.supabase.co/functions/v1/send-auth-email' \
  -H 'Authorization: Bearer <service-role-key>' \
  -H 'Content-Type: application/json' \
  -d '{"user":{"id":"test","email":"you@email.com"},"email_data":{"token_hash":"x","site_url":"https://hyperniche.ai","email_action_type":"signup"}}'

# Test subscription email
curl -X POST 'https://qogsvugxdosqshixqugf.supabase.co/functions/v1/send-subscription-email' \
  -H 'Authorization: Bearer <service-role-key>' \
  -H 'Content-Type: application/json' \
  -d '{"email_type":"subscription_created","user_email":"you@email.com","user_id":"test","data":{"plan_name":"Pro","amount":"$29","billing_cycle":"monthly"}}'
```

## Redeploying

```bash
npx supabase functions deploy --project-ref qogsvugxdosqshixqugf
```
