# HeyVacay Enterprise — Integrations runbook

Every integration is already **coded** to flip on the moment its key reaches the
running container. Until a key is present, that feature runs on a built-in
mock/fallback, so the app is always usable. This doc is the exact "few things"
you do per integration.

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

---

## Display-only today (roadmap — no live API wired yet)
These show in **Integrations** as connect cards and drive the in-app accounting
map, but there is **no live third-party sync** yet (they'd each need an OAuth app
+ a sync service):
- **QuickBooks / Xero / NetSuite** (accounting export)
- **BambooHR / Workday** (HR / employee + cost-center sync)
- **Okta / Azure AD / Google Workspace SSO** (SAML/SCIM)

Say which one matters first and I'll build the real OAuth + sync for it (each is
its own project — OAuth app registration is the "your part").

---

## One-glance status
```bash
curl -s https://ent.stage.heyvacay.co/api/integrations/diag | jq '.integrations[] | {name, configured}'
```
