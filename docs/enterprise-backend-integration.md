# HeyVacay Enterprise — backend integration spec

What the shared booking API (`api.stage.heyvacay.co`) needs to provide so
HeyVacay Enterprise can (a) authenticate as a machine and (b) sell at
enterprise/company-specific commission instead of consumer pricing.

The enterprise app reuses the same booking engine as heyvacay.co (RateHawk
hotels / Duffel flights). It is a separate front-end; it cannot change how the
backend prices or authenticates. The two items below are backend work.

---

## 1. Machine authentication (blocks ALL real bookings today)

The enterprise app runs server-side and must call the booking endpoints as a
single corporate identity. It **cannot** complete the human email→OTP (2SV)
flow. The backend needs to provide one of:

- **A service API token** (preferred): a long-lived token the enterprise app
  sends as `Authorization: Bearer <token>`. Simplest and safest for a server.
- **A service account with programmatic login**: an account where
  `POST /auth/login { email, password }` returns an access token without OTP
  (OTP disabled / allow-listed for this account), **or** a long-lived refresh
  token the app exchanges at `POST /auth/refresh` for access tokens.

Whatever is issued goes into AWS Secrets Manager and onto the enterprise ECS
task. The app already supports the login+token-cache pattern; if it's an API
token instead, that's a one-line change on our side.

**Needed:** confirm the mechanism + issue the credential for staging.

---

## 2. Enterprise (net) pricing

Enterprise must price as **RateHawk/Duffel net (0 commission) + our own
commission**, set per company and enterprise-wide in Nova — not the consumer
retail price.

Today the search/details endpoints return retail (net + consumer markup). The
enterprise front-end has no net figure to work from, so it cannot apply its own
commission without double-counting.

**Option A — enterprise pricing mode on the backend (cleanest).**
The enterprise caller is identified (service token, or an `X-HeyVacay-Channel:
enterprise` header). For that caller:
- `/hotels/details`, `/hotels/search/*`, `/flights/*` return the **net** rate
  (what the supplier charges us), clearly labelled, e.g. each rate carries
  `net_price` + `currency`. If a company/commission context is passed, the
  backend may instead return the fully-computed enterprise price.
- Prebook/confirm accept the **customer charge amount** the enterprise app
  computed (net + our commission) for the Stripe PaymentIntent, while the
  supplier is still paid its net. i.e. the customer-facing charge is decoupled
  from the supplier net (the delta is our commission/margin).

**Option B — pass the commission to the backend.**
Enterprise sends the company id (or a commission %) on search/prebook, and the
backend prices `net + that commission` and charges accordingly. Enterprise
displays what the backend returns. Less flexible but keeps pricing server-side.

We want **Option A** so the enterprise app owns the commission math (it already
holds the per-company + enterprise-wide rates in Nova).

**Needed:** expose net on the enterprise read endpoints, and allow the
enterprise-set customer charge amount at prebook/pay. Confirm the commission
formula (see below).

---

## 3. Commission formula (business decision)

Given a net rate `N` and a commission `c%`, the customer price is either:
- `N * (1 + c/100)` — commission is `c%` **of net**, or
- `N / (1 - c/100)` — commission is `c%` **of the selling price**.

These differ (e.g. N=100, c=20 → 120 vs 125). Pick one; the enterprise app and
the backend must use the same one.

---

## 4. What already works on the enterprise side (no backend change)

- Search, hotel/room detail, flight offers (consumer-priced today).
- The full booking flow is wired: prebook → booking form → payment init
  (Stripe) → card auth → confirm/capture → status poll (hotels); payment-intent
  → order (flights). It runs the moment #1 is provided.
- Cancellation + refund: cancel calls the backend, and a Stripe refund (full or
  partial) is issued against the booking's PaymentIntent (idempotent).
- A diagnostics endpoint, `/api/bookings/diag`, reports whether the service
  credential is set and whether it authenticates — use it to verify #1.

---

## Summary of asks to the backend team

1. Issue a **machine credential** (service API token, or OTP-exempt service
   account / refresh token) for staging.
2. Return **net prices** to the enterprise channel, and allow the
   **enterprise-set customer charge amount** at prebook/pay (Option A).
3. Confirm the **commission formula** (% of net vs % of selling price).

With #1 alone, real bookings work at consumer pricing. #2 + #3 make enterprise
commission pricing real.
