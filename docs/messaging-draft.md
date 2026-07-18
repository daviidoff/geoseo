# HyperNiche Messaging Draft

## Current vs Proposed

### Auth Page - Hero (Right Panel)

**CURRENT:**
```
HyperNiche AI
Unlimited AEO content. $99/month.

✓ No credit limits
✓ Rank in ChatGPT & Perplexity
✓ 50 free credits to start
```

**PROPOSED v1 - Results Focus:**
```
HyperNiche AI
Be the answer AI recommends.

✓ Rank in ChatGPT, Perplexity & Claude
✓ AEO-optimized content in minutes
✓ No technical skills needed
```

**PROPOSED v2 - Competitive Edge:**
```
HyperNiche AI
Your competitors are invisible to AI. You won't be.

✓ Get found in AI search results
✓ Set up in 5 minutes
✓ Start free, scale when ready
```

**PROPOSED v3 - Direct/Action:**
```
HyperNiche AI
Get found where customers actually search.

✓ AI search optimization made simple
✓ From zero to visible in one session
✓ 50 free credits to start
```

---

### Auth Page - Welcome Text

**CURRENT:**
```
Welcome
Sign in to continue
```

**PROPOSED:**
```
Welcome
Start ranking in AI search
```

---

### Mobile Header

**CURRENT:**
```
HyperNiche AI
Unlimited AEO content
```

**PROPOSED:**
```
HyperNiche AI
Rank in AI search results
```

---

### Value Props Comparison

| Current | Proposed |
|---------|----------|
| No credit limits | Rank in ChatGPT, Perplexity & Claude |
| Rank in ChatGPT & Perplexity | Set up in 5 minutes |
| 50 free credits to start | No technical skills needed |

---

### Where $99 Should Appear

Move price to:
1. **Pricing page** (dedicated comparison)
2. **Upgrade modal** (when user hits free limit)
3. **Profile/billing** (for existing users)

NOT on:
- Auth page hero
- Landing page hero
- First-time user onboarding

---

### Tagline Options

Short (for headers):
- "Be the answer AI recommends"
- "Rank where AI searches"
- "AI visibility, simplified"

Medium (for descriptions):
- "Get your content found in ChatGPT, Perplexity, and AI search"
- "The simple way to rank in AI-powered search results"

---

## Questions to Decide

1. Which hero version (v1, v2, v3) feels right?
2. Keep "50 free credits" or change to "Start free"?
3. Include "HyperNiche AI" branding or just "HyperNiche"?

---

## Files to Update (when approved)

- `app/auth/page.tsx` - Auth page hero + mobile header
- `app/page.tsx` - Landing page (if exists)
- `components/auth/AuthForm.tsx` - Welcome text area
