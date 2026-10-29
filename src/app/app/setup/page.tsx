'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Badge, Button, Card, PageHeader, ProgressBar, cn } from '@/components/app/ui';
import { Check, Shield, Users, Wallet, Globe, Lock, ArrowRight } from '@/components/icons';

/**
 * Guided setup / integration flow. Walks an admin (or a sales agent sitting
 * with the customer) through the steps to get a company live: who has what
 * access, policies, budgets, SSO, and verifying the team can sign in. Each
 * step shows live status from the workspace and links to where it's done.
 */
export default function SetupPage() {
  const { state, role, isSuperAdmin } = useStore();

  if (role !== 'admin') {
    return (
      <div>
        <PageHeader title="Setup" subtitle="Admins only." />
        <Card>
          <p className="text-sm text-slate-500">Ask an admin to run company setup.</p>
        </Card>
      </div>
    );
  }

  const active = state.users.filter((u) => u.status === 'active');
  const invited = state.users.filter((u) => u.status === 'invited');
  const admins = active.filter((u) => u.role === 'admin');
  const policiesOn = state.policies.filter((p) => p.enabled);
  const companyBudget = state.budgets.find((b) => b.scope === 'company' && b.limit > 0);
  const sso = state.integrations.find((i) => i.category === 'Identity' && i.status === 'connected');
  const ssoAvailable = state.integrations.filter((i) => i.category === 'Identity');
  const hris = state.integrations.find((i) => i.category === 'HR / HRIS' && i.status === 'connected');

  const steps = [
    {
      key: 'access',
      icon: Users,
      title: 'People & access',
      desc: 'Add your team and set who gets what access — travelers, bookers, team admins, and super admins.',
      done: active.length > 1 && admins.length >= 1,
      status:
        `${active.length} active · ${admins.length} admin${admins.length === 1 ? '' : 's'}` +
        (invited.length ? ` · ${invited.length} invited` : ''),
      href: '/app/people',
      cta: 'Manage people',
    },
    {
      key: 'roles',
      icon: Shield,
      title: 'Admin abilities',
      desc: 'Confirm each admin can see their tools. Team admins manage their department; super admins control the whole company.',
      done: admins.some((u) => u.superAdmin),
      status: admins.some((u) => u.superAdmin)
        ? `${admins.filter((u) => u.superAdmin).length} super admin, ${admins.filter((u) => !u.superAdmin).length} team admin`
        : 'No super admin set',
      href: '/app/people',
      cta: 'Review roles',
    },
    {
      key: 'policies',
      icon: Shield,
      title: 'Travel policy',
      desc: 'Set approval rules and spend limits so bookings stay in policy automatically.',
      done: policiesOn.length > 0,
      status: `${policiesOn.length} rule${policiesOn.length === 1 ? '' : 's'} active`,
      href: '/app/policies',
      cta: 'Configure policy',
    },
    {
      key: 'budgets',
      icon: Wallet,
      title: 'Budgets',
      desc: 'Set the company, department, and per-person ceilings.',
      done: !!companyBudget,
      status: companyBudget ? 'Company budget set' : 'No company budget yet',
      href: '/app/budgets',
      cta: 'Set budgets',
    },
    {
      key: 'sso',
      icon: Lock,
      title: 'Single sign-on (SSO)',
      desc: 'Connect Okta or Google so everyone signs in with your identity provider — and provisions automatically.',
      done: !!sso,
      status: sso ? `${sso.name} connected` : `${ssoAvailable.length} providers available`,
      href: '/app/integrations',
      cta: sso ? 'Manage SSO' : 'Connect SSO',
    },
    {
      key: 'hris',
      icon: Globe,
      title: 'Sync your org (optional)',
      desc: 'Connect an HRIS (Workday, BambooHR, Rippling) to keep people, roles and departments in sync.',
      done: !!hris,
      status: hris ? `${hris.name} connected` : 'Not connected',
      href: '/app/integrations',
      cta: hris ? 'Manage' : 'Connect HRIS',
      optional: true,
    },
    {
      key: 'verify',
      icon: Check,
      title: 'Verify the team can sign in',
      desc: 'Invite anyone still missing and confirm they can reach their workspace with the right access.',
      done: invited.length === 0 && active.length > 1,
      status: invited.length ? `${invited.length} pending invite${invited.length === 1 ? '' : 's'}` : 'Everyone active',
      href: '/app/people',
      cta: 'Invite & verify',
    },
  ];

  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const pctDone = Math.round((doneCount / required.length) * 100);

  return (
    <div>
      <PageHeader
        title="Company setup"
        subtitle="Everything needed to get your company live on HeyVacay — tick each step off."
      />

      <Card className="mb-5 border-brand/30 bg-brand/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-bold text-slate-900">
              {doneCount}/{required.length} steps complete
            </p>
            <p className="text-xs text-slate-500">
              {pctDone === 100
                ? 'You’re all set — your company is ready to go.'
                : 'Finish the remaining steps to go live.'}
            </p>
          </div>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-sm font-bold',
              pctDone === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-brand/15 text-brand-dark'
            )}
          >
            {pctDone}%
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={doneCount} max={required.length} tone={pctDone === 100 ? 'brand' : 'brand'} />
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-500">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />
          <span>
            <span className="font-semibold text-slate-700">Setting a customer up?</span> Walk through
            these steps together — assign access, confirm policies and budgets, connect SSO, then
            verify each person can sign in and sees the right tools.
            {isSuperAdmin ? '' : ' (Some company-wide steps need a super admin.)'}
          </span>
        </div>
      </Card>

      <div className="space-y-3">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.key} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span
                className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
                  s.done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                )}
              >
                {s.done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-800">{s.title}</p>
                  {s.optional && <Badge color="slate">Optional</Badge>}
                  {s.done ? (
                    <Badge color="green">Done</Badge>
                  ) : (
                    <Badge color="amber">To do</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{s.desc}</p>
                <p className="mt-1 text-xs font-medium text-slate-400">{s.status}</p>
              </div>
              <Button variant={s.done ? 'outline' : 'primary'} href={s.href} className="shrink-0">
                {s.cta} <ArrowRight className="h-4 w-4" />
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
