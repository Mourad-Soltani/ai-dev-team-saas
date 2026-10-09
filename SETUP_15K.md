# Setup guide — $15k-ready package

Features implemented in code. Wire secrets in Vercel to activate.

## 1. Supabase (persistence + limits + inbox)

1. Create a project at https://supabase.com
2. SQL editor → run the schema from `src/lib/supabase.ts` (`SCHEMA_SQL`)
3. Vercel env:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Redeploy

Enables: server-side free-tier limits, saved runs/steps, `/inbox` pending escalations.

## 2. Stripe (billing proof)

1. Create Pro ($49) and Team ($149) recurring prices
2. Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`
3. Webhook endpoint: `https://YOUR_DOMAIN/api/webhook/stripe`
4. Complete one test checkout

## 3. OpenRouter (live agents — already proven)

Settings → OpenRouter key → model → run. No server env required (BYO in browser).

## 4. GitHub issue on Approve

Settings → GitHub token + `owner/repo` → Approve an escalated step → issue created.

## 5. Clerk (optional full auth)

1. Create Clerk app
2. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
3. Replace middleware with `clerkMiddleware()` when ready

## 6. Loom for buyers

Record: OpenRouter live → mixed opinions → production escalate → Approve → GitHub/Slack → Export audit → `/pricing`.

## Checklist vs $15k target

- [x] OpenRouter live agents
- [x] Risk gate + HITL + audit export
- [x] Stripe Checkout + webhook code
- [x] Supabase persistence layer
- [x] Server-side usage limits (when DB set)
- [x] Escalation inbox page
- [x] GitHub issue on Approve
- [ ] Your Stripe keys + test payment
- [ ] Your Supabase project + schema
- [ ] Loom proof video
