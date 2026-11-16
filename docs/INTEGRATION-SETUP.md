# HeyVacay Enterprise — Integration setup runbook

Every integration in the app is **code- and IaC-complete**. Nothing here is a
development task — turning one on is an operational step at the provider + a
secret. There are three kinds:

1. **Platform OAuth apps** — you register ONE HeyVacay app at the provider and
   set its client id/secret. Every customer then connects with one click.
2. **Platform single-key services** — one HeyVacay API key powers it for all
   customers.
3. **Per-customer integrations** — nothing for you to do; each customer enters
   their own key in-app.

**Redirect/callback URLs below are shown for the stage host
(`ent.stage.heyvacay.co`).** The app builds each redirect from the env's own
host (`var.ent_url`), so for another environment just swap the host when you
register the URL.

**To turn one on:** (a) create the app / get the key at the provider, (b) add
the secret value in AWS Secrets Manager (the ENT secret,
`stage/heyvacay-ent/stripe-…`), (c) uncomment its `*_arn` line(s) in
`envs/stage/terraform.tfvars` — the ARN format is already shown there,
`arn:aws:secretsmanager:us-west-2:256309399831:secret:stage/heyvacay-ent/stripe-XXXXXX:<KEY>::`
— then (d) `terraform apply`. Verify in-app at `/app/integrations`, or
`GET /api/integrations/diag` for a machine readout.

---

## 1. Platform OAuth apps — register the redirect URL

Create ONE app each, set the redirect/callback URL **exactly**, copy the client
id + secret into Secrets Manager, uncomment the two `*_arn` lines, apply.

| Integration | Redirect URL to register (stage) | Secret env vars | tfvars lines |
|---|---|---|---|
| **QuickBooks Online** | `https://ent.stage.heyvacay.co/api/integrations/quickbooks/callback` | `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET` | `ent_quickbooks_client_id_arn`, `ent_quickbooks_client_secret_arn` |
| **Xero** | `https://ent.stage.heyvacay.co/api/integrations/xero/callback` | `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` | `ent_xero_client_id_arn`, `ent_xero_client_secret_arn` |
| **Gusto** | `https://ent.stage.heyvacay.co/api/integrations/roster/gusto/callback` | `GUSTO_CLIENT_ID`, `GUSTO_CLIENT_SECRET` | `ent_gusto_client_id_arn`, `ent_gusto_client_secret_arn` |
| **Google Workspace** | `https://ent.stage.heyvacay.co/api/integrations/roster/google/callback` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `ent_google_client_id_arn`, `ent_google_client_secret_arn` |
| **Slack ("Add to Slack")** | `https://ent.stage.heyvacay.co/api/integrations/slack/callback` | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | `ent_slack_client_id_arn`, `ent_slack_client_secret_arn` |

Provider notes:
- **QuickBooks** — Intuit app at developer.intuit.com. Non-secret env on `ent.tf`:
  `QUICKBOOKS_ENV` (`sandbox` default / `production`) and `QUICKBOOKS_REDIRECT_URI`
  (must match the registered URL exactly). Scope: `com.intuit.quickbooks.accounting`.
- **Xero** — app at developer.xero.com. Scopes include `offline_access` (for the
  refresh token) + `accounting.transactions`, `accounting.contacts`.
- **Gusto** — defaults to the **demo** host `api.gusto-demo.com`; set
  `GUSTO_API_BASE` to the production host to go live.
- **Google Workspace** — the authorizing user must be a Workspace **admin**, and
  the **Admin SDK Directory API** must be enabled in the Google Cloud project.
  Scope: `admin.directory.user.readonly`.
- **Slack** — one HeyVacay app with the `incoming-webhook` scope. Until these are
  set the app falls back to the manual "paste a webhook URL" flow, so Slack still
  works without the platform app.

---

## 2. Platform single-key services

| Service | Secret env var(s) | Notes |
|---|---|---|
| **Stripe** (payments + company card) | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` | Publishable mounts Stripe Elements; the secret enables the real company-card **SetupIntent** + off-session charge. **Already active** in tfvars. |
| **Email** (Resend) | `EMAIL_API_KEY` (+ non-secret `EMAIL_FROM`) | **Required** for auth email-verification codes and password-reset links to actually send; without it they render in preview mode only. |
| **Veryfi** (receipt OCR) | `VERYFI_CLIENT_ID`, `VERYFI_USERNAME`, `VERYFI_API_KEY` | **Already active** in tfvars. |
| **OpenTable** (dining) | `OPENTABLE_API_KEY` (or `OPENTABLE_CLIENT_ID` + `OPENTABLE_CLIENT_SECRET`) | Private partner API; falls back to mock data when unset. |
| **Weather** (trip forecast) | `WEATHER_API_KEY` | OpenWeather by default. |
| **Flight status** | `FLIGHT_STATUS_API_KEY` | AeroDataBox via RapidAPI by default. |
| **Live booking** (enterprise channel) | `ENT_BACKEND_SERVICE_TOKEN` | Already wired; must match the backend's `ENTERPRISE_SERVICE_TOKEN`. |
| **Auth sessions** | `AUTH_SESSION_SECRET` *(optional)* | Falls back to `ENT_BACKEND_SERVICE_TOKEN` when unset. |

---

## 3. Per-customer integrations — nothing to set centrally

Each customer connects their own, in-app (Integrations → the provider → paste a
key / "Add to Slack" / paste a webhook URL). These are turn-key already:

**BambooHR, Microsoft Teams, Rippling, Okta, Workday, UKG Pro, Ramp, Brex,
NetSuite, Expensify.**

Each has a built-in step-by-step setup guide in the app and connects with the
customer's own credentials — no HeyVacay-side secret.

---

## Quick reference — what's live vs. waiting

- **Already active (tfvars uncommented):** Stripe, Veryfi, enterprise service token.
- **Ready to uncomment + set a secret:** QuickBooks, Xero, Gusto, Google, Slack,
  OpenTable, Weather, Flight status, Email.
- **Per-customer (no action):** BambooHR, Teams, Rippling, Okta, Workday, UKG,
  Ramp, Brex, NetSuite, Expensify.

`GET /api/integrations/diag` returns the live configured/not-configured state for
every one of the above.
