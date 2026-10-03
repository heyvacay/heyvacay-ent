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
  InventoryOption,
  Policy,
  Role,
  User,
} from './types';
import { SEED } from './seed';
import { uid } from './format';

const STORAGE_KEY = 'hv_ent_demo_v1';

/** Points multiplier on savings, by product. Mirrors the rewards copy. */
function multiplier(type: 'hotel' | 'flight'): number {
  return type === 'flight' ? 2 : 1;
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
  book: (args: {
    opt: InventoryOption;
    travelerId: string;
    startDate: string;
    endDate: string;
  }) => Booking;
  cancelBooking: (id: string) => void;
  approveBooking: (id: string) => void;
  submitExpense: (data: {
    userId: string;
    merchant: string;
    category: Expense['category'];
    amount: number;
    date: string;
    hasReceipt: boolean;
    note?: string;
  }) => void;
  setExpenseStatus: (id: string, status: ExpenseStatus) => void;
  redeemPoints: (userId: string, amount: number, reason: string) => void;
  reset: () => void;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(SEED);
  const [role, setRole] = useState<Role>('admin');
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state on the client only (avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          state: AppState;
          role: Role;
        };
        if (parsed.state) setState(parsed.state);
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
          const nightly = opt.price / 3;
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

  const book: StoreApi['book'] = useCallback(
    ({ opt, travelerId, startDate, endDate }) => {
      const savings = Math.max(0, opt.marketPrice - opt.price);
      const pointsEarned = Math.round(savings * multiplier(opt.type));
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

  const approveBooking: StoreApi['approveBooking'] = useCallback((id) => {
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
          b.id === id ? { ...b, status: 'confirmed' } : b
        ),
        points,
      };
    });
  }, []);

  const cancelBooking: StoreApi['cancelBooking'] = useCallback((id) => {
    setState((s) => ({
      ...s,
      bookings: s.bookings.map((b) =>
        b.id === id ? { ...b, status: 'cancelled' } : b
      ),
      points: s.points.filter((p) => p.bookingId !== id),
    }));
  }, []);

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
    (id, status) => {
      setState((s) => ({
        ...s,
        expenses: s.expenses.map((e) => (e.id === id ? { ...e, status } : e)),
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

  const setActiveUser = useCallback((id: string) => {
    setState((s) => ({ ...s, activeUserId: id }));
  }, []);

  const reset = useCallback(() => {
    setState(SEED);
    setRole('admin');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const api: StoreApi = {
    state,
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
    book,
    cancelBooking,
    approveBooking,
    submitExpense,
    setExpenseStatus,
    redeemPoints,
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
