# HeyVacay Enterprise — Production-readiness runbook

This is the single list of what stands between the current stage build and a
production launch. It is ordered: do #1 first — almost every "it doesn't work
across devices / my password didn't stick / the CRM approval didn't reach the
account" symptom collapses into that one step.

---

## 0. TL;DR — the one thing that unblocks the most

**The app is built to use a database (DynamoDB). The tables are defined in
Terraform but have to be *applied* in AWS before the running container can use
them.** Until `terraform apply` creates them and wires the `*_DDB_TABLE` env
vars onto the ECS task, the app falls back to each browser's **local storage** —
which is why two devices (even in the same company) don't show the same data,
why a password set on one device isn't there on another, and why a KYC approval
made in the CRM doesn't appear on the customer's account.

Three tables, three symptoms they fix:

| Table | Env var | What breaks without it |
|---|---|---|
| `stage-heyvacay-ent-workspace` | `WORKSPACE_DDB_TABLE` | Multi-device sync — all devices in a company seeing the same bookings/expenses/events, and CRM→customer writes (KYC/Net 30) crossing devices |
| `stage-heyvacay-ent-identities` | `IDENTITIES_DDB_TABLE` | Durable passwords, email verification, password reset (accounts only live in the browser otherwise) |
| `stage-heyvacay-ent-integrations` | `INTEGRATIONS_DDB_TABLE` | OAuth token storage (QuickBooks/Xero staying connected) — this one was applied earlier for QuickBooks |

**Verify at a glance after applying:** open
`https://ent.stage.heyvacay.co/api/integrations/diag` and read the new
`storage` block. `storage.ok: true` means all three tables exist and are
`ACTIVE`. Any table showing `"missing (run terraform apply)"` is still
local-storage-only.

---

## 1. Apply the infrastructure (required)

I can't run this from here — it needs your AWS credentials and the Terraform
binary. Everything is already written and committed in the IaC repo.

```bash
cd heyvacay-iac
git checkout claude/ent-stripe-payments-env     # the branch that defines all 3 tables
terraform init
terraform plan   -var-file=envs/stage/terraform.tfvars    # review: 3 DynamoDB tables + IAM + env vars
terraform apply  -var-file=envs/stage/terraform.tfvars
```

What the plan adds: the `ent_workspace` and `ent_identities` DynamoDB tables
(the `ent_integrations` one already exists), the IAM policy letting the ENT task
read/write them, the three `*_DDB_TABLE` env vars on the task definition, and
`AUTH_SESSION_SECRET` (if you set its secret ARN — otherwise it falls back to
the enterprise service token, which is fine).

**Then redeploy** so the task picks up the new env vars (the web deploy
registers a task def from whatever env the IaC last applied):
re-run the **Stage Web Enterprise - Deploy** GitHub Action on `claude/real-search`.

**Confirm:** `/api/integrations/diag` → `storage.ok: true`. Then set a password
on one device and sign in on a second — it now works. Approve a KYC in the CRM
and it shows on the customer account.

---

## 2. Turn on the integrations you want live

Full per-integration detail (redirect URLs, exact secret names, tfvars lines) is
in **`docs/INTEGRATION-SETUP.md`**. The short version:

**Already live (no action):** Stripe (payments + company card), Veryfi (receipt
OCR), the enterprise live-booking channel.

**Each is one provider app + one secret + uncomment its tfvars line + apply.**
None of these is a build task — the code and IaC are done.

| Integration | What you do | Powers |
|---|---|---|
| **Email (Resend)** | Create a Resend API key → set `EMAIL_API_KEY` secret → uncomment. Set `EMAIL_FROM`. | **Do this for launch** — without it, email-verification codes and password-reset links only render in preview, they don't send. |
| **QuickBooks** | Intuit app at developer.intuit.com; flip `QUICKBOOKS_ENV` to `production` for prod (sandbox refresh tokens expire ~24h, which is why you saw the reconnect error — production tokens last ~100 days). | Accounting sync |
| **Xero** | App at developer.xero.com (scopes incl. `offline_access`). | Accounting sync |
| **Gusto** | App at Gusto; set `GUSTO_API_BASE` to the production host (defaults to demo). | Roster import |
| **Google Workspace** | Google Cloud project, enable Admin SDK Directory API; authorizer must be a Workspace admin. | Directory sync |
| **Slack** | One "Add to Slack" app (`incoming-webhook` scope). Works via manual webhook paste until then. | Channel notifications |
| **OpenTable** | Partner API key (`OPENTABLE_API_KEY`). Falls back to mock dining until set. | Real dining search/booking |
| **Weather (OpenWeather)** | `WEATHER_API_KEY`. | Destination forecast on trips |
| **Flight status (AeroDataBox/RapidAPI)** | `FLIGHT_STATUS_API_KEY`. | Live flight status |

**Per-customer integrations need nothing from you** — each customer enters their
own credentials in-app: **BambooHR, Microsoft Teams, Rippling, Okta, Workday,
UKG Pro, Ramp, Brex, NetSuite, Expensify.**

---

## 3. Production cutover (when moving off stage)

1. **Domains:** point the production ENT host (and the Nova admin host) at the
   ALB; set `var.ent_url` to the prod host so OAuth redirect URLs build
   correctly. Re-register each provider redirect URL for the prod host.
2. **Stripe:** swap the test keys for live keys (`STRIPE_SECRET_KEY`,
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`).
3. **QuickBooks:** `QUICKBOOKS_ENV=production` + the production Intuit app creds.
4. **Gusto:** `GUSTO_API_BASE` → production host.
5. **AUTH_SESSION_SECRET:** set a dedicated strong secret (don't inherit the
   service token in prod).
6. **DynamoDB:** confirm point-in-time recovery / backups are on for the
   workspace and identities tables (customer data lives there).
7. **Email:** verify the sending domain in Resend (SPF/DKIM) so mail isn't
   spam-filtered.
8. Re-run `/api/integrations/diag` on the prod host — `storage.ok: true` and
   the integrations you turned on showing `configured: true`.

---

## 4. What's already done (so you're not re-checking)

- Real auth: scrypt password hashing, HMAC-signed httpOnly session cookies,
  email verification + password reset flows, self-contained in the ENT app.
  (Needs the identities table from step 1 to persist — code is complete.)
- Clean new accounts (no demo roster), dining availability filtering, QuickBooks
  reconnect handling, setup-wizard actions, CRM KYC propagation, and the new
  rideshare vs. rental-car savings + policy — all shipped to `claude/real-search`.
- All integration code + IaC. The remaining work for every integration is
  operational (a provider app + a secret), not development.
