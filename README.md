# HeyVacay Enterprise

Corporate travel + expense program for **ent.heyvacay.co** — a B2B product that
sits on top of the existing HeyVacay booking platform (`heyvacay.co`) and reuses
its hotel/flight search, booking, and Stripe payment infrastructure.

> **Status:** early scaffold. This repo currently contains the public marketing
> **landing page** only. The application, admin dashboard, Nova back-office, and
> data model are planned (see _Roadmap_). Nothing here touches production
> `heyvacay.co` infrastructure.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (design tokens in `src/app/globals.css`)
- No runtime data dependencies yet — the landing page is fully static.

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
```

## Brand

- Signature cyan **`#23e3ef`** on deep navy (`#0a1426` / `#060d1b`).
- Display font **Sora**, body font **Inter** (via `next/font`).
- Core message: **cut T&E spend** and **100% free** (we earn commission on
  bookings, never fees from companies).

## Structure

```
src/
  app/
    layout.tsx     # fonts + SEO metadata (OpenGraph, canonical)
    page.tsx       # the landing page (all sections)
    globals.css    # Tailwind v4 + brand tokens + animations
  components/
    Nav.tsx        # sticky header (client)
    Reveal.tsx     # scroll-reveal wrapper (client)
    CountUp.tsx    # animated stat counter (client)
    icons.tsx      # inline SVG icon set
```

## Planned architecture (confirmed with product)

- **Separate repo** (this one), reusing the existing booking/search UI via a
  **shared UI package** so the employee booking experience matches `heyvacay.co`.
- **New enterprise backend service** with its **own multi-tenant Postgres DB**,
  calling the existing HeyVacay backend's inventory/booking/commission/Stripe
  APIs — the live booking backend is never modified.
- **Nova** internal back-office at `nova.ent.heyvacay.co` (hardened, separate
  auth, no public signup, full audit log, cross-tenant only here).
- Tenancy enforced at the data layer; enterprise ↔ personal `heyvacay.co`
  account linking by shared email identity (schema to be reviewed before build).

## Environments

- Staging first at **`stage.ent.heyvacay.co`** (own DB, Stripe test mode, sandbox
  provider credentials). Production (`ent.heyvacay.co`) only after approval.

## Secrets / env vars (names only — never commit values)

Read from environment variables locally and **AWS Secrets Manager** in deployed
environments. To be defined as modules are built (enterprise DB URL, JWT/session
secrets, Stripe keys + webhook signing secrets, supplier API keys, OCR/payout
provider keys). The landing page needs none.

## Roadmap (build order)

1. ✅ Landing page (`ent.heyvacay.co`)
2. Staging environment
3. Data model + multi-tenant auth/roles + account linking
4. Nova back-office core
5. Guided onboarding wizard
6. Admin core (roster, budgets, spend)
7. Policy engine + approvals + booking integration
8. Employee portal (booking, changes, notifications, calendar, loyalty)
9. Savings attribution + reporting
10. Points & rewards
11. Booking-for-others
12. Duty-of-care & insights
13. Expense suite
14. Virtual cards + reimbursements
15. Guest & group travel; HRIS roster sync
