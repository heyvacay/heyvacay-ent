'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppState,
  Booking,
  BudgetScope,
  Expense,
  ExpenseStatus,
  IntegrationStatus,
  InventoryOption,
  OnboardingProfile,
  Policy,
  Role,
  User,
} from './types';
import { SEED } from './seed';
import { uid } from './format';
import { rewardsFor } from './rewards';

const STORAGE_KEY = 'hv_ent_demo_v2';

/** Order flight cabins so we can compare "is this above the allowed cabin?". */
function cabinRank(cabin: string): number {
  const c = cabin.toLowerCase();
  if (c.includes('first')) return 3;
  if (c.includes('business')) return 2;
  if (c.includes('premium')) return 1;
  return 0; // economy / anything else
}

export interface PolicyFlag {
  policy: Policy;
  message: string;
}

export interface StoreApi {
  state: AppState;
  activeUser: User;
  role: Role; // effective role (respects "view as")
  setRole: (r: Role) => void;
  setActiveUser: (id: string) => void;

  userById: (id: string) => User | undefined;
  spentForScope: (scope: BudgetScope, refId: string | null) => number;
  companySpend: number;
  companySavings: number;
  pointsBalance: (userId: string) => number;

  evaluatePolicies: (opt: InventoryOption, startDate: string) => PolicyFlag[];

  inviteUser: (data: {
    name: string;
    email: string;
    department: string;
    title: string;
    role: Role;
  }) => void;
  updateBudgetLimit: (id: string, limit: number) => void;
  addPolicy: (p: Omit<Policy, 'id'>) => void;
  togglePolicy: (id: string) => void;
  updatePolicy: (id: string, patch: Partial<Omit<Policy, 'id'>>) => void;
  removePolicy: (id: string) => void;
  book: (args: {
    opt: InventoryOption;
    travelerId: string;
    startDate: string;
    endDate: string;
  }) => Booking;
  cancelBooking: (id: string, note?: string, noteVisible?: boolean) => void;
  approveBooking: (id: string, note?: string, noteVisible?: boolean) => void;
  submitExpense: (data: {
    userId: string;
    merchant: string;
    category: Expense['category'];
    amount: number;
    date: string;
    hasReceipt: boolean;
    note?: string;
  }) => void;
  setExpenseStatus: (id: string, status: ExpenseStatus, note?: string) => void;
  redeemPoints: (userId: string, amount: number, reason: string) => void;
  completeOnboarding: (profile: OnboardingProfile) => void;
  setIntegrationStatus: (id: string, status: IntegrationStatus) => void;
  setGlMapping: (category: string, account: string) => void;
  syncExpense: (id: string) => void;
  syncAllApproved: () => void;
  reset: () => void;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(SEED);
  const [role, setRole] = useState<Role>('admin');
  const [hydrated, setHydrated] = useState(false);
  // When a sales rep "enters" a company from the Nova console, we overlay that
  // company's identity onto the workspace (non-persistent — view only).
  const [impersonation, setImpersonation] = useState<{
    id?: string;
    name: string;
    domain: string;
  } | null>(null);

  // Load persisted state on the client only (avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          state: AppState;
          role: Role;
        };
        if (parsed.state)
          setState({
            ...SEED,
            ...parsed.state,
            // back-fill slices added after this browser last saved
            integrations: parsed.state.integrations ?? SEED.integrations,
            accountingMap: parsed.state.accountingMap ?? SEED.accountingMap,
            history: parsed.state.history ?? SEED.history,
          });
        if (parsed.role) setRole(parsed.role);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, role }));
    } catch {
      /* ignore */
    }
  }, [state, role, hydrated]);

  // Read the "view as company" overlay set by the Sales console.
  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem('hv_view_as_ctx');
        setImpersonation(raw ? JSON.parse(raw) : null);
      } catch {
        setImpersonation(null);
      }
    };
    read();
    window.addEventListener('hv-view-as-change', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('hv-view-as-change', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  // The state exposed to the app, with the impersonated company's identity
  // overlaid on top. Never persisted — raw `state` stays clean.
  // When entering a company OTHER than the seed account, the workspace starts
  // clean — no prior bookings/expenses/points — so a rep sets it up from zero.
  const freshAccount =
    impersonation != null &&
    impersonation.id != null &&
    impersonation.id !== state.company.id;
  const effectiveState: AppState = impersonation
    ? {
        ...state,
        company: {
          ...state.company,
          name: impersonation.name,
          domain: impersonation.domain || state.company.domain,
        },
        ...(freshAccount
          ? { bookings: [], expenses: [], points: [] }
          : {}),
      }
    : state;

  const activeUser =
    state.users.find((u) => u.id === state.activeUserId) ?? state.users[0];

  const userById = useCallback(
    (id: string) => state.users.find((u) => u.id === id),
    [state.users]
  );

  const spentForScope = useCallback(
    (scope: BudgetScope, refId: string | null) => {
      return state.bookings
        .filter((b) => b.status !== 'cancelled')
        .filter((b) => {
          if (scope === 'company') return true;
          if (scope === 'department') return b.department === refId;
          return b.travelerId === refId;
        })
        .reduce((sum, b) => sum + b.price, 0);
    },
    [state.bookings]
  );

  const companySpend = useMemo(
    () =>
      state.bookings
        .filter((b) => b.status !== 'cancelled')
        .reduce((s, b) => s + b.price, 0),
    [state.bookings]
  );

  const companySavings = useMemo(
    () =>
      state.bookings
        .filter((b) => b.status !== 'cancelled')
        .reduce((s, b) => s + b.savings, 0),
    [state.bookings]
  );

  const pointsBalance = useCallback(
    (userId: string) =>
      state.points
        .filter((p) => p.userId === userId)
        .reduce((s, p) => s + p.delta, 0),
    [state.points]
  );

  const evaluatePolicies = useCallback(
    (opt: InventoryOption, startDate: string): PolicyFlag[] => {
      const flags: PolicyFlag[] = [];
      const daysAhead = Math.round(
        (new Date(startDate).getTime() - Date.now()) / 86400000
      );
      for (const p of state.policies.filter((x) => x.enabled)) {
        if (p.type === 'max_nightly' && opt.type === 'hotel') {
          const nightly = opt.price / (opt.nights || 1);
          if (nightly > Number(p.value))
            flags.push({
              policy: p,
              message: `Nightly rate ~${Math.round(nightly)} is over the ${p.value} cap.`,
            });
        }
        if (p.type === 'max_hotel_star' && opt.type === 'hotel' && opt.star) {
          if (opt.star > Number(p.value))
            flags.push({
              policy: p,
              message: `${opt.star}-star is above the ${p.value}-star limit.`,
            });
        }
        if (p.type === 'advance_days') {
          if (daysAhead < Number(p.value))
            flags.push({
              policy: p,
              message: `Booked ${daysAhead} days ahead — policy asks for ${p.value}+.`,
            });
        }
        if (
          p.type === 'flight_cabin_by_duration' &&
          opt.type === 'flight' &&
          opt.cabin &&
          opt.durationMins != null &&
          p.tiers &&
          p.tiers.length
        ) {
          const hours = opt.durationMins / 60;
          const tiers = [...p.tiers].sort(
            (a, b) => (a.upToHours ?? Infinity) - (b.upToHours ?? Infinity)
          );
          const tier =
            tiers.find((t) => t.upToHours == null || hours <= t.upToHours) ??
            tiers[tiers.length - 1];
          if (tier && cabinRank(opt.cabin) > cabinRank(tier.cabin)) {
            const len =
              tier.upToHours == null
                ? `over ${tiers[tiers.length - 2]?.upToHours ?? 0}h`
                : `up to ${tier.upToHours}h`;
            flags.push({
              policy: p,
              message: `Flights ${len} allow up to ${tier.cabin}; this is ${opt.cabin}.`,
            });
          }
        }
        if (p.type === 'max_cabin' && opt.type === 'flight' && opt.cabin) {
          if (cabinRank(opt.cabin) > cabinRank(String(p.value)))
            flags.push({
              policy: p,
              message: `${opt.cabin} is above the ${p.value} cabin limit.`,
            });
        }
      }
      return flags;
    },
    [state.policies]
  );

  const inviteUser: StoreApi['inviteUser'] = useCallback((data) => {
    setState((s) => ({
      ...s,
      users: [
        ...s.users,
        {
          id: uid('u'),
          name: data.name,
          email: data.email,
          role: data.role,
          department: data.department,
          title: data.title,
          status: 'invited',
          loyalty: [],
          personalLinked: false,
        },
      ],
    }));
  }, []);

  const updateBudgetLimit: StoreApi['updateBudgetLimit'] = useCallback(
    (id, limit) => {
      setState((s) => ({
        ...s,
        budgets: s.budgets.map((b) => (b.id === id ? { ...b, limit } : b)),
      }));
    },
    []
  );

  const addPolicy: StoreApi['addPolicy'] = useCallback((p) => {
    setState((s) => ({
      ...s,
      policies: [...s.policies, { ...p, id: uid('p') }],
    }));
  }, []);

  const togglePolicy: StoreApi['togglePolicy'] = useCallback((id) => {
    setState((s) => ({
      ...s,
      policies: s.policies.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      ),
    }));
  }, []);

  const updatePolicy: StoreApi['updatePolicy'] = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      policies: s.policies.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  const removePolicy: StoreApi['removePolicy'] = useCallback((id) => {
    setState((s) => ({
      ...s,
      policies: s.policies.filter((p) => p.id !== id),
    }));
  }, []);

  const book: StoreApi['book'] = useCallback(
    ({ opt, travelerId, startDate, endDate }) => {
      const { savings, points: pointsEarned } = rewardsFor(opt);
      const flags = evaluatePolicies(opt, startDate);
      const needsApproval = flags.some(
        (f) => f.policy.action === 'approve' || f.policy.action === 'block'
      );
      const traveler = state.users.find((u) => u.id === travelerId);

      const booking: Booking = {
        id: uid('bk'),
        type: opt.type,
        title: opt.title,
        detail: opt.detail,
        travelerId,
        bookedById: state.activeUserId,
        department: traveler?.department ?? activeUser.department,
        startDate,
        endDate,
        marketPrice: opt.marketPrice,
        price: opt.price,
        savings,
        pointsEarned,
        status: needsApproval ? 'pending_approval' : 'confirmed',
        createdAt: new Date().toISOString().slice(0, 10),
        policyNotes: flags.map((f) => f.message),
        freeCancellation: opt.freeCancellation,
      };

      setState((s) => {
        const points = [...s.points];
        if (!needsApproval) {
          points.push({
            id: uid('pt'),
            userId: travelerId,
            delta: pointsEarned,
            reason: `${opt.type === 'flight' ? 'Flight' : 'Hotel'} savings · ${opt.title}`,
            bucket: 'self',
            bookingId: booking.id,
            createdAt: booking.createdAt,
          });
          if (s.activeUserId !== travelerId) {
            points.push({
              id: uid('pt'),
              userId: s.activeUserId,
              delta: Math.round(savings),
              reason: `Booker reward · ${opt.title}`,
              bucket: 'booker',
              bookingId: booking.id,
              createdAt: booking.createdAt,
            });
          }
        }
        return { ...s, bookings: [booking, ...s.bookings], points };
      });
      return booking;
    },
    [evaluatePolicies, state.activeUserId, state.users, activeUser.department]
  );

  const approveBooking: StoreApi['approveBooking'] = useCallback(
    (id, note, noteVisible = true) => {
      setState((s) => {
        const bk = s.bookings.find((b) => b.id === id);
        if (!bk || bk.status !== 'pending_approval') return s;
        const points = [
          ...s.points,
          {
            id: uid('pt'),
            userId: bk.travelerId,
            delta: bk.pointsEarned,
            reason: `${bk.type === 'flight' ? 'Flight' : 'Hotel'} savings · ${bk.title}`,
            bucket: 'self' as const,
            bookingId: bk.id,
            createdAt: bk.createdAt,
          },
        ];
        return {
          ...s,
          bookings: s.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: 'confirmed',
                  reviewNote: note || b.reviewNote,
                  reviewNoteVisible: note ? noteVisible : b.reviewNoteVisible,
                }
              : b
          ),
          points,
        };
      });
    },
    []
  );

  const cancelBooking: StoreApi['cancelBooking'] = useCallback(
    (id, note, noteVisible = true) => {
      setState((s) => ({
        ...s,
        bookings: s.bookings.map((b) =>
          b.id === id
            ? {
                ...b,
                status: 'cancelled',
                reviewNote: note || b.reviewNote,
                reviewNoteVisible: note ? noteVisible : b.reviewNoteVisible,
              }
            : b
        ),
        points: s.points.filter((p) => p.bookingId !== id),
      }));
    },
    []
  );

  const submitExpense: StoreApi['submitExpense'] = useCallback((data) => {
    setState((s) => ({
      ...s,
      expenses: [
        {
          id: uid('ex'),
          status: 'submitted',
          ...data,
        },
        ...s.expenses,
      ],
    }));
  }, []);

  const setExpenseStatus: StoreApi['setExpenseStatus'] = useCallback(
    (id, status, note) => {
      setState((s) => ({
        ...s,
        expenses: s.expenses.map((e) =>
          e.id === id ? { ...e, status, reviewNote: note || e.reviewNote } : e
        ),
      }));
    },
    []
  );

  const redeemPoints: StoreApi['redeemPoints'] = useCallback(
    (userId, amount, reason) => {
      setState((s) => ({
        ...s,
        points: [
          {
            id: uid('pt'),
            userId,
            delta: -Math.abs(amount),
            reason,
            bucket: 'self',
            createdAt: new Date().toISOString().slice(0, 10),
          },
          ...s.points,
        ],
      }));
    },
    []
  );

  const completeOnboarding: StoreApi['completeOnboarding'] = useCallback(
    (profile) => {
      setState((s) => {
        const newInvites = profile.invites
          .map((e) => e.trim())
          .filter(Boolean)
          .filter(
            (e) => !s.users.some((u) => u.email.toLowerCase() === e.toLowerCase())
          )
          .map((email) => ({
            id: uid('u'),
            name: email
              .split('@')[0]
              .replace(/[._]+/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            email,
            role: 'employee' as const,
            department: 'Unassigned',
            title: 'Teammate',
            status: 'invited' as const,
            loyalty: [],
            personalLinked: false,
          }));
        return {
          ...s,
          company: {
            ...s.company,
            name: profile.companyName || s.company.name,
            currency: profile.currency || s.company.currency,
          },
          onboarding: profile,
          users: [...s.users, ...newInvites],
          integrations: s.integrations.map((i) =>
            profile.integrations.includes(i.id)
              ? { ...i, status: 'requested' as const }
              : i
          ),
        };
      });
    },
    []
  );

  const setIntegrationStatus: StoreApi['setIntegrationStatus'] = useCallback(
    (id, status) => {
      setState((s) => ({
        ...s,
        integrations: s.integrations.map((i) =>
          i.id === id ? { ...i, status } : i
        ),
      }));
    },
    []
  );

  const setGlMapping: StoreApi['setGlMapping'] = useCallback(
    (category, account) => {
      setState((s) => ({
        ...s,
        accountingMap: { ...s.accountingMap, [category]: account },
      }));
    },
    []
  );

  const syncExpense: StoreApi['syncExpense'] = useCallback((id) => {
    setState((s) => ({
      ...s,
      expenses: s.expenses.map((e) =>
        e.id === id
          ? { ...e, synced: true, glCode: e.glCode ?? s.accountingMap[e.category] }
          : e
      ),
    }));
  }, []);

  const syncAllApproved: StoreApi['syncAllApproved'] = useCallback(() => {
    setState((s) => ({
      ...s,
      expenses: s.expenses.map((e) =>
        (e.status === 'approved' || e.status === 'reimbursed') && !e.synced
          ? { ...e, synced: true, glCode: e.glCode ?? s.accountingMap[e.category] }
          : e
      ),
    }));
  }, []);

  const setActiveUser = useCallback((id: string) => {
    setState((s) => ({ ...s, activeUserId: id }));
  }, []);

  const reset = useCallback(() => {
    try {
      // Reset the whole demo in one go — customer app AND the Nova CRM — plus
      // any "view as company" overlay, then reload so every provider reseeds.
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('hv_crm_demo_v2');
      sessionStorage.removeItem('hv_view_as');
      sessionStorage.removeItem('hv_view_as_ctx');
    } catch {
      /* ignore */
    }
    setState(SEED);
    setRole('admin');
    if (typeof window !== 'undefined') window.location.href = '/app';
  }, []);

  const api: StoreApi = {
    state: effectiveState,
    activeUser,
    role,
    setRole,
    setActiveUser,
    userById,
    spentForScope,
    companySpend,
    companySavings,
    pointsBalance,
    evaluatePolicies,
    inviteUser,
    updateBudgetLimit,
    addPolicy,
    togglePolicy,
    updatePolicy,
    removePolicy,
    book,
    cancelBooking,
    approveBooking,
    submitExpense,
    setExpenseStatus,
    redeemPoints,
    completeOnboarding,
    setIntegrationStatus,
    setGlMapping,
    syncExpense,
    syncAllApproved,
    reset,
  };

  if (!hydrated) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
      </div>
    );
  }

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
