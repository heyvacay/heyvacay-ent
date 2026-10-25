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
  STAGE_PROBABILITY,
  ME,
  type AccountStatus,
  type Contact,
  type Contract,
  type ContractTerms,
  type CrmTask,
  type Deal,
  type DealStage,
  type SalesCompany,
  type TaskType,
  type Tier,
} from './crm';
import { todayISO, uid } from './format';

const KEY = 'hv_crm_demo_v2';

interface CrmApi {
  companies: SalesCompany[];
  companyById: (id: string) => SalesCompany | undefined;
  addCompany: (data: {
    name: string;
    domain: string;
    website?: string;
    industry: string;
    tier: Tier;
    employees: number;
    hq: string;
    annualSpend: number;
    accountManager?: string;
  }) => SalesCompany;
  updateCompany: (id: string, patch: Partial<SalesCompany>) => void;
  setStatus: (id: string, status: AccountStatus) => void;
  assignManager: (id: string, rep: string | undefined) => void;
  toggleStep: (id: string, key: string) => void;
  logActivity: (id: string, text: string) => void;

  addContact: (id: string, contact: Contact) => void;
  addNote: (id: string, text: string) => void;

  addDeal: (
    id: string,
    data: { name: string; value: number; stage: DealStage; closeDate: string }
  ) => void;
  moveDeal: (companyId: string, dealId: string, stage: DealStage) => void;

  addTask: (
    id: string,
    data: { title: string; type: TaskType; due: string }
  ) => void;
  toggleTask: (companyId: string, taskId: string) => void;

  addContract: (
    id: string,
    data: { title: string; terms: ContractTerms; value: number }
  ) => Contract;
  setContractStatus: (companyId: string, contractId: string, status: Contract['status']) => void;

  reset: () => void;
}

const Ctx = createContext<CrmApi | null>(null);

/** Back-fill arrays/fields added after an older browser last saved. */
function hydrateCompany(c: Partial<SalesCompany>): SalesCompany {
  return {
    ...(c as SalesCompany),
    deals: c.deals ?? [],
    contracts: c.contracts ?? [],
    tasks: c.tasks ?? [],
    notes: c.notes ?? [],
    activity: c.activity ?? [],
    contacts: c.contacts ?? [],
    onboarding: c.onboarding ?? ONBOARDING_TEMPLATE.map((s) => ({ ...s, done: false })),
    health: c.health ?? 60,
  };
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<SalesCompany[]>(SEED_COMPANIES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SalesCompany[];
        if (Array.isArray(parsed)) setCompanies(parsed.map(hydrateCompany));
      }
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

  const log = (c: SalesCompany, text: string): SalesCompany => ({
    ...c,
    activity: [{ date: todayISO(), text }, ...c.activity],
  });

  const addCompany: CrmApi['addCompany'] = useCallback((data) => {
    const co: SalesCompany = {
      id: uid('co'),
      name: data.name,
      domain: data.domain,
      website: data.website,
      status: 'lead',
      industry: data.industry,
      tier: data.tier,
      employees: data.employees,
      hq: data.hq,
      accountManager: data.accountManager,
      annualSpend: data.annualSpend,
      savings: 0,
      health: 60,
      nextStep: 'Qualify budget + authority',
      createdAt: todayISO(),
      onboarding: ONBOARDING_TEMPLATE.map((s) => ({ ...s, done: false })),
      contacts: [],
      deals: [],
      contracts: [],
      tasks: [],
      notes: [],
      activity: [{ date: todayISO(), text: 'Company created' }],
    };
    setCompanies((cs) => [co, ...cs]);
    return co;
  }, []);

  const updateCompany: CrmApi['updateCompany'] = useCallback(
    (id, p) => patch(id, (c) => ({ ...c, ...p })),
    [patch]
  );

  const setStatus: CrmApi['setStatus'] = useCallback(
    (id, status) => patch(id, (c) => log({ ...c, status }, `Status → ${status}`)),
    [patch]
  );

  const assignManager: CrmApi['assignManager'] = useCallback(
    (id, rep) =>
      patch(id, (c) =>
        log(
          { ...c, accountManager: rep },
          rep ? `Account manager → ${rep}` : 'Account manager cleared'
        )
      ),
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
    (id, text) => patch(id, (c) => log(c, text)),
    [patch]
  );

  const addContact: CrmApi['addContact'] = useCallback(
    (id, contact) =>
      patch(id, (c) =>
        log({ ...c, contacts: [...c.contacts, contact] }, `Contact added — ${contact.name}`)
      ),
    [patch]
  );

  const addNote: CrmApi['addNote'] = useCallback(
    (id, text) =>
      patch(id, (c) => ({
        ...c,
        notes: [
          { id: uid('n'), text, author: ME, date: todayISO() },
          ...c.notes,
        ],
      })),
    [patch]
  );

  const addDeal: CrmApi['addDeal'] = useCallback(
    (id, data) =>
      patch(id, (c) =>
        log(
          {
            ...c,
            deals: [
              {
                id: uid('d'),
                companyId: id,
                name: data.name,
                stage: data.stage,
                value: data.value,
                probability: STAGE_PROBABILITY[data.stage],
                closeDate: data.closeDate,
                owner: c.accountManager ?? ME,
                createdAt: todayISO(),
              },
              ...c.deals,
            ],
          },
          `Deal created — ${data.name}`
        )
      ),
    [patch]
  );

  const moveDeal: CrmApi['moveDeal'] = useCallback(
    (companyId, dealId, stage) =>
      patch(companyId, (c) => {
        const deal = c.deals.find((d) => d.id === dealId);
        return log(
          {
            ...c,
            deals: c.deals.map((d) =>
              d.id === dealId
                ? { ...d, stage, probability: STAGE_PROBABILITY[stage] }
                : d
            ),
          },
          `${deal?.name ?? 'Deal'} → ${stage}`
        );
      }),
    [patch]
  );

  const addTask: CrmApi['addTask'] = useCallback(
    (id, data) =>
      patch(id, (c) => ({
        ...c,
        tasks: [
          {
            id: uid('t'),
            companyId: id,
            title: data.title,
            type: data.type,
            due: data.due,
            done: false,
            owner: c.accountManager ?? ME,
            createdAt: todayISO(),
          },
          ...c.tasks,
        ],
      })),
    [patch]
  );

  const toggleTask: CrmApi['toggleTask'] = useCallback(
    (companyId, taskId) =>
      patch(companyId, (c) => ({
        ...c,
        tasks: c.tasks.map((t) =>
          t.id === taskId ? { ...t, done: !t.done } : t
        ),
      })),
    [patch]
  );

  const addContract: CrmApi['addContract'] = useCallback(
    (id, data) => {
      const contract: Contract = {
        id: uid('ct'),
        companyId: id,
        title: data.title,
        status: 'draft',
        terms: data.terms,
        value: data.value,
        createdAt: todayISO(),
        createdBy: ME,
      };
      patch(id, (c) =>
        log({ ...c, contracts: [contract, ...c.contracts] }, `Contract drafted — ${data.title}`)
      );
      return contract;
    },
    [patch]
  );

  const setContractStatus: CrmApi['setContractStatus'] = useCallback(
    (companyId, contractId, status) =>
      patch(companyId, (c) => {
        const ct = c.contracts.find((x) => x.id === contractId);
        return log(
          {
            ...c,
            contracts: c.contracts.map((x) =>
              x.id === contractId ? { ...x, status } : x
            ),
          },
          `${ct?.title ?? 'Contract'} → ${status}`
        );
      }),
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
        updateCompany,
        setStatus,
        assignManager,
        toggleStep,
        logActivity,
        addContact,
        addNote,
        addDeal,
        moveDeal,
        addTask,
        toggleTask,
        addContract,
        setContractStatus,
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
