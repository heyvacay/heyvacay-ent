import type { ReactNode } from 'react';
import Nav from '@/components/Nav';
import Reveal from '@/components/Reveal';
import CountUp from '@/components/CountUp';
import {
  ArrowRight,
  Bell,
  Building,
  Calendar,
  ChartBar,
  Check,
  Gift,
  Globe,
  Leaf,
  Lock,
  MapPin,
  Plane,
  Receipt,
  Route,
  Shield,
  Sparkles,
  Users,
  Wallet,
} from '@/components/icons';

const GET_STARTED_URL = '/signup';
const SIGN_IN_URL = '/app';

/* --------------------------- small building blocks --------------------------- */

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand-soft px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
      {children}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  blurb,
  align = 'center',
}: {
  eyebrow: string;
  title: ReactNode;
  blurb?: ReactNode;
  align?: 'center' | 'left';
}) {
  return (
    <div
      className={
        align === 'center'
          ? 'mx-auto max-w-2xl text-center'
          : 'max-w-2xl text-left'
      }
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-5 font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-[44px]">
        {title}
      </h2>
      {blurb && (
        <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
          {blurb}
        </p>
      )}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="group relative h-full rounded-2xl border border-line bg-surface/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:bg-surface">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand ring-1 ring-brand/20">
        <span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      </div>
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{desc}</p>
    </div>
  );
}

function Glow({
  className = '',
  color = 'rgba(35,227,239,0.22)',
}: {
  className?: string;
  color?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -z-10 rounded-full blur-[90px] ${className}`}
      style={{ background: color }}
    />
  );
}

/* --------------------------------- page --------------------------------- */

export default function Home() {
  return (
    <div id="top" className="relative overflow-hidden">
      <Nav />

      {/* ================================ HERO ================================ */}
      <section className="relative px-5 pb-20 pt-32 sm:px-8 sm:pt-40">
        <div aria-hidden className="absolute inset-0 -z-10 grid-bg" />
        <Glow className="left-1/2 top-[-120px] h-[380px] w-[680px] -translate-x-1/2" />

        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            {/* copy */}
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start">
                <Eyebrow>
                  <Sparkles className="h-3.5 w-3.5" /> Corporate travel &amp;
                  expense — 100% free
                </Eyebrow>
              </div>

              <h1 className="mt-6 font-display text-[40px] font-extrabold leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-[64px]">
                Cut your <span className="text-gradient">T&amp;E spend</span>.
                <br className="hidden sm:block" /> Reward your people.
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted lg:mx-0">
                HeyVacay Enterprise is corporate travel and expense built to
                slash what your company spends — with budgets, policy controls,
                real-time savings, and a full expense suite. Employees spend $0
                of their own money and earn points for booking smart.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start justify-center">
                <a
                  href={GET_STARTED_URL}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-7 py-3.5 text-base font-bold text-navy-deep transition-all hover:shadow-glow sm:w-auto"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                <a
                  href="#value"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white/5 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
                >
                  See how it works
                </a>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted lg:justify-start">
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-brand" /> No fees, no seats, no
                  tiers
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-brand" /> Live in minutes
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-brand" /> No card required
                </span>
              </div>
            </div>

            {/* hero visual: before / after savings card */}
            <Reveal className="relative mx-auto w-full max-w-md">
              <Glow
                className="right-0 top-10 h-64 w-64"
                color="rgba(35,227,239,0.18)"
              />
              <div className="animate-float rounded-3xl border border-line bg-surface/80 p-6 shadow-card backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand">
                      <Plane className="h-4.5 w-4.5" />
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">
                        SFO → New York
                      </p>
                      <p className="text-xs text-muted">Booked by Dana · Sales</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
                    In policy
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-line bg-navy/60 px-4 py-3">
                    <span className="text-sm text-muted">Market / OTA price</span>
                    <span className="text-sm font-semibold text-muted line-through">
                      $842
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand-soft px-4 py-3">
                    <span className="text-sm font-semibold text-white">
                      HeyVacay price
                    </span>
                    <span className="font-display text-lg font-bold text-brand">
                      $716
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-line bg-navy/60 p-4 text-left">
                    <p className="text-xs uppercase tracking-wide text-muted">
                      Company saves
                    </p>
                    <p className="mt-1 font-display text-2xl font-extrabold text-white">
                      <CountUp to={126} prefix="$" />
                    </p>
                    <p className="text-xs text-brand">15% below market</p>
                  </div>
                  <div className="rounded-xl border border-line bg-navy/60 p-4 text-left">
                    <p className="text-xs uppercase tracking-wide text-muted">
                      Dana earns
                    </p>
                    <p className="mt-1 font-display text-2xl font-extrabold text-white">
                      <CountUp to={252} />
                    </p>
                    <p className="text-xs text-brand">points · 2× savings</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================ SAVINGS / VALUE ============================ */}
      <section id="value" className="relative px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <SectionHeading
              eyebrow="The win-win ecosystem"
              title={
                <>
                  Everyone wins on every{' '}
                  <span className="text-gradient">trip</span>
                </>
              }
              blurb="Set a budget. Employees book within it through HeyVacay's inventory. We detect the savings against market pricing and reward the booker. The company spends less, the employee earns points, and HeyVacay earns a small commission on the booking — never a fee from you."
            />
          </Reveal>

          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {[
              {
                stat: <CountUp to={15} suffix="%" />,
                label: 'Average savings vs. market on managed trips',
              },
              {
                stat: <CountUp to={0} prefix="$" />,
                label: 'Out of pocket for employees — ever',
              },
              {
                stat: <CountUp to={100} suffix="%" />,
                label: 'Of features included, free, for every company',
              },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 90}>
                <div className="h-full rounded-2xl border border-line bg-surface/60 p-7 text-center">
                  <p className="font-display text-5xl font-extrabold text-gradient">
                    {s.stat}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {s.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: <ChartBar />,
                title: '1 · Set budget',
                desc: 'Admins set per-trip, per-employee, and per-department budgets and policy rules in minutes.',
              },
              {
                icon: <Plane />,
                title: '2 · Book trip',
                desc: 'Employees book hotels and flights through HeyVacay — inside their budget, inside policy.',
              },
              {
                icon: <Gift />,
                title: '3 · Savings detected',
                desc: 'We compare against market pricing, bank the savings for the company, and reward the booker.',
              },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 90}>
                <FeatureCard {...c} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =============================== FREE BAND =============================== */}
      <section className="relative px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-brand/25 bg-surface/70 p-10 text-center sm:p-14">
              <Glow className="left-1/2 top-[-80px] h-64 w-[520px] -translate-x-1/2" />
              <Eyebrow>No catch</Eyebrow>
              <h2 className="mx-auto mt-5 max-w-3xl font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
                All features. Completely free.{' '}
                <span className="text-gradient">Yes, ALL of them.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
                No subscription tiers. No per-seat fees. No feature gating. Every
                company gets the entire platform — travel, expense, rewards,
                admin controls, and Nova-grade support — at no cost. The more you
                save, the better it works.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {[
                  'Unlimited employees',
                  'Travel + Expense suite',
                  'Rewards program',
                  'Admin controls',
                  'Priority support',
                ].map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-navy/60 px-4 py-2 text-sm font-medium text-mist"
                  >
                    <Check className="h-4 w-4 text-brand" /> {t}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== TRAVEL SUITE ============================== */}
      <section id="travel" className="relative px-5 py-20 sm:px-8">
        <Glow className="right-[-120px] top-20 h-80 w-80" />
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <SectionHeading
              eyebrow="Travel suite"
              title={
                <>
                  A booking experience employees{' '}
                  <span className="text-gradient">already love</span>
                </>
              }
              blurb="Same HeyVacay search and checkout your travelers know — now with budgets, policy, and rewards woven in. Global hotels and flights today; built to add trains tomorrow."
            />
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <Globe />,
                title: 'Global inventory',
                desc: 'Hotels and flights from the full HeyVacay supplier stack, including NDC fares and low-cost carriers.',
              },
              {
                icon: <Shield />,
                title: 'Budget & policy at booking',
                desc: 'Remaining budget is visible during search and checkout; out-of-policy fares are flagged or routed for approval.',
              },
              {
                icon: <Sparkles />,
                title: 'Loyalty pass-through',
                desc: 'Travelers store airline, hotel, and rail loyalty numbers — they keep earning their personal miles and status.',
              },
              {
                icon: <Calendar />,
                title: 'Calendar sync',
                desc: 'Trips push straight to Google Calendar and Outlook, so itineraries live where your team already works.',
              },
              {
                icon: <Bell />,
                title: 'Smart notifications',
                desc: 'Confirmations, changes, cancellations, and flight schedule updates by email and in-app — automatically.',
              },
              {
                icon: <Users />,
                title: '24/7 travel support',
                desc: 'A persistent support entry point in the portal — a real travel agent is always a click away.',
              },
            ].map((c, i) => (
              <Reveal key={c.title} delay={(i % 3) * 80}>
                <FeatureCard {...c} />
              </Reveal>
            ))}
          </div>

          {/* admin strip */}
          <Reveal>
            <div className="mt-6 grid gap-5 rounded-3xl border border-line bg-surface/50 p-7 sm:p-9 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <Eyebrow>For admins</Eyebrow>
                <h3 className="mt-4 font-display text-2xl font-bold text-white">
                  Control the whole program from one dashboard
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Budgets, policies, approvals, spend, and savings — for every
                  employee, team, and department, in real time.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: <Wallet />, t: 'Budgets & caps', d: 'Per-trip, per-employee, per-department.' },
                  { icon: <Shield />, t: 'Policy rules engine', d: 'Star caps, nightly rates, cabin class, advance booking.' },
                  { icon: <Check />, t: 'Approval flows', d: 'Allow, block, or route — approve in one click.' },
                  { icon: <ChartBar />, t: 'Spend & savings', d: 'Live dashboards and CSV savings reports.' },
                  { icon: <MapPin />, t: 'Live traveler map', d: 'Duty-of-care view of where your people are.' },
                  { icon: <Leaf />, t: 'Sustainability', d: 'CO₂ estimates rolled into company reports.' },
                ].map((x) => (
                  <div
                    key={x.t}
                    className="flex items-start gap-3 rounded-xl border border-line bg-navy/50 p-4"
                  >
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand [&>svg]:h-4.5 [&>svg]:w-4.5">
                      {x.icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{x.t}</p>
                      <p className="text-xs leading-relaxed text-muted">{x.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== EXPENSE SUITE ============================== */}
      <section id="expense" className="relative px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <SectionHeading
              eyebrow="Expense suite"
              title={
                <>
                  Expenses that{' '}
                  <span className="text-gradient">file themselves</span>
                </>
              }
              blurb="Receipts, reports, approvals, reconciliation, per diems, and mileage — travel spend flows in automatically, so closing the books stops being a chore."
            />
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Receipt />, title: 'Receipt scanning', desc: 'Snap a receipt — OCR pulls merchant, amount, and date and auto-categorizes it.' },
              { icon: <Sparkles />, title: 'Auto expense reports', desc: 'Expenses group into reports by trip and date. One-click submit.' },
              { icon: <Shield />, title: 'Real-time policy', desc: 'Travelers see spend against limits as they go, with warnings before they exceed.' },
              { icon: <Wallet />, title: 'Global reimbursement', desc: 'Pay out to bank or payroll — built for 49+ countries and ~30 currencies.' },
              { icon: <Check />, title: 'Auto-reconciliation', desc: 'Match card transactions to receipts and bookings, and itemize folios automatically.' },
              { icon: <Lock />, title: 'Virtual purchase cards', desc: 'Issue single-use, merchant-locked virtual cards with limits — no card ever shared.' },
              { icon: <ChartBar />, title: 'Per diems & limits', desc: 'Per-city, per-day caps that auto-enforce and eliminate overspending.' },
              { icon: <Building />, title: 'ERP-ready export', desc: 'Clean, accounting-ready exports designed to sync with your books.' },
            ].map((c, i) => (
              <Reveal key={c.title} delay={(i % 4) * 70}>
                <FeatureCard {...c} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =========================== BOOKING FOR OTHERS =========================== */}
      <section id="arranger" className="relative px-5 py-20 sm:px-8">
        <Glow className="left-[-120px] top-10 h-80 w-80" />
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <SectionHeading
                align="left"
                eyebrow="Booking for others"
                title={
                  <>
                    Built for assistants &amp;{' '}
                    <span className="text-gradient">travel arrangers</span>
                  </>
                }
                blurb="Manage travel for your execs, candidates, and teams from one place — and get rewarded for the savings you create for them."
              />
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: <Users />, t: 'Unlimited traveler profiles', d: 'Names, DOBs, loyalty numbers, seat and meal prefs, passports.' },
                { icon: <Plane />, t: 'Book up to 8 at once', d: 'Multi-traveler checkout in a single booking flow.' },
                { icon: <Calendar />, t: 'Auto itinerary sync', d: 'Itineraries reach the traveler — email and calendar — not just you.' },
                { icon: <Gift />, t: 'Booker rewards', d: 'Earn points on the savings from trips you book for others.' },
              ].map((x) => (
                <Reveal key={x.t}>
                  <FeatureCard icon={x.icon} title={x.t} desc={x.d} />
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== REWARDS ============================== */}
      <section id="rewards" className="relative px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <SectionHeading
              eyebrow="HeyVacay Rewards"
              title={
                <>
                  The incentive to book{' '}
                  <span className="text-gradient">smarter</span>
                </>
              }
              blurb="A fully funded rewards program — the company pays nothing for it. Employees earn points on the savings they create, and points pool across their work and personal HeyVacay accounts."
            />
          </Reveal>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {[
              { m: '1×', t: 'Base earn', d: 'Every booking that beats the market earns points on the savings.' },
              { m: '2×', t: 'Bonus categories', d: 'Elevated earn on featured routes, properties, and booking windows.' },
              { m: '3×', t: 'Promos & referrals', d: 'Limited-time multipliers and referral bonuses — all configurable.' },
            ].map((x, i) => (
              <Reveal key={x.m} delay={i * 90}>
                <div className="h-full rounded-2xl border border-line bg-surface/60 p-7">
                  <p className="font-display text-5xl font-extrabold text-gradient">
                    {x.m}
                  </p>
                  <h3 className="mt-3 font-display text-lg font-semibold text-white">
                    {x.t}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {x.d}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="mt-6 flex flex-col items-center justify-between gap-5 rounded-3xl border border-line bg-surface/50 p-7 text-center sm:flex-row sm:p-9 sm:text-left">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand [&>svg]:h-6 [&>svg]:w-6">
                  <Route />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-white">
                    One points balance, work and personal
                  </h3>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                    Every employee gets a linked personal HeyVacay account with
                    single sign-on. Book your own trips, pool your points, and
                    redeem for stays, upgrades, flight credits, and travel perks.
                  </p>
                </div>
              </div>
              <a
                href={GET_STARTED_URL}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-brand/40 bg-brand-soft px-6 py-3 text-sm font-semibold text-brand transition-colors hover:bg-brand/20"
              >
                Explore rewards <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================= TRANSPARENCY ============================= */}
      <section id="transparency" className="relative px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="rounded-3xl border border-line bg-surface/60 p-8 sm:p-12">
              <div className="grid gap-10 lg:grid-cols-2">
                <div>
                  <SectionHeading
                    align="left"
                    eyebrow="How HeyVacay makes money"
                    title={
                      <>
                        We earn on bookings.{' '}
                        <span className="text-gradient">Never from you.</span>
                      </>
                    }
                  />
                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    Our revenue is a small commission already built into the
                    price of each booking — the same way the rest of HeyVacay
                    works. Your company is never charged a subscription, seat, or
                    platform fee. Our interests are aligned: we only do well when
                    you book, and you only book when we beat the market.
                  </p>
                </div>
                <div className="space-y-3">
                  {[
                    { t: 'Free for your company', d: 'No subscription, no seats, no feature gates — forever.' },
                    { t: 'Commission on bookings', d: 'A small margin in the booking price funds the platform.' },
                    { t: 'Savings stay with you', d: 'The gap between market and HeyVacay price is your savings, shown on every booking.' },
                    { t: 'No hidden add-ons', d: 'Rewards and support are fully funded — the company pays nothing extra.' },
                  ].map((x) => (
                    <div
                      key={x.t}
                      className="flex items-start gap-3 rounded-xl border border-line bg-navy/50 p-4"
                    >
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                      <div>
                        <p className="text-sm font-semibold text-white">{x.t}</p>
                        <p className="text-xs leading-relaxed text-muted">
                          {x.d}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== STAT BAND ============================== */}
      <section className="relative px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="grid gap-8 rounded-3xl border border-line bg-surface/50 px-8 py-10 text-center sm:grid-cols-2 lg:grid-cols-4">
              {[
                { n: <CountUp to={15} suffix="%" />, l: 'Average savings vs. market' },
                { n: <CountUp to={190} suffix="+" />, l: 'Countries of inventory' },
                { n: <CountUp to={30} suffix="s" />, l: 'To set up a company' },
                { n: <>$0</>, l: 'Cost to your company' },
              ].map((s, i) => (
                <div key={i}>
                  <p className="font-display text-4xl font-extrabold text-white sm:text-5xl">
                    {s.n}
                  </p>
                  <p className="mt-2 text-sm text-muted">{s.l}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* =============================== PRICING =============================== */}
      <section id="pricing" className="relative px-5 py-20 sm:px-8">
        <Glow className="left-1/2 top-0 h-72 w-[560px] -translate-x-1/2" />
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <SectionHeading
              eyebrow="Pricing"
              title={
                <>
                  One plan. <span className="text-gradient">It's free.</span>
                </>
              }
              blurb="Really. The whole platform, every feature, for every company and every employee."
            />
          </Reveal>

          <Reveal>
            <div className="mx-auto mt-12 max-w-lg">
              <div className="relative overflow-hidden rounded-3xl border border-brand/30 bg-surface/80 p-8 shadow-card sm:p-10">
                <Glow
                  className="right-[-40px] top-[-40px] h-48 w-48"
                  color="rgba(35,227,239,0.2)"
                />
                <span className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy-deep">
                  Everything included
                </span>
                <div className="mt-6 flex items-end gap-2">
                  <span className="font-display text-6xl font-extrabold text-white">
                    $0
                  </span>
                  <span className="pb-2 text-muted">/ forever</span>
                </div>
                <p className="mt-3 text-sm text-muted">
                  No subscription. No per-seat fees. No feature gating. We earn a
                  small commission on bookings — never a fee from you.
                </p>

                <div className="mt-7 grid gap-3">
                  {[
                    'Unlimited employees & departments',
                    'Full Travel suite — hotels, flights, loyalty',
                    'Full Expense suite — receipts, reports, reimbursements',
                    'Budgets, policy engine & approval flows',
                    'HeyVacay Rewards program',
                    'Booking-for-others & group travel',
                    'Live traveler map & duty-of-care',
                    'Savings reports & ERP-ready exports',
                    '24/7 travel agent support',
                  ].map((t) => (
                    <div key={t} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                      <span className="text-sm text-mist">{t}</span>
                    </div>
                  ))}
                </div>

                <a
                  href={GET_STARTED_URL}
                  className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-7 py-3.5 text-base font-bold text-navy-deep transition-all hover:shadow-glow"
                >
                  Get started free <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* =============================== FINAL CTA =============================== */}
      <section id="get-started" className="relative px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="relative overflow-hidden rounded-[32px] border border-brand/25 bg-surface/70 px-8 py-16 text-center sm:px-16">
              <div aria-hidden className="absolute inset-0 -z-10 grid-bg opacity-60" />
              <Glow className="left-1/2 top-[-60px] h-64 w-[560px] -translate-x-1/2" />
              <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
                Start cutting your travel spend{' '}
                <span className="text-gradient">today</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                Set up your company in a guided walkthrough — no sales call
                required. Invite your team, set budgets, and book your first
                trip in minutes.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href={GET_STARTED_URL}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-8 py-4 text-base font-bold text-navy-deep transition-all hover:shadow-glow sm:w-auto"
                >
                  Get started free <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={SIGN_IN_URL}
                  className="inline-flex w-full items-center justify-center rounded-full border border-line bg-white/5 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
                >
                  Sign in
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================================ FOOTER ================================ */}
      <footer className="border-t border-line px-5 py-12 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 ring-1 ring-brand/30">
              <Sparkles className="h-4 w-4 text-brand" />
            </span>
            <span className="font-display text-sm font-bold text-white">
              HeyVacay <span className="font-medium text-brand">Enterprise</span>
            </span>
          </div>
          <p className="text-center text-xs text-muted">
            © {new Date().getFullYear()} HeyVacay. Corporate travel &amp; expense,
            completely free. We earn commission on bookings, never fees from you.
          </p>
          <div className="flex items-center gap-5 text-sm text-muted">
            <a href="#travel" className="hover:text-white">Platform</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href={SIGN_IN_URL} className="hover:text-white">Sign in</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
