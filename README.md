# AI Dev Team SaaS

Hosted multi-agent orchestration with risk gates — monetization-ready.

**Live:** https://ai-dev-team-saas.vercel.app  
**Repo:** https://github.com/Mourad-Soltani/ai-dev-team-saas

## Product

Submit a development goal → six agents consensus → risk scored → safe steps auto-execute, dangerous ones escalate for **Approve / Reject**.

| Plan | Price | Limits |
|------|-------|--------|
| Free | $0 | 5 runs/day, browser history |
| Pro | $49/mo | Unlimited runs, 90-day history |
| Team | $149/mo | 5 seats, shared escalations |

## Features

Technical deep-dive: see **[ORCHESTRATION.md](./ORCHESTRATION.md)** (agents, consensus, risk, gate, live DeepSeek).

- Risk-aware escalation gate (production / auth / billing always human)
- Approve / Reject on escalated steps
- Free-tier daily run limits
- Run history (browser; DB-ready)
- Pricing page + Stripe Checkout
- Stripe webhook endpoint for subscription events

## Local

```bash
npm install
cp .env.example .env.local   # optional — works in demo mode without keys
npm run dev
```

## Monetization setup (Vercel)

### 1. Stripe

1. Create products/prices in [Stripe Dashboard](https://dashboard.stripe.com):
   - Pro → $49/month → copy Price ID → `STRIPE_PRICE_PRO`
   - Team → $149/month → copy Price ID → `STRIPE_PRICE_TEAM`
2. API keys → `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Webhooks → endpoint `https://YOUR_DOMAIN/api/webhook/stripe`  
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`  
   → `STRIPE_WEBHOOK_SECRET`

### 2. Clerk (optional — full auth)

1. [clerk.com](https://clerk.com) → create app
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
3. Enable middleware protection when ready (see `src/middleware.ts`)

### 3. App URL

```
NEXT_PUBLIC_APP_URL=https://ai-dev-team-saas.vercel.app
```

Add all vars in **Vercel → Project → Settings → Environment Variables**, then redeploy.

## Demo mode (no keys)

Works out of the box:
- Free plan limits enforced in the browser
- Approve / Reject works
- Checkout shows a clear “Stripe not configured” message until keys are set
- After a successful Stripe checkout, `?checkout=success&plan=pro` unlocks Pro in localStorage (replace with DB + Clerk for production)

## API

- `POST /api/runs` — run orchestration
- `POST /api/decisions` — record human approve/reject
- `POST /api/checkout` — create Stripe subscription session
- `POST /api/webhook/stripe` — Stripe events

## Stack

Next.js 14 · TypeScript · Tailwind · Stripe · Clerk-ready
