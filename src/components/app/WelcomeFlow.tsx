'use client';

import { useState } from 'react';
import { Logo } from './Logo';
import { Button, Field, Input } from './ui';
import { CelebrationOverlay } from './CelebrationOverlay';
import { ProductTour, type TourStep } from './ProductTour';
import { Lock, Check } from '@/components/icons';

/**
 * First-login experience for a teammate the company added: set a password
 * (unless they use SSO) → a branded confetti welcome → a role-aware guided
 * tour that spotlights where to click. Shown once per person, then dismissed.
 */
export function WelcomeFlow({
  company,
  firstName,
  isAdmin,
  onDone,
}: {
  company: string;
  firstName: string;
  isAdmin: boolean;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<'password' | 'celebrate' | 'tour'>('password');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const longEnough = pw.length >= 8;
  const match = pw.length > 0 && pw === pw2;
  const ready = longEnough && match;

  const adminSteps: TourStep[] = [
    {
      selector: '[data-tour="nav-/app/dashboard"]',
      title: 'Your command center',
      body: 'The dashboard shows company-wide spend, savings and live trips at a glance. Start here each day.',
    },
    {
      selector: '[data-tour="nav-/app/approvals"]',
      title: 'Approve trips & expenses',
      body: "When someone books out of policy or submits an expense, it lands here. Open one to review the details and approve, decline, or counter-offer a cheaper option.",
    },
    {
      selector: '[data-tour="nav-/app/policies"]',
      title: 'Set the rules',
      body: 'Travel policies (cabin, nightly caps, advance notice) live here. As an admin your changes route to a super admin for approval before they take effect.',
    },
    {
      selector: '[data-tour="nav-/app/budgets"]',
      title: 'Budgets by team & person',
      body: 'Set budgets per department or per employee. Spend tracks against them automatically and flags overages at approval time.',
    },
    {
      selector: '[data-tour="nav-/app/people"]',
      title: 'Your team',
      body: 'Invite teammates, set who reports to whom, grant full-data access, and promote a super admin — all from People.',
    },
    {
      selector: '[data-tour="nav-/app/book"]',
      title: 'Book travel anytime',
      body: 'You can book for yourself or on behalf of your team right here. Rates are already below market and in-policy.',
    },
  ];

  const employeeSteps: TourStep[] = [
    {
      selector: '[data-tour="nav-/app/book"]',
      title: 'Book your travel here',
      body: 'Search flights and hotels at your company’s negotiated rates — everything shown is already in policy, so you can just book.',
    },
    {
      selector: '[data-tour="nav-/app/plan"]',
      title: 'Plan a whole trip',
      body: 'Flight + hotel (and train or a rental car) together, submitted for one approval. We’ll save your choices as you go.',
    },
    {
      selector: '[data-tour="nav-/app/trips"]',
      title: 'Your trips',
      body: 'Every upcoming and past trip lives here, with confirmations and the option to cancel with a refund preview.',
    },
    {
      selector: '[data-tour="nav-/app/expenses"]',
      title: 'Snap a receipt',
      body: 'Add an expense in seconds — take a photo of the receipt and we read the merchant, amount and date for you.',
    },
    {
      selector: '[data-tour="nav-/app/rewards"]',
      title: 'Earn rewards',
      body: 'Every dollar you save the company earns you points — soon redeemable for your own personal travel on heyvacay.co.',
    },
  ];

  if (phase === 'password') {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-navy-deep/95 px-5 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
          <div className="mb-5 flex justify-center">
            <Logo imgClassName="h-8" />
          </div>
          <h1 className="text-center font-display text-xl font-bold text-slate-900 dark:text-white">
            Welcome, {firstName} 👋
          </h1>
          <p className="mt-1 text-center text-sm text-slate-500">
            {company} set up your HeyVacay account. Create a password to secure it.
          </p>
          <div className="mt-5 space-y-4">
            <Field label="New password">
              <Input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••"
                autoFocus
              />
              {pw.length > 0 && !longEnough && (
                <p className="mt-1 text-xs text-red-600">Use at least 8 characters.</p>
              )}
            </Field>
            <Field label="Confirm password">
              <Input
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder="••••••••"
              />
              {pw2.length > 0 && !match && (
                <p className="mt-1 text-xs text-red-600">Passwords don’t match.</p>
              )}
            </Field>
            {ready && (
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" /> Looks good.
              </p>
            )}
            <Button className="w-full" disabled={!ready} onClick={() => setPhase('celebrate')}>
              <Lock className="h-4 w-4" /> Set password &amp; continue
            </Button>
            <button
              onClick={() => setPhase('celebrate')}
              className="w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              I sign in with single sign-on (SSO) — skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'celebrate') {
    return (
      <CelebrationOverlay
        headline={
          <>
            Traveling at {company} just got
            <br />
            a whole lot <span className="text-brand">easier.</span>
          </>
        }
        sub="Welcome to HeyVacay — below-market fares, everything in policy, and rewards on every trip. Let us show you around."
        cta="Show me around →"
        onCta={() => setPhase('tour')}
        footnote="Takes about 30 seconds. You can skip anytime."
      />
    );
  }

  return (
    <ProductTour
      steps={isAdmin ? adminSteps : employeeSteps}
      onFinish={onDone}
      onSkip={onDone}
    />
  );
}
