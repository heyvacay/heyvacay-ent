'use client';

/**
 * Bridge from self-signup to the Nova CRM.
 *
 * When a company completes online onboarding we write it into the CRM store so
 * a new account + welcome task appear in the pipeline and the account manager
 * is prompted to reach out. Today this is a cross-store localStorage write;
 * when the backends are live it becomes an API call to ent.sales.nova.
 */
import { ONBOARDING_TEMPLATE, type SalesCompany, type Tier } from './crm';

const KEY = 'hv_crm_demo_v2';

export function pushSignupToCrm(p: {
  companyName: string;
  workEmail: string;
  annualSpend: number;
  teamSize?: number;
}): void {
  try {
    const raw = localStorage.getItem(KEY);
    const companies: SalesCompany[] = raw ? JSON.parse(raw) : [];
    const domain = p.workEmail.split('@')[1] ?? '';
    // Avoid duplicates if they refresh / re-submit.
    if (domain && companies.some((c) => c.domain === domain)) return;

    const id = `co_${Math.random().toString(36).slice(2, 8)}`;
    const today = new Date().toISOString().slice(0, 10);
    const tier: Tier =
      p.annualSpend > 2_000_000 ? 'Enterprise' : p.annualSpend > 500_000 ? 'Mid-Market' : 'SMB';

    const co: SalesCompany = {
      id,
      name: p.companyName,
      domain,
      website: domain ? `https://${domain}` : undefined,
      status: 'onboarding',
      industry: 'Technology',
      tier,
      employees: p.teamSize ?? 50,
      hq: '',
      accountManager: 'Danil B.',
      annualSpend: p.annualSpend,
      savings: 0,
      health: 65,
      nextStep: 'Welcome call — self-signed up',
      createdAt: today,
      onboarding: ONBOARDING_TEMPLATE.map((s) => ({ ...s, done: false })),
      contacts: [
        { name: p.workEmail.split('@')[0] || 'Admin', title: 'Admin', email: p.workEmail, champion: true },
      ],
      deals: [],
      contracts: [],
      tasks: [
        {
          id: `t_${id}`,
          companyId: id,
          title: 'Welcome call — new self-signup',
          type: 'call',
          due: today,
          done: false,
          owner: 'Danil B.',
          createdAt: today,
        },
      ],
      notes: [],
      activity: [
        { date: today, text: '🎉 New self-signup — added from online onboarding. Notify account manager.' },
      ],
    };

    localStorage.setItem(KEY, JSON.stringify([co, ...companies]));
  } catch {
    /* ignore */
  }
}
