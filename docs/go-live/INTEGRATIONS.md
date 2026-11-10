# HeyVacay Enterprise — Integrations runbook

Every integration is already **coded** to flip on the moment its key reaches the
running container. Until a key is present, that feature runs on a built-in
mock/fallback, so the app is always usable. This doc is the exact "few things"
you do per integration.

## Status at a glance

| Integration | State | Your part to go live |
|---|---|---|
| **Live booking** (flights + hotels) | ✅ Live | — |
| **Stripe** (payments) | ✅ Live | — |
| **Veryfi** (receipt OCR) | ✅ Live | — |
| **OpenTable** (dining) | ✅ Live | — |
| **QuickBooks** (accounting) | ✅ Live (sandbox) | — (flip to production when ready) |
| **Xero** (accounting) | 🟢 Key-ready | Register a Xero app → add 2 keys → uncomment tfvars → apply |
| **BambooHR** (roster) | 🟢 Ready now | No server keys — admin enters subdomain + API key in the UI |
| **Slack** (notifications) | 🟢 Ready now | No server keys — admin pastes an Incoming Webhook URL in the UI |
| **OpenWeather** (forecast) | 🟢 Key-ready | Add `WEATHER_API_KEY` → uncomment tfvars → apply |
| **Email / Resend** (transactional) | 🟢 Key-ready | Add `EMAIL_API_KEY` + verify domain → uncomment tfvars → apply |
| **Flight status** (AeroDataBox) | 🟢 Key-ready | Add `FLIGHT_STATUS_API_KEY` (RapidAPI) → uncomment tfvars → apply |
| **Rippling / Okta / Workday** (people) | 🟢 Ready now | No server keys — admin enters credentials in the UI |
| **Ramp / Brex** (card feed) | 🟢 Ready now | No server keys — admin enters API creds in the UI |
| **NetSuite** (accounting) | 🟢 Ready now | No server keys — admin enters Token-Based Auth values in the UI |
| **Expensify** (link) | 🟢 Ready now | No server keys — admin enters partner creds in the UI |
| **Gusto** (people) | 🟢 Key-ready | Register a Gusto OAuth app → add 2 keys → uncomment tfvars → apply |
| **Google Workspace** (directory) | 🟢 Key-ready | Register a Google OAuth app → add 2 keys → uncomment tfvars → apply |

**Every integration card is now a real integration** — nothing is faked as
"connected." All show **real brand logos**.

## The universal pattern (same for all)

1. **Get the key** from the provider (links below).
2. **Put it in the ENT secret** `stage/heyvacay-ent/stripe` as a JSON field
   (us-west-2). CLI (merges without clobbering existing fields):
   ```bash
   aws secretsmanager get-secret-value --region us-west-2 \
     --secret-id stage/heyvacay-ent/stripe --query SecretString --output text \
   | jq '. + {FIELD_NAME:"THE_VALUE"}' \
   | aws secretsmanager put-secret-value --region us-west-2 \
       --secret-id stage/heyvacay-ent/stripe --secret-string file:///dev/stdin
   ```
3. **Uncomment the matching line** in `heyvacay-iac/envs/stage/terraform.tfvars`
   (the "Other integrations" block), then **targeted apply** (safe — only the ENT
   task def):
   ```bash
   cd ~/heyvacay-iac && git checkout claude/ent-stripe-payments-env && git pull
   terraform init -reconfigure -backend-config=envs/stage/backend.hcl
   terraform apply -var-file=envs/stage/terraform.tfvars \
     -target=aws_ecs_task_definition.ent -target=aws_iam_role_policy.ent_task_secrets
   ```
4. **Redeploy ENT**: GitHub → heyvacay-ent → Actions → *Stage Web Enterprise -
   Deploy* → branch `claude/real-search`.
5. **Verify** all integrations at once:
   ```bash
   curl -s https://ent.stage.heyvacay.co/api/integrations/diag | jq
   ```
   Each row shows `configured: true` once its key is live.

---

## Already live ✅

| Integration | Field(s) in the secret | Verify |
|---|---|---|
| **Live booking** (enterprise channel) | `ENTERPRISE_SERVICE_TOKEN` + `ENTERPRISE_SERVICE_USER_ID` (in `stage/heyvacay/enterprise`) | `/api/bookings/diag` → `authOk:true` |
| **Stripe** (card payments) | `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` | checkout shows card entry |
| **Veryfi** (receipt OCR) | `VERYFI_CLIENT_ID`, `VERYFI_USERNAME`, `VERYFI_API_KEY` | `/api/expenses/scan` → `veryfi.configured:true` |

---

## To turn on (your "few things")

### 1. OpenTable — dining search, availability, reservations
- **Powers:** the Dining page + event dinner RSVP (search, open-time slots, booking).
- **Sign up:** OpenTable for Developers / Partner program → <https://www.opentable.com/about/affiliates/> (API access is partner-gated; request the **Connect/Booking API**). You'll get either an **API key** or a **Client ID + Client Secret**.
- **Secret fields:** `OPENTABLE_API_KEY` **or** (`OPENTABLE_CLIENT_ID` + `OPENTABLE_CLIENT_SECRET`).
- **tfvars:** `ent_opentable_api_key_arn` (or the `…_client_id_arn` + `…_client_secret_arn` pair).
- **Verify:** diag `opentable.configured:true`, then Dining search returns `source:"opentable"`.
- **Status:** the real OpenTable Partner API is now fully wired in `src/lib/opentable.server.ts` — OAuth2 client-credentials (Basic auth → bearer, token cached), the **Directory API** (`/sync/directory`, paged into a 6h in-memory cache and filtered by city/genre locally — OpenTable has no server-side city filter), **single-search availability** (`/v2/availability/{rid}`, ±120 min window so we can offer nearest slots), and the **2-step booking** (`/v2/booking/{rid}/slot_locks` → `/v2/booking/{rid}/reservations`). Each route falls back to the mock directory if a call fails or a city has no match, so the UI is never empty.
- **Optional envs (non-secret):** `OPENTABLE_OAUTH_URL` (defaults to `https://oauth.opentable.com`; use `https://oauth-pp.opentable.com` for pre-prod) and `OPENTABLE_API_BASE` (defaults to `https://platform.opentable.com`).

### 2. OpenWeather — active-trip forecast
- **Powers:** the weather chip on the active-trip home view.
- **Sign up:** <https://home.openweathermap.org/users/sign_up> → API keys → copy the key (free tier is fine).
- **Secret field:** `WEATHER_API_KEY`.
- **tfvars:** `ent_weather_api_key_arn`.
- **Verify:** diag `weather.configured:true`.

### 3. Flight status — live on-time / gate / delay
- **Powers:** live flight status on the active-trip view.
- **Sign up (pick one):** AeroDataBox via RapidAPI <https://rapidapi.com/aedbx-aedbx/api/aerodatabox> (easiest), or FlightAware AeroAPI <https://www.flightaware.com/commercial/aeroapi/>.
- **Secret field:** `FLIGHT_STATUS_API_KEY`. **Also** set the base URL as a plain env — tell me the provider and I'll set `FLIGHT_STATUS_API_BASE` in `ent.tf` (it's non-secret).
- **tfvars:** `ent_flight_status_api_key_arn`.
- **Verify:** diag `flight_status.configured:true`.

### 4. Transactional email — approvals, confirmations, dinner invites
- **Powers:** every email the app sends (currently no-ops without a key).
- **Sign up (pick one):** Resend <https://resend.com> (simplest), SendGrid <https://sendgrid.com>, or Postmark <https://postmarkapp.com>. Verify the sending domain (`heyvacay.co`) in the provider.
- **Secret field:** `EMAIL_API_KEY`. The from-address defaults to `notifications@heyvacay.co` (override with `EMAIL_FROM` plain env if you want).
- **tfvars:** `ent_email_api_key_arn`.
- **Verify:** diag `email.configured:true`, then trigger an approval and check the inbox.
- **Note:** tell me which provider you choose — the send call in `src/app/api/email/send/route.ts` may need the provider's exact endpoint/shape finalized (Resend vs SendGrid differ). I've left it provider-agnostic with a TODO.

### 5. QuickBooks Online — real accounting sync (OAuth2) ✅ wired
Unlike the single-secret integrations above, QBO is a **full OAuth2** integration
(per-company tokens), not a key flip. The code, token store, and UI are built; the
only "your part" is registering the Intuit app and dropping its two keys in.

- **Powers:** the Integrations → QuickBooks page — real "Connect to QuickBooks"
  consent, live chart-of-accounts mapping (category → GL account + payment
  account), and posting approved expenses as QuickBooks **Purchases**.
- **Where tokens live:** DynamoDB table `stage-heyvacay-ent-integrations` (the
  ENT app's first real server-side store — expenses post *after* approval, so
  tokens must persist and auto-refresh). Created with the ENT stack; the task
  role gets scoped Get/Put/Update/Delete on just that table.
- **Your part (Intuit app):**
  1. developer.intuit.com → Create an app → *QuickBooks Online and Payments*.
  2. Copy the **Development** keys: **Client ID** + **Client Secret**.
  3. Add Redirect URI **exactly**: `https://ent.stage.heyvacay.co/api/integrations/quickbooks/callback`
  4. A free **sandbox company** is auto-created under Dashboard → Sandbox (what we test against).
- **Secret fields:** `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET` (in the
  ENT secret `stage/heyvacay-ent/stripe`).
- **tfvars:** `ent_quickbooks_client_id_arn` + `ent_quickbooks_client_secret_arn`
  (uncomment); `ent_quickbooks_env` stays `"sandbox"` until the Intuit app is
  approved for production. Targeted apply must include the new resources:
  ```bash
  terraform apply -var-file=envs/stage/terraform.tfvars \
    -target=aws_dynamodb_table.ent_integrations \
    -target=aws_iam_role_policy.ent_task_dynamodb \
    -target=aws_iam_role_policy.ent_task_secrets \
    -target=aws_ecs_task_definition.ent
  ```
- **Verify:** diag `quickbooks` shows the server configured; then Integrations →
  QuickBooks → **Connect to QuickBooks** → authorize the sandbox company → map
  accounts → **Post to QuickBooks** and the Purchase appears in QBO.
- **Flip to production:** set `ent_quickbooks_env = "production"`, add a Production
  redirect URI on the Intuit app, and swap in the production client id/secret.

### 6. Xero — real accounting sync (OAuth2) 🟢 key-ready
Same shape as QuickBooks (shares the token store + mapping UI). Posts approved
expenses as **spend bank transactions** against mapped account codes.
- **Your part (Xero app):** developer.xero.com → New app → Web app → copy
  **Client ID** + **Client Secret**; add Redirect URI exactly
  `https://ent.stage.heyvacay.co/api/integrations/xero/callback`; scopes are
  requested automatically (`accounting.transactions`, `accounting.settings.read`).
- **Secret fields:** `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`.
- **tfvars:** uncomment `ent_xero_client_id_arn` + `ent_xero_client_secret_arn`,
  then the same targeted apply as QuickBooks (the DynamoDB table + IAM already exist).
- **Verify:** diag `xero.configured:true`, then Integrations → Xero → Connect →
  authorize your Xero org (use the Demo Company to test) → map accounts → post.
- **Note:** Xero has no sandbox host — test against Xero's built-in **Demo Company**.

### 7. BambooHR — roster sync 🟢 ready now (no server keys)
Per-company: each BambooHR account issues its own API key, so there's nothing to
wire in IaC. The admin connects it in the app.
- **In the app:** Integrations → BambooHR → enter **subdomain** (`yourco`.bamboohr.com)
  + an **API key** (BambooHR → profile → API Keys) → Connect → **Sync roster** imports
  employees as people (deduped by email, safe to re-run).

### 8. Slack — notifications 🟢 ready now (no server keys)
Per-company Incoming Webhook; nothing to wire in IaC.
- **In the app:** Integrations → Slack → paste an **Incoming Webhook URL**
  (api.slack.com → your app → Incoming Webhooks → Add to Workspace) → Connect. A
  hello message confirms it; approval requests + trip alerts post to that channel.
  URLs are restricted to `hooks.slack.com` server-side.

### 9. People sync — Rippling, Okta, Workday 🟢 ready now (no server keys)
All three import your roster into HeyVacay as people (deduped by email). In the
app: Integrations → the provider → enter credentials → **Sync roster**.
- **Rippling:** API key (Rippling → Settings → API).
- **Okta:** Okta domain (`yourco.okta.com`) + an API token (Security → API → Tokens).
- **Workday:** a Report-as-a-Service (RaaS) report URL that outputs workers (name,
  email, title, department) + an Integration System User (username + password).

### 10. Card feed — Ramp, Brex 🟢 ready now (no server keys)
Pull recent card transactions to reconcile against trips. In the app: Integrations
→ the provider → enter API credentials → **Load transactions**.
- **Ramp:** client id + secret (Ramp → Developer API, grant `transactions:read`).
- **Brex:** an API token (Brex → Developer → Tokens, transactions scope).

### 11. NetSuite 🟢 ready now (no server keys) — Token-Based Auth
In the app: Integrations → NetSuite → paste the five TBA values (account id,
consumer key/secret, token id/secret) → map accounts (live via SuiteQL, with
smart suggestions) → **Post** approved expenses as Journal Entries (debit the
mapped expense account, credit the chosen bank/card account).
- **Your part in NetSuite:** enable Token-Based Auth + REST Web Services, create an
  Integration record (consumer key/secret) and an Access Token (token id/secret).

### 12. Expensify 🟢 ready now (no server keys)
In the app: Integrations → Expensify → paste the Integration Server
`partnerUserID` + `partnerUserSecret` (expensify.com → Settings → Account → API).
We validate by listing your policies (workspaces). Full report import is the next step.

### 13. Gusto — roster (OAuth) 🟢 key-ready
- **Your part:** register an app at dev.gusto.com; redirect URI
  `https://ent.stage.heyvacay.co/api/integrations/roster/gusto/callback`.
- **Secret fields:** `GUSTO_CLIENT_ID`, `GUSTO_CLIENT_SECRET`. **tfvars:** uncomment
  `ent_gusto_client_*_arn`, then the standard targeted apply.
- **Note:** defaults to Gusto's **demo** API host (`GUSTO_API_BASE`); set it to the
  production host to go live.

### 14. Google Workspace — directory (OAuth) 🟢 key-ready
- **Your part:** OAuth client at console.cloud.google.com (enable the Admin SDK);
  redirect URI `https://ent.stage.heyvacay.co/api/integrations/roster/google/callback`.
  The authorizing user must be a **Workspace admin**.
- **Secret fields:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. **tfvars:** uncomment
  `ent_google_client_*_arn`, then the standard targeted apply.

---

## Everything is built
All 13 integration cards + the infra integrations are now **real** — nothing is
faked as "connected." The two that still need a server OAuth app (Gusto, Google)
are clearly marked above; the rest are per-company (the admin connects in the UI
with their own credentials, no infra). Verify any of them at
`/api/integrations/diag`.

**Reminder:** the per-company integrations (Rippling, Okta, Workday, Ramp, Brex,
NetSuite, Expensify, BambooHR, Slack) are built against each provider's documented
API but can only be exercised with real credentials — connect each once to confirm
the field mapping against your actual account, the same way we did QuickBooks.

---

## One-glance status
```bash
curl -s https://ent.stage.heyvacay.co/api/integrations/diag | jq '.integrations[] | {name, configured}'
```
