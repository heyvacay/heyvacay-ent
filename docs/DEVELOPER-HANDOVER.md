# HeyVacay Enterprise — Developer Handover

A complete technical orientation for a developer taking over the HeyVacay
Enterprise codebase. It documents the architecture, the data layer in depth, the
auth model, every integration, the infrastructure, the deploy pipeline, and the
operational gotchas. Read §4 (Data architecture) carefully — it is the part most
likely to surprise you.

> Conventions: `ENT` = the enterprise traveler app in this repo. `Nova` = the
> internal admin/CRM surface (same codebase, admin routes). AWS account
> **256309399831**, region **us-west-2**, environment prefix **stage**.

---

## 1. What this is

HeyVacay Enterprise is a corporate travel & expense SaaS: employees book flights,
hotels, rental cars/rideshare and restaurants under company policy; admins manage
people, policy, budgets, approvals, expenses and billing; a sales/CRM surface
(Nova) provisions and supports customer accounts. It is a sibling of the
consumer product and reuses the same live booking engine behind an enterprise
channel.

### Repositories

| Repo | Role |
|---|---|
| **heyvacay-ent** (this repo) | The Next.js enterprise app (traveler + Nova admin + all API routes). |
| **heyvacay-iac** | Terraform for all AWS infra (ECS, ALB, DynamoDB, IAM, Secrets, DNS). |
| **heyvacay backend** | The shared booking engine; ENT talks to it over HTTPS with a service token (`API_BASE_URL` + `ENT_BACKEND_SERVICE_TOKEN`). |

### Hosts (stage)

- `ent.stage.heyvacay.co` — traveler app.
- Nova admin surface — served from the same app/host under admin routes.
- Served **directly by the ALB — there is NO CloudFront/CDN in front of ENT.**
  This matters: a deploy is visible immediately (no cache invalidation), and a
  stale UI is almost always persisted client state (see §4), not a CDN.

---

## 2. Tech stack & runtime

- **Next.js 15.5** (App Router) with **React 19**, TypeScript, Tailwind.
- `next.config.ts`: `output: 'standalone'` (self-contained server bundle for the
  Docker image), `reactStrictMode: true`, and
  `serverExternalPackages: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb']`
  so the AWS SDK is required at runtime, not bundled.
- **Node 20** (CI uses `node-version: '20'`; match it locally).
- Scripts: `dev`, `build`, `start`, `lint`, `type-check` (`tsc --noEmit`).
- Runs as a single container on **ECS Fargate** behind the ALB.
- Server code uses the `'use client'` / server-module split. Files ending
  `.server.ts` are server-only (`import 'server-only'`); never import them into a
  client component.

---

## 3. Repository layout (ENT)

```
src/
  app/                      # App Router: pages + /api route handlers
    app/                    # the traveler app (book, plan, events, expenses, people, integrations…)
    sales/                  # Nova: CRM, invoicing, commission
    signin/ signup/ forgot/ reset/   # auth screens
    api/                    # ~90 route handlers (see §6, §8). Node runtime.
  components/
    app/                    # app UI (ui.tsx primitives, results cards, modals, wizards…)
    icons.tsx               # hand-rolled SVG icon set (lucide-react also used directly)
  lib/
    store.tsx               # traveler-app client state (useStore)            ← §4
    crmStore.tsx            # Nova CRM client state (useCrm)                  ← §4
    eventsStore.tsx         # events client state (useEvents)                 ← §4
    workspaceSync.ts        # client↔server sync fetch/push helpers           ← §4
    workspaceStore.server.ts# DynamoDB workspace read/write (row-per-entity)  ← §4
    auth/                   # password/session/identity/account (server)      ← §5
    integrations/           # per-provider server clients + tokenStore        ← §6
    config.server.ts        # all env-var reads + "is this live?" flags
    rideshare.ts            # ground-transport savings model (rideshare vs rental)
    types.ts                # shared domain types (Company, Policy, Booking…)
    seed.ts                 # SEED: the demo/default workspace
docs/                       # this file, PRODUCTION-READINESS.md, INTEGRATION-SETUP.md
Dockerfile.prod             # production image (standalone server)
.github/workflows/stage-web-ent.yml   # CI/CD (see §9)
```

---

## 4. Data architecture — READ THIS

### 4.1 The model in one paragraph

ENT is **local-first with a shared server store**. Every company's app state
lives in the browser's `localStorage` for instant reads, and is **synced
through DynamoDB** so every device in a company converges on the same data. If
the DynamoDB tables don't exist / aren't wired, the server falls back to an
**in-process memory map** (per container, non-durable) and the app still runs
entirely on local storage — which looks like "the database isn't working" but is
actually the designed fallback. **The single most important operational fact in
this whole document: the tables must be created with `terraform apply`** (see
§4.6).

### 4.2 The three DynamoDB tables

All three: `PAY_PER_REQUEST` (on-demand) billing, **server-side encryption on**,
**point-in-time recovery on**. The ECS **task role** is granted
`GetItem/PutItem/UpdateItem/DeleteItem/Query/BatchWriteItem/BatchGetItem` scoped
to exactly these three tables (see `heyvacay-iac/ent.tf`).

| Table (stage name) | Key schema | Holds | App env var |
|---|---|---|---|
| `stage-heyvacay-ent-workspace` | **composite**: `pk` = companyId (S), `sk` = `"<type>#<id>"` (S) | The entire per-company app state, one row per entity | `WORKSPACE_DDB_TABLE` |
| `stage-heyvacay-ent-identities` | `pk` = lowercased email (S) | Accounts: scrypt password hash + HMAC-hashed verify/reset tokens | `IDENTITIES_DDB_TABLE` |
| `stage-heyvacay-ent-integrations` | `pk` = `"<companyId>#<provider>"` (S) | Per-company integration connections (OAuth tokens, API keys, webhooks, mappings) | `INTEGRATIONS_DDB_TABLE` |

Each `*_DDB_TABLE` env var is wired onto the ECS task **by terraform**. If the
var is unset, `config.server.ts` falls back to the literal default name (e.g.
`stage-heyvacay-ent-workspace`), so the code always has a table name to target —
but the table still has to exist, and the task role still has to be allowed to
reach it. Both are terraform's job.

### 4.3 Workspace table — row-per-entity layout

`workspaceStore.server.ts` explodes a company's `AppState` into **one DynamoDB
item per entity** under the company partition:

```
pk = "<companyId>"
sk = "settings#root"     → { role, + scalar/company-level state (company, policies, budgets…) }
sk = "user#u_123"        → a user record
sk = "booking#bk_9"      → a booking
sk = "expense#ex_4"      → an expense
sk = "point#..."         → a rewards point row
sk = "access#<id>"       → an audit-log entry (audit partition)
… one prefix per collection field in AppState
```

- **Read** (`loadWorkspace`): a single `Query` on `pk = companyId` returns every
  row for the company; `fromRows()` reassembles them into `AppState`. A fresh
  device therefore loads the live shared workspace in one query.
- **Write** (`saveWorkspace`): `toRows()` computes the **desired** row set, then a
  diff writer **upserts the desired rows and deletes stored rows only within the
  prefixes it manages** (`BatchWriteItem`). It never blind-deletes the partition,
  so an unrelated collection isn't clobbered by a partial write.
- **No DynamoDB client available** (SDK import fails / local dev without AWS):
  `workspaceStore.server.ts` uses an in-memory `Map` per company (`memCompany`).
  Durable only for the life of the container. This is the fallback that makes
  "multi-device" silently not work until the table exists.

### 4.4 Client state stores (the three React contexts)

| Hook | File | Scope |
|---|---|---|
| `useStore()` | `store.tsx` | Traveler app: company, users, bookings, expenses, points, budgets, policies, policy-change-requests, trip plans, history. |
| `useEvents()` | `eventsStore.tsx` | Events (offsites): the `TravelEvent[]`, dinners, RSVPs, allow-lists, ground-transport policy. |
| `useCrm()` | `crmStore.tsx` | Nova CRM: companies, reps, commission. |

All three follow the same lifecycle:

1. **Hydrate** from `localStorage` under an account-scoped key
   (`hv_ent_acct_<companyId>`, default login uses its own key). `hydrated`
   gates writes so the first render can't stomp storage.
2. **Pull** the shared copy from the server (`fetchWorkspace`), run it through
   `mergeLoaded` then `reconcileRemote`, and adopt the merged result.
3. **Write-through**: every state change writes `localStorage` immediately and
   schedules a **debounced (~1.2s) `pushWorkspace`** to the server. A
   `pagehide` + `visibilitychange(hidden)` handler **flushes** the pending push
   with `fetch(..., { keepalive: true })` so a tab close doesn't lose the last
   edit.

### 4.5 Two merge functions you must understand before touching the store

These exist because of a real class of bug ("my deploy isn't showing up", "my
pending trip vanished"). Both live in `store.tsx`.

- **`mergeLoaded(state)`** — reconciles *seed-level* content onto a loaded
  workspace. A workspace saved **before a feature existed** would otherwise never
  gain it. Specifically it (a) **unions the integrations catalog** (keeps each
  saved integration's connection status, **adds** any new catalog entries like
  Teams) and (b) **backfills `company.setup`** defaults onto older workspaces.
  When you add a new seed-level concept (a new integration, a new company
  setting), extend `mergeLoaded` or saved workspaces won't see it.
- **`reconcileRemote(local, remote)`** — merges the server copy with unsynced
  local work. It **keeps local-only** bookings/expenses/points/
  policyChangeRequests/tripPlans (prepended) and lets **remote win on id match**.
  This is what prevents a slightly-stale server pull from deleting a record the
  user just created locally before the debounce landed.

> ⚠️ Gotcha: a wholesale `setState(remote)` anywhere in the load path will wipe
> local-only records. Always go through `reconcileRemote`.

### 4.6 The operational truth

If **multi-device sync**, **durable passwords**, or **CRM→customer writes (KYC /
Net 30)** appear broken, it is almost always that **`terraform apply` has not
created the `workspace` + `identities` tables** (the `integrations` table was
applied earlier for QuickBooks). Until then the app is local-storage-only and the
server uses the in-memory fallback.

**Verify in one call:** `GET /api/integrations/diag` → the `storage` block.
`storage.ok: true` means all three tables exist and are `ACTIVE`; any table
showing `"missing (run terraform apply)"` is still fallback-only. The runbook is
`docs/PRODUCTION-READINESS.md`.

---

## 5. Auth & sessions (`src/lib/auth/`)

Self-contained in the ENT app — no external IdP required (SSO is a future add).

- **Passwords (`password.server.ts`)** — Node core `crypto` **scrypt** (memory-hard
  KDF, no native deps). Stored as a self-describing string:
  `scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>`. Each hash carries its own random
  16-byte salt + params, so parameters can change without invalidating old
  hashes. Verify is constant-time (`timingSafeEqual`).
- **Identities (`identityStore.server.ts`)** — the `identities` DynamoDB table,
  `pk` = lowercased email. Holds the scrypt hash (empty until an invited user
  sets a password) plus **HMAC hashes** of the outstanding verify/reset tokens
  and their expiries. **Raw tokens are never stored.**
- **Sessions (`session.server.ts`)** — stateless, HMAC-signed token
  `"<payloadB64url>.<sigHex>"` signed with `AUTH_SESSION_SECRET` (falls back to
  `ENT_BACKEND_SERVICE_TOKEN` if unset — set a dedicated secret in prod). Stored
  in an **httpOnly, Secure, SameSite=Lax** cookie, so it never reaches client JS
  and can't be forged client-side. Verification re-signs and checks expiry; a
  tampered/stale cookie simply reads as "no session".
- **Demo bypass** — the password `demo` short-circuits to a demo session for
  sales/demo use. Keep this working; it's used in live demos.
- **Routes** (`/api/auth/*`): `register`, `verify`, `login`, `logout`, `me`,
  `resend`, `forgot`, `reset`, `change-password`.
- Email verification + reset links only **send** when the Email integration is
  configured (§6); otherwise they render in preview mode.

---

## 6. Integrations (`src/lib/integrations/`)

### 6.1 Three kinds

1. **Platform OAuth apps** — ONE HeyVacay app at the provider; each customer
   connects with one click. Needs a redirect URL registered + client id/secret
   in Secrets Manager. **QuickBooks, Xero, Gusto, Google Workspace, Slack.**
2. **Platform single-key services** — one HeyVacay API key powers it for all
   customers. **Stripe, Veryfi, Email (Resend), OpenTable, Weather, Flight
   status, enterprise live-booking token.**
3. **Per-customer** — the customer enters their own credentials in-app; nothing
   central. **BambooHR, Microsoft Teams, Rippling, Okta, Workday, UKG, Ramp,
   Brex, NetSuite, Expensify.**

The authoritative per-integration runbook (redirect URLs, exact secret key names,
tfvars lines) is **`docs/INTEGRATION-SETUP.md`**.

### 6.2 Token store (`tokenStore.server.ts`)

Per-company connections live in the `integrations` table, `pk =
"<companyId>#<provider>"`, stored **flat** (`pk` is the only synthetic field).
`IntegrationConnection` carries `accessToken`, `refreshToken`, expiry, a flexible
`config` bag (BambooHR subdomain, Slack webhook URL, a stored API key, GL account
mappings…) and `status: 'connected' | 'revoked' | 'error'`.

### 6.3 OAuth refresh pattern (QuickBooks/Xero/Gusto/Google)

`getValidAccessToken()` refreshes on demand and **persists the rotated refresh
token** (`refreshToken: tok.refresh_token || conn.refreshToken`). On a dead
refresh token (`invalid_grant`), the connection is marked **`revoked`** so the UI
shows a clean "Connect / Reconnect" instead of a Retry that just re-sends a dead
token. **QuickBooks note:** sandbox refresh tokens expire **~24h**; production
**~100 days**. The reconnect churn you'll see on sandbox is expected — set
`QUICKBOOKS_ENV=production` for real use.

### 6.4 Notifications (Slack/Teams)

Both are webhook-based. Slack has a platform "Add to Slack" app **and** a manual
"paste a webhook URL" fallback (so Slack works without the platform app). Teams
is per-customer Incoming Webhook (Workflows/Power Automate `logic.azure.com`,
legacy `webhook.office.com`, `powerplatform.com`) with an Adaptive Card payload.

### 6.5 Health check

`GET /api/integrations/diag` returns, for every integration, a `configured`
boolean (no secret values) + what it powers + a verify link, plus the `storage`
block (§4.6). This is your first stop after any secret/deploy change.

---

## 7. Live booking engine

Real flight/hotel/restaurant inventory and orders go through the shared backend
over an **enterprise service-token channel** (no per-user OTP). Config:
`API_BASE_URL` + `ENT_BACKEND_SERVICE_TOKEN` (must match the backend's
`ENTERPRISE_SERVICE_TOKEN`). Flows: hotels `prebook → Stripe → finish → confirm →
poll`; flights `payment-intent → order`. Cancellations compute a refund quote and
link to Stripe refunds. `GET /api/bookings/diag` reports live-channel config.
When the token/base isn't set, booking routes fall back to mock inventory.

---

## 8. Environment & secrets

### 8.1 The Secrets Manager model (important)

**All ENT secrets live as keys inside ONE AWS Secrets Manager secret:**
`stage/heyvacay-ent/stripe-T5A41D`. Each ECS task secret references a single key
within it, e.g.
`arn:aws:secretsmanager:us-west-2:256309399831:secret:stage/heyvacay-ent/stripe-T5A41D:EMAIL_API_KEY::`.
To add a secret you add a **JSON key** to that one secret and uncomment its
`ent_*_arn` line in `heyvacay-iac/envs/stage/terraform.tfvars`, then
`terraform apply`.

### 8.2 Key env vars

| Var | Purpose |
|---|---|
| `WORKSPACE_DDB_TABLE` / `IDENTITIES_DDB_TABLE` / `INTEGRATIONS_DDB_TABLE` | The three tables (§4.2). |
| `AWS_REGION` | `us-west-2`. |
| `AUTH_SESSION_SECRET` | Session HMAC key (falls back to service token). |
| `API_BASE_URL` / `ENT_BACKEND_SERVICE_TOKEN` | Live booking channel (§7). |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Payments + company card. **Live.** |
| `VERYFI_CLIENT_ID` / `VERYFI_USERNAME` / `VERYFI_API_KEY` | Receipt OCR. **Live.** |
| `EMAIL_API_KEY` (+ non-secret `EMAIL_FROM`) | Resend transactional email. **Needed for launch.** |
| `QUICKBOOKS_* / XERO_* / GUSTO_* / GOOGLE_* / SLACK_*` | OAuth app creds (§6). |
| `OPENTABLE_API_KEY` / `WEATHER_API_KEY` / `FLIGHT_STATUS_API_KEY` | Single-key services. |
| `QUICKBOOKS_ENV` / `QUICKBOOKS_REDIRECT_URI` / `GUSTO_API_BASE` | Non-secret integration config on `ent.tf`. |

`config.server.ts` centralizes every read and exposes `*.live` / `*.configured`
flags the diag route surfaces. **Add new env reads there**, not inline.

> ⚠️ The web deploy does **not** set env/secrets — it re-registers the task
> definition from the *current* one (new image, same env). **Env var and secret
> changes take effect only through `terraform apply`**, then a redeploy to pick
> up the new task-def revision.

---

## 9. Infrastructure & CI/CD

### 9.1 Infra (heyvacay-iac, Terraform)

- ECS Fargate service + task behind an **ALB** (no CDN for ENT).
- The three DynamoDB tables + a task-role IAM policy scoped to them (`ent.tf`).
- Secrets wired from Secrets Manager onto the task (§8).
- DNS for `ent.stage.heyvacay.co` (+ Nova host) and `var.ent_url` drives OAuth
  redirect construction — set it per environment.
- The table/auth/rideshare-era infra is on branch
  **`claude/ent-stripe-payments-env`** (defines workspace + identities tables,
  `AUTH_SESSION_SECRET`, Nova host, Slack ARNs). **Apply it.**

### 9.2 Deploy pipeline (`.github/workflows/stage-web-ent.yml`)

- **Triggers:** push to the `stage` branch, or **manual `workflow_dispatch`**
  (how we deploy feature branches like `claude/real-search`).
- **Auth:** GitHub OIDC assumes
  `arn:aws:iam::256309399831:role/stage-heyvacay-ent-github-actions-role`.
- **Build:** `docker build -f Dockerfile.prod` → push to ECR repo
  `stage-heyvacay-ent` (skips build if the image tag already exists).
- **Deploy:** `aws ecs describe-task-definition` → register a new revision with
  the new image (env preserved) → `aws ecs update-service --force-new-deployment`
  on cluster `stage-heyvacay-cluster`, service `stage-heyvacay-ent` → **waits for
  `aws ecs wait services-stable`**.
- **Consequence:** when the Action goes green, the new code is actually serving
  (it waited for stability) and there's no CDN to invalidate. "I don't see it" →
  check persisted client state (§4.5), not the deploy.

### 9.3 Deploying by hand

Trigger the **"Stage Web Enterprise - Deploy"** workflow (`workflow_dispatch`) on
your branch. The build runs from the dispatched ref. Commit footer convention in
this project:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: <session url>
```

(Do not put any model identifier in code, PR titles/bodies, or other pushed
artifacts.)

---

## 10. Local development

```bash
nvm use 20
npm install
npm run dev            # http://localhost:3000
npm run type-check     # tsc --noEmit — run before every commit
npm run lint
```

- Without AWS creds the server uses the **in-memory** workspace fallback and
  local storage — fine for UI work; multi-device/persistence won't be exercised.
- Integrations run on mock/fallback paths until their keys are set; the app is
  designed to degrade gracefully, so a missing key is never a crash.
- Reset a wedged local workspace by clearing the `hv_ent_*` `localStorage` keys.

---

## 11. Known gotchas (the short list)

1. **`terraform apply` gates durability.** Multi-device, passwords, CRM writes
   all depend on the workspace/identities tables existing (§4.6).
2. **Secrets/env only change via terraform**, not the web deploy (§8.2).
3. **New seed-level content needs `mergeLoaded`** or saved workspaces won't see
   it (§4.5).
4. **Never `setState(remote)` wholesale** — go through `reconcileRemote` (§4.5).
5. **No CDN** — stale UI is persisted client state, not caching (§1).
6. **`.server.ts` is server-only** — don't import into client components.
7. **QuickBooks sandbox tokens die in ~24h** — that's expected; prod is ~100d.
8. **`demo` password** is an intentional bypass — keep it working.

---

## 12. Where to go next

- `docs/PRODUCTION-READINESS.md` — ordered go-live runbook (terraform apply →
  integrations → prod cutover).
- `docs/INTEGRATION-SETUP.md` — per-integration provider steps, redirect URLs,
  exact secret key names + tfvars lines.
- `GET /api/integrations/diag` — live config + storage health, any environment.
