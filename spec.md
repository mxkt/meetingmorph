# MeetingMorph — Product Specification

## Overview

**Product:** MeetingMorph
**One-liner:** Turn chaotic meeting notes into structured action items
**Target Audience:** Remote engineering teams
**Pricing Model:** one-time (defaulted — see Open Questions)
**Price:** $0 (defaulted — see Open Questions)
**Repository:** https://github.com/mxkt/meetingmorph
**LemonSqueezy Product ID:** ls_prod_999 (currently draft — must be published)

MeetingMorph is an AI-powered meeting transcript parser that accepts raw meeting notes or transcripts and outputs structured, assignable action items formatted for direct push to Linear and Jira. It runs entirely on Cloudflare Workers at the edge, uses KV for session/purchase state, and integrates LemonSqueezy for payment processing.

## Problem & Differentiation

**Problem Statement:** Engineers waste time manually converting messy meeting notes into tracked tasks. After every standup, sprint planning, or retrospective, someone must manually parse what was discussed, identify action items, assign owners, set deadlines, and create tickets in Linear or Jira. This process takes 10–30 minutes per meeting (MEDIUM confidence — inferred from competitor marketing claims) and is error-prone, leading to dropped tasks and missed commitments.

**Hypothesized Solution:** An AI-powered meeting transcript parser that accepts raw text (pasted transcript, uploaded notes, or direct input) and outputs structured action items with assignee suggestions, priority levels, and deadline estimates — formatted for one-click export to Linear and Jira.

**Differentiation Statement:** MeetingMorph is the only tool that converts raw meeting text into structured, assignable action items pushed natively to Linear and Jira without requiring intermediary automation platforms (Zapier/Make), at a one-time price point accessible to small engineering teams — eliminating the per-seat subscription tax and manual copy-paste workflow that every major competitor requires.

## Market Context

### Competitor Comparison

| Competitor | Pricing | Key Features | Target Audience | Weakness | Source URL |
|---|---|---|---|---|---|
| Fireflies.ai | Free; Pro $10/user/mo; Business $19/user/mo (annual) — source: claap.io/blog/fireflies-pricing, verified Jan 2026 | Transcription in 100+ languages, AskFred AI assistant, action item detection, CRM integrations (Salesforce, HubSpot) | Sales teams, ops teams, enterprises | No native Linear/Jira integration for action items; requires Zapier for task tracker push; per-seat pricing scales poorly for small teams; AI credits cost extra on top of subscription | https://www.claap.io/blog/fireflies-pricing |
| Otter.ai | Free (300 min/mo); Pro $8.33/user/mo; Business $20/user/mo (annual) — source: brasstranscripts.com, verified Oct 2025 | Real-time transcription, speaker tagging, AI-generated action items, searchable archive | General meetings, freelancers, small teams | Action items are vague (e.g. "team to finalize requirements" without assignee/deadline); no direct Linear/Jira integration; minute caps on all plans; English/French/Spanish only | https://brasstranscripts.com/blog/otter-ai-pricing-2025-subscription-vs-usage-based |
| Fellow.ai | Starting at $7/user/mo — source: fellow.ai, verified 2026 | Meeting agendas, AI notes, action items, 50+ integrations (Jira, Asana, Linear, Slack), transcript redaction | Mid-size orgs, enterprise teams | Requires desktop app for botless capture; meeting management platform (not just parser); complex setup for simple use case; per-seat model | https://fellow.ai/blog/bot-free-ai-note-takers/ |
| Fathom | Free (unlimited recordings); Pro plans available — source: meetingnotes.com, verified Feb 2026 | Unlimited free transcription, auto action items with team tagging, CRM sync, HIPAA/GDPR/SOC2 compliant | Privacy-conscious teams, consultants | Primarily Zoom-only (limited Teams support); zero Jira/Asana/Linear integration; all action items must be manually transferred to task trackers | https://meetingnotes.com/blog/best-ai-meeting-minutes-tools |
| MeetGeek | Pro $9.99/user/mo; Business $17/user/mo — source: meetgeek.ai, verified 2026 | Multilingual transcription (15+ languages), AI summaries, templates, 7000+ integrations via Zapier/Make | Global teams, cross-border orgs | Native integrations are indirect (Zapier/Make only); no direct Linear/Jira API push; per-seat pricing; complexity overhead for simple transcript-to-task workflow | https://meetgeek.ai/blog/otter-ai-pricing |
| Granola | Starting at EUR 47/user/mo — source: fellow.ai teardown, verified 2026 | Local audio processing, polished notes + action items, meeting templates, no raw audio storage | Individual productivity, freelancers | Extremely expensive; no team features; no PM tool integrations; limited speaker identification; no enterprise compliance | https://fellow.ai/blog/bot-free-ai-note-takers/ |

### Key Insight

Every major competitor is a **full meeting platform** (recording + transcription + notes + action items) sold on a **per-seat subscription** model. None offer a lightweight, paste-your-transcript tool that directly outputs to Linear/Jira. MeetingMorph occupies the gap between "full meeting intelligence platform" and "manual copy-paste" — a focused parser at a one-time price.

## Architecture

```
Browser ──► Cloudflare Worker (edge API) ──► KV Store (sessions / purchases / rate-limit)
         │                                ├──► LemonSqueezy API (checkout creation)
         │                                └──◄ LemonSqueezy Webhook (order_created)
         │
         └──► Static Assets (public/index.html, CSS, JS)

Push to main ──► GitHub Actions ──► Wrangler deploy ──► Cloudflare Workers
```

**Request Flow:**
1. User visits landing page (served from Worker as static HTML)
2. User pastes meeting transcript into input form
3. `POST /api/parse` sends transcript to Worker
4. Worker checks auth/purchase status via KV (`purchases:{userId}:{productId}`)
5. If authorized: Worker parses transcript using built-in AI logic, returns structured action items
6. If not authorized: Worker returns 402 with checkout URL
7. User can export action items as JSON, Markdown, or formatted for Linear/Jira API

**Payment Flow:**
1. User clicks "Buy" → `POST /api/checkout` → Worker calls LemonSqueezy `POST /v1/checkouts` → returns redirect URL
2. User completes payment on LemonSqueezy hosted checkout
3. LemonSqueezy sends `order_created` webhook → `POST /api/webhooks/ls`
4. Worker verifies HMAC-SHA256 signature, updates `purchases:{userId}:{productId}` in KV
5. User refreshes → auth middleware reads KV → grants access

## Tech Stack

| Technology | Rationale |
|---|---|
| **Node.js (TypeScript)** | Primary language of the developer; type safety reduces bugs in webhook/payment logic where correctness is critical |
| **Cloudflare Workers** | Edge deployment gives sub-50ms response times globally for remote engineering teams across timezones; zero cold starts vs. traditional serverless |
| **Cloudflare KV** | Simple key-value storage is sufficient for session, purchase, and rate-limit data; no relational queries needed; globally replicated |
| **Tailwind CSS** | Utility-first CSS enables rapid landing page iteration without custom stylesheet maintenance |
| **shadcn/ui** | Pre-built accessible components (buttons, forms, cards) accelerate frontend development while maintaining design consistency |
| **LemonSqueezy** | Merchant-of-record handles EU VAT compliance automatically — critical for European market targeting; simple API for one-time payments |
| **GitHub Actions** | CI/CD pipeline integrated with the repository; Wrangler action deploys directly to Cloudflare Workers on every push to main |

## Data Model

| KV Namespace | Key Pattern | Value Schema | TTL |
|---|---|---|---|
| `meetingmorph-sessions` | `sessions:{userId}` | `{ "userId": string, "email": string, "createdAt": string (ISO 8601), "lastActiveAt": string (ISO 8601) }` | 86400 (24 hours) |
| `meetingmorph-products` | `products:{productId}` | `{ "productId": string, "name": string, "priceUsd": number, "lsProductId": string, "lsVariantId": string, "checkoutUrl": string, "isActive": boolean }` | 0 (no expiry) |
| `meetingmorph-purchases` | `purchases:{userId}:{productId}` | `{ "userId": string, "productId": string, "orderId": string, "status": "completed" | "refunded", "purchasedAt": string (ISO 8601), "lsOrderId": string }` | 0 (no expiry) |
| `meetingmorph-ratelimit` | `ratelimit:{ip}` | `{ "count": number, "windowStart": string (ISO 8601) }` | 3600 (1 hour) |

## API Routes

| Method | Path | Purpose | Auth | Request Body | Response | LS Integration |
|--------|------|---------|------|-------------|----------|----------------|
| GET | `/` | Serve landing page (static HTML) | No | — | `text/html` 200 | — |
| GET | `/api/health` | Health check endpoint | No | — | `{ "status": "ok", "timestamp": string }` 200 | — |
| POST | `/api/auth/session` | Create or retrieve session by email | No | `{ "email": string }` | `{ "sessionId": string, "userId": string }` 200 | — |
| GET | `/api/auth/session/:id` | Validate existing session | No | — | `{ "valid": boolean, "userId": string }` 200 | — |
| POST | `/api/parse` | Parse meeting transcript into action items | Yes | `{ "transcript": string, "format": "json" \| "markdown" \| "linear" \| "jira" }` | `{ "actionItems": [{ "title": string, "assignee": string \| null, "priority": "high" \| "medium" \| "low", "deadline": string \| null, "description": string }], "summary": string, "parsedAt": string }` 200 | — |
| GET | `/api/purchases/:userId` | Check if user has active purchase | Yes | — | `{ "hasPurchase": boolean, "purchase": object \| null }` 200 | — |
| POST | `/api/checkout` | Create LemonSqueezy checkout session | Yes | `{ "userId": string, "productId": string }` | `{ "checkoutUrl": string }` 200 | Creates LS checkout via `POST /v1/checkouts` |
| POST | `/api/webhooks/ls` | Handle LemonSqueezy webhook events | No (HMAC verified) | LemonSqueezy webhook payload | `{ "received": true }` 200 | Receives `order_created`, `subscription_created`, `subscription_updated`, `subscription_cancelled` |
| GET | `/api/export/linear` | Format action items for Linear API | Yes | Query: `?parseId={id}` | `{ "issues": [{ "title": string, "description": string, "priority": number, "assigneeId": string \| null }] }` 200 | — |
| GET | `/api/export/jira` | Format action items for Jira API | Yes | Query: `?parseId={id}` | `{ "issues": [{ "summary": string, "description": string, "priority": { "name": string }, "assignee": { "name": string } \| null }] }` 200 | — |

## LemonSqueezy Integration

### Touchpoint A — Checkout Creation

**Endpoint:** `POST /api/checkout`

**Flow:**
1. Authenticated user sends `{ userId, productId }`
2. Worker reads product details from KV (`products:{productId}`) to get `lsVariantId`
3. Worker calls LemonSqueezy `POST /v1/checkouts` with:
   ```json
   {
     "data": {
       "type": "checkouts",
       "attributes": {
         "checkout_data": {
           "custom": { "user_id": "{userId}" }
         }
       },
       "relationships": {
         "store": { "data": { "type": "stores", "id": "{LEMON_SQUEEZY_STORE_ID}" } },
         "variant": { "data": { "type": "variants", "id": "{lsVariantId}" } }
       }
     }
   }
   ```
4. Returns checkout URL to client for redirect

### Touchpoint B — Webhook Handler

**Endpoint:** `POST /api/webhooks/ls`

**Flow:**
1. Receive webhook POST from LemonSqueezy
2. Extract `X-Signature` header
3. Compute HMAC-SHA256 of raw request body using `LEMON_SQUEEZY_WEBHOOK_SECRET` env var
4. Compare computed signature with `X-Signature` — reject with 401 if mismatch
5. Parse event type from payload (`meta.event_name`)
6. On `order_created`: extract `custom.user_id` and product info → write to KV `purchases:{userId}:{productId}` with status `completed`
7. On `subscription_cancelled`: update purchase record status to `cancelled`
8. Return `{ "received": true }` 200

### Touchpoint C — Auth Middleware (Purchase Gate)

**Flow:**
1. On every request to protected routes (`/api/parse`, `/api/export/*`, `/api/purchases/*`)
2. Extract `userId` from session (via cookie or Authorization header)
3. Read KV `purchases:{userId}:{productId}`
4. If purchase exists with `status: "completed"` → allow request
5. If no purchase → return 402 with `{ "error": "purchase_required", "checkoutUrl": "{ls_checkout_url}" }`

## Deployment Configuration

**`wrangler.toml`:**
```toml
name = "meetingmorph"
main = "src/index.ts"
compatibility_date = "2026-03-01"

[vars]
ENVIRONMENT = "production"
LEMON_SQUEEZY_STORE_ID = ""
LEMON_SQUEEZY_CHECKOUT_URL = ""
LEMON_SQUEEZY_PRODUCT_ID = ""

[[kv_namespaces]]
binding = "SESSIONS"
id = ""
preview_id = ""

[[kv_namespaces]]
binding = "PRODUCTS"
id = ""
preview_id = ""

[[kv_namespaces]]
binding = "PURCHASES"
id = ""
preview_id = ""

[[kv_namespaces]]
binding = "RATELIMIT"
id = ""
preview_id = ""

# Secrets (set via wrangler secret put, never in this file):
# LEMON_SQUEEZY_API_KEY
# LEMON_SQUEEZY_WEBHOOK_SECRET
# CLOUDFLARE_API_TOKEN (used by GitHub Actions, not by Worker)
```

**GitHub Actions CI/CD:** `.github/workflows/deploy.yml` deploys to Cloudflare Workers on every push to `main` using `cloudflare/wrangler-action@v3`.

## Environment Variables

| Variable Name | Used By | Required |
|---|---|---|
| `LEMON_SQUEEZY_API_KEY` | Checkout creation (Touchpoint A) | Yes |
| `LEMON_SQUEEZY_WEBHOOK_SECRET` | Webhook HMAC verification (Touchpoint B) | Yes |
| `LEMON_SQUEEZY_STORE_ID` | Checkout creation, product lookup | Yes |
| `LEMON_SQUEEZY_CHECKOUT_URL` | Fallback checkout URL for 402 responses | Yes |
| `LEMON_SQUEEZY_PRODUCT_ID` | Product identification in KV | Yes |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions Wrangler deploy | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions Wrangler deploy | Yes |
| `ENVIRONMENT` | Runtime environment flag (production/staging) | No |

## Open Questions

- [ASSUMPTION] `pricing_model` defaulted to `one-time` | Verify whether MeetingMorph should use subscription pricing (monthly/annual) given that all competitors use per-seat subscriptions. One-time may be the differentiation angle, but recurring revenue is more sustainable.
- [ASSUMPTION] `price_usd` defaulted to `0` | Determine actual price point before launch. Competitors range from $7–47/user/mo. A one-time price of $29–49 would undercut annual competitor costs while generating immediate revenue. Current $0 means no revenue.
- [ASSUMPTION] KV namespace IDs left empty in `wrangler.toml` | Must be created via `wrangler kv:namespace create` before first deploy and IDs added to config.
- [ASSUMPTION] No custom domain configured | Worker will be available at `meetingmorph.mxkt.workers.dev` by default. Custom domain requires DNS setup (out of scope for this skill).
- [ASSUMPTION] Transcript parsing uses pattern-matching heuristics (not external AI API) | If an external LLM API (e.g., Claude API, OpenAI) is needed for higher-quality parsing, additional secrets and billing would be required.
- [ASSUMPTION] Linear/Jira export is format-only (client-side API calls) | Direct server-side integration with Linear/Jira APIs would require OAuth tokens per user, which adds significant complexity.
