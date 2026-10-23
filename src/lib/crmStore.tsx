'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  SEED_COMPANIES,
  ONBOARDING_TEMPLATE,
  type AccountStatus,
  type SalesCompany,
} from './crm';
import { todayISO, uid } from './format';

const KEY = 'hv_crm_demo_v1';

interface CrmApi {
  companies: SalesCompany[];
  companyById: (id: string) => SalesCompany | undefined;
  addCompany: (data: {
    name: string;
    domain: string;
    employees: number;
    hq: string;
    annualSpend: number;
    accountManager?: string;
  }) => SalesCompany;
  setStatus: (id: string, status: AccountStatus) => void;
  assignManager: (id: string, rep: string | undefined) => void;
  toggleStep: (id: string, key: string) => void;
  logActivity: (id: string, text: string) => void;
  reset: () => void;
}

const Ctx = createContext<CrmApi | null>(null);

export function CrmProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<SalesCompany[]>(SEED_COMPANIES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setCompanies(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(companies));
    } catch {
      /* ignore */
    }
  }, [companies, hydrated]);

  const companyById = useCallback(
    (id: string) => companies.find((c) => c.id === id),
    [companies]
  );

  const patch = useCallback(
    (id: string, fn: (c: SalesCompany) => SalesCompany) =>
      setCompanies((cs) => cs.map((c) => (c.id === id ? fn(c) : c))),
    []
  );

  const addCompany: CrmApi['addCompany'] = useCallback((data) => {
    const co: SalesCompany = {
      id: uid('co'),
      name: data.name,
      domain: data.domain,
      status: 'lead',
      employees: data.employees,
      hq: data.hq,
      accountManager: data.accountManager,
      annualSpend: data.annualSpend,
      savings: 0,
      createdAt: todayISO(),
      onboarding: ONBOARDING_TEMPLATE.map((s) => ({ ...s, done: false })),
      contacts: [],
      activity: [{ date: todayISO(), text: 'Company created' }],
    };
    setCompanies((cs) => [co, ...cs]);
    return co;
  }, []);

  const setStatus: CrmApi['setStatus'] = useCallback(
    (id, status) =>
      patch(id, (c) => ({
        ...c,
        status,
        activity: [
          { date: todayISO(), text: `Status → ${status}` },
          ...c.activity,
        ],
      })),
    [patch]
  );

  const assignManager: CrmApi['assignManager'] = useCallback(
    (id, rep) =>
      patch(id, (c) => ({
        ...c,
        accountManager: rep,
        activity: [
          {
            date: todayISO(),
            text: rep ? `Account manager → ${rep}` : 'Account manager cleared',
          },
          ...c.activity,
        ],
      })),
    [patch]
  );

  const toggleStep: CrmApi['toggleStep'] = useCallback(
    (id, key) =>
      patch(id, (c) => ({
        ...c,
        onboarding: c.onboarding.map((s) =>
          s.key === key ? { ...s, done: !s.done } : s
        ),
      })),
    [patch]
  );

  const logActivity: CrmApi['logActivity'] = useCallback(
    (id, text) =>
      patch(id, (c) => ({
        ...c,
        activity: [{ date: todayISO(), text }, ...c.activity],
      })),
    [patch]
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setCompanies(SEED_COMPANIES);
  }, []);

  return (
    <Ctx.Provider
      value={{
        companies,
        companyById,
        addCompany,
        setStatus,
        assignManager,
        toggleStep,
        logActivity,
        reset,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCrm(): CrmApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCrm must be used within CrmProvider');
  return v;
}
