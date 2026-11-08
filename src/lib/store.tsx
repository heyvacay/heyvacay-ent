'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AccessControl,
  AppState,
  Billing,
  Net30KycFields,
  KycStatus,
  Booking,
  BookingApprovalMode,
  BudgetScope,
  GuestBookingMode,
  Expense,
  ExpenseStatus,
  IntegrationStatus,
  InventoryOption,
  OnboardingProfile,
  Policy,
  PlannedItem,
  PolicyChange,
  PolicyChangeRequest,
  Role,
  TripPlan,
  User,
  LiveBookingContext,
} from './types';
import { SEED } from './seed';
import { autoBookOnApproval, type AutoBookResult } from './approvalBooking';
import { uid, todayISO } from './format';
import { rewardsFor } from './rewards';
import { sendEmail } from './email';
import { computeDunning, invoicePeriodPaid, type DunningState } from './dunning';

const STORAGE_KEY = 'hv_ent_demo_v2';

/**
 * Each company a rep enters gets its OWN persisted workspace, keyed by company
 * id, so accounts are genuinely separate — bookings, expenses, people and
 * settings made inside one account never leak into another (or into the demo
 * owner workspace). The default key is the owner's own login.
 */
const acctKey = (id?: string | null): string =>
  id ? `hv_ent_acct_${id}` : STORAGE_KEY;

/** Back-fill slices added after a browser last saved its workspace. */
function mergeLoaded(s: AppState): AppState {
  return {
    ...SEED,
    ...s,
    integrations: s.integrations ?? SEED.integrations,
    billing: s.billing ?? SEED.billing,
    accountingMap: s.accountingMap ?? SEED.accountingMap,
    history: s.history ?? SEED.history,
  };
}

/** The demo/experience mode. 'demo' = the rich seeded workspace; 'fresh' = a
 *  brand-new empty company, for walking the true new-user experience. */
export function readExperience(): 'demo' | 'fresh' {
  try {
    return localStorage.getItem('hv_ent_experience') === 'fresh' ? 'fresh' : 'demo';
  } catch {
    return 'demo';
  }
}

/** A brand-new company workspace: just the owner, default policies, and no
 *  activity at all — what an account looks like the moment it's created. */
function freshSeed(): AppState {
  const owner = SEED.users.find((u) => u.id === 'u_admin') ?? SEED.users[0];
  return {
    ...SEED,
    users: owner ? [owner] : SEED.users.slice(0, 1),
    activeUserId: owner?.id ?? SEED.activeUserId,
    bookings: [],
    expenses: [],
    points: [],
    tripPlans: [],
    budgets: [],
  };
}

/** The base workspace for the default login, honoring the experience mode. */
function defaultBase(): AppState {
  return readExperience() === 'fresh' ? freshSeed() : SEED;
}

/** A clean workspace for a newly-entered company: seed structure (users,
 *  policies, access rules) with the company's own identity and zero activity. */
function seedAccount(ctx: { id?: string; name: string; domain: string }): AppState {
  return {
    ...SEED,
    company: {
      ...SEED.company,
      id: ctx.id ?? SEED.company.id,
      name: ctx.name,
      domain: ctx.domain || SEED.company.domain,
    },
    bookings: [],
    expenses: [],
    points: [],
  };
}

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
  /** True when the effective user is a company-wide (super) admin. */
  isSuperAdmin: boolean;
  /** True when the active user can see ALL company data (owner, or a role /
   *  department the company granted full access, or a per-user grant). */
  fullAccess: boolean;
  /** Whether a given user has full company-wide data visibility. */
  userHasFullAccess: (u?: User | null) => boolean;
  /** The ids of everyone who reports (directly or indirectly) to a manager. */
  directReportIds: (managerId: string) => string[];
  /** The company's data-access configuration (which roles/departments see all). */
  accessControl: AccessControl;
  setAccessControl: (patch: Partial<AccessControl>) => void;
  /** True when a Nova rep is viewing this company's account from the CRM. */
  viewingAs: boolean;
  setActiveUser: (id: string) => void;

  userById: (id: string) => User | undefined;
  spentForScope: (scope: BudgetScope, refId: string | null) => number;
  companySpend: number;
  companySavings: number;
  /** Invoiced-billing collections state — drives late fees and the hard
   *  booking shut-off (card-only at 3 weeks, paused at 4+). */
  dunning: DunningState;
  pointsBalance: (userId: string) => number;

  evaluatePolicies: (opt: InventoryOption, startDate: string) => PolicyFlag[];

  inviteUser: (data: {
    name: string;
    email: string;
    department: string;
    title: string;
    role: Role;
  }) => void;
  updateUser: (
    id: string,
    patch: Partial<
      Pick<
        User,
        'name' | 'title' | 'department' | 'role' | 'status' | 'approvalMode' | 'managerId' | 'fullAccess' | 'superAdmin'
      >
    >
  ) => void;
  /** Set a user's home city (used to decide if they need a hotel for an event). */
  setHomeCity: (userId: string, city: string, lat?: number, lng?: number) => void;
  /** Effective booking approval mode for a traveler (employee override ∨ company default). */
  approvalModeFor: (userId: string) => BookingApprovalMode;
  /** Set the company-wide default approval mode. */
  setCompanyApprovalMode: (mode: BookingApprovalMode) => void;
  /** Set (or clear → 'default') a single employee's approval-mode override. */
  setUserApprovalMode: (userId: string, mode: BookingApprovalMode | 'default') => void;
  setDepartmentApprovalMode: (dept: string, mode: BookingApprovalMode | 'default') => void;
  setBillingMode: (mode: Billing['mode']) => void;
  linkCard: (brand: string, last4: string) => void;
  requestNet30: () => void;
  /** Sales-rep only: start Net 30 by sending a KYC form to the account owner. */
  startNet30Kyc: () => void;
  /** Account owner: submit the KYC form → 'received' (waits for HeyVacay review). */
  submitNet30Kyc: (fields: Net30KycFields) => void;
  /** HeyVacay reviewer: set the KYC status (approve unlocks Net 30 + invoicing). */
  setKycStatus: (status: KycStatus, comment?: string) => void;
  /** Account owner: reply to a needs_attention note → back to in_review. */
  respondKyc: (text: string) => void;
  updateBudgetLimit: (id: string, limit: number) => void;
  setScopedBudget: (
    scope: BudgetScope,
    refId: string | null,
    limit: number,
    label?: string
  ) => void;
  addPolicy: (p: Omit<Policy, 'id'>) => void;
  togglePolicy: (id: string) => void;
  updatePolicy: (id: string, patch: Partial<Omit<Policy, 'id'>>) => void;
  removePolicy: (id: string) => void;
  /** Apply a policy change if super admin, else file it for approval. Returns
   *  'applied' or 'requested'. */
  changePolicy: (change: PolicyChange, summary: string) => 'applied' | 'requested';
  resolvePolicyChange: (id: string, approve: boolean) => void;
  book: (args: {
    opt: InventoryOption;
    travelerId: string;
    /** Custom traveler name when booking for someone not in the system. */
    guestName?: string;
    startDate: string;
    endDate: string;
    roomType?: string;
    images?: string[];
    travelerNote?: string;
    eventId?: string;
    eventName?: string;
    /** Event allow-listed stay — skip travel policy (no approval / no block). */
    bypassPolicy?: boolean;
    /** Supplier/booking reference from a real (live) booking, when issued. */
    supplierRef?: string;
    /** Stripe PaymentIntent the charge was made on (for refunds on cancel). */
    stripePaymentIntentId?: string;
    /** Live supplier payload to really book this on approval (approval path). */
    liveContext?: LiveBookingContext;
  }) => Booking;
  /** Company rule: whether booking for a custom/guest name needs approval. */
  guestBookingMode: GuestBookingMode;
  setGuestBookingMode: (mode: GuestBookingMode) => void;
  cancelBooking: (id: string, note?: string, noteVisible?: boolean) => void;
  /** Cancel a trip through the refund flow: records the reason + refund. */
  cancelTrip: (
    id: string,
    details: { reason: string; comment?: string; refundAmount: number; cancelDeadline?: string }
  ) => void;
  /** Tie an already-booked trip to an event (no rebooking needed). */
  attachBookingToEvent: (bookingId: string, eventId: string, eventName: string) => void;

  /** Combined flight+hotel trip plans. */
  savePlan: (plan: TripPlan) => void;
  submitPlan: (id: string) => void;
  /** Approve (books both legs + emails the traveler) or decline a plan. */
  resolvePlan: (id: string, approve: boolean, note?: string) => void;
  removePlan: (id: string) => void;
  approveBooking: (id: string, note?: string, noteVisible?: boolean) => void;
  /** Approve AND place the real supplier order unattended when a live payload
   *  was captured and live booking is on; falls back to a local confirm, and
   *  flags a re-confirm instead of booking at a moved price. */
  approveBookingLive: (id: string, note?: string, noteVisible?: boolean) => Promise<AutoBookResult>;
  /** Manager "approve if changed": sends a counter-offer to the traveler. */
  proposeChange: (
    id: string,
    data: {
      note: string;
      newPrice?: number;
      newRoomType?: string;
      newImage?: string;
      oldPrice?: number;
      oldRoomType?: string;
      by: string;
    }
  ) => void;
  /** Traveler responds to a counter-offer. */
  respondOffer: (id: string, accept: boolean) => void;
  /** Send a message in a booking's traveler↔manager chat. */
  sendChat: (
    id: string,
    msg: { authorId: string; author: string; role: 'traveler' | 'manager'; text: string }
  ) => void;
  submitExpense: (data: {
    userId: string;
    merchant: string;
    category: Expense['category'];
    amount: number;
    date: string;
    hasReceipt: boolean;
    note?: string;
    tripId?: string;
    reimbursable?: boolean;
    paidWith?: 'company' | 'personal';
  }) => void;
  setPersonalCard: (userId: string, brand: string, last4: string) => void;
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
  // Always-current snapshot for async flows (e.g. live auto-book on approve).
  const stateRef = useRef(state);
  stateRef.current = state;
  const [role, setRole] = useState<Role>('admin');
  const [hydrated, setHydrated] = useState(false);
  // The account the traveler app is working in. Persisted (localStorage) so the
  // SAME workspace is shown whether a Nova rep "enters" it or the actual user
  // logs into it — edits made in one are seen in the other. null = default
  // demo workspace. Separately, `repViewing` is true only when a rep is viewing
  // the account (the Nova overlay + KYC review powers); the actual user has it
  // false. The two are independent: which account loads vs. who's looking.
  const [activeAccount, setActiveAccount] = useState<{
    id?: string;
    name: string;
    domain: string;
  } | null>(null);
  const [repViewing, setRepViewing] = useState(false);

  // The storage key that's currently loaded into `state`, so the persist
  // effect never writes one account's data under another's key mid-switch.
  const loadedKeyRef = useRef<string | null>(null);

  // Read the active account + rep-viewing flag from storage.
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('hv_ent_active_account');
        setActiveAccount(raw ? JSON.parse(raw) : null);
      } catch {
        setActiveAccount(null);
      }
      try {
        setRepViewing(!!sessionStorage.getItem('hv_view_as'));
      } catch {
        setRepViewing(false);
      }
    };
    read();
    window.addEventListener('hv-account-change', read);
    window.addEventListener('hv-view-as-change', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('hv-account-change', read);
      window.removeEventListener('hv-view-as-change', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  // Load the active account's workspace whenever it changes. Each company id
  // maps to its own localStorage key (acctKey); the default login uses the
  // experience-aware base (demo seed, or a fresh empty company).
  useEffect(() => {
    const key = acctKey(activeAccount?.id);
    if (loadedKeyRef.current === key) return; // already loaded this account
    const base = () =>
      activeAccount?.id ? seedAccount(activeAccount) : defaultBase();
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: AppState; role?: Role };
        setState(parsed.state ? mergeLoaded(parsed.state) : base());
        setRole(parsed.role ?? 'admin');
      } else {
        setState(base());
        setRole('admin');
      }
    } catch {
      setState(base());
      setRole('admin');
    }
    loadedKeyRef.current = key;
    setHydrated(true);
  }, [activeAccount]);

  // Persist to the CURRENTLY loaded account's key only.
  useEffect(() => {
    if (!hydrated) return;
    const key = acctKey(activeAccount?.id);
    if (loadedKeyRef.current !== key) return; // mid-switch; skip
    try {
      localStorage.setItem(key, JSON.stringify({ state, role }));
    } catch {
      /* ignore */
    }
  }, [state, role, hydrated, activeAccount]);

  // The state exposed to the app. The persisted workspace already carries the
  // right company identity; we re-overlay name/domain so CRM renames show live.
  const effectiveState: AppState = activeAccount
    ? {
        ...state,
        company: {
          ...state.company,
          name: activeAccount.name,
          domain: activeAccount.domain || state.company.domain,
        },
      }
    : state;

  const activeUser =
    state.users.find((u) => u.id === state.activeUserId) ?? state.users[0];
  // A super admin is an admin flagged with company-wide control. A plain admin
  // is a team manager scoped to their department.
  const isSuperAdmin = role === 'admin' && !!activeUser?.superAdmin;

  // Who sees ALL company data: the owner always, plus any role or department
  // the company put on its access list, plus any per-user grant. Companies
  // configure this on the Access & visibility settings.
  const accessControl: AccessControl = state.company.accessControl ?? {
    fullAccessRoles: [],
    fullAccessDepartments: ['Finance'],
  };
  const userHasFullAccess = useCallback(
    (u?: User | null): boolean => {
      if (!u) return false;
      if (u.superAdmin) return true;
      if (u.fullAccess) return true;
      if (accessControl.fullAccessRoles.includes(u.role)) return true;
      if (accessControl.fullAccessDepartments.includes(u.department)) return true;
      return false;
    },
    [accessControl]
  );
  const fullAccess = userHasFullAccess(activeUser);

  const directReportIds = useCallback(
    (managerId: string): string[] => {
      const out: string[] = [];
      const walk = (mid: string) => {
        for (const u of state.users) {
          if (u.managerId === mid && !out.includes(u.id)) {
            out.push(u.id);
            walk(u.id);
          }
        }
      };
      walk(managerId);
      return out;
    },
    [state.users]
  );

  const setAccessControl: StoreApi['setAccessControl'] = useCallback((patch) => {
    setState((s) => {
      const current = s.company.accessControl ?? {
        fullAccessRoles: [],
        fullAccessDepartments: ['Finance'],
      };
      return { ...s, company: { ...s.company, accessControl: { ...current, ...patch } } };
    });
  }, []);

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

  // Collections state for invoiced (Net 30) companies. Only meaningful once
  // hydrated (reads per-viewer "paid" flags from localStorage); 'ok' before.
  const net30Active =
    state.billing?.mode === 'net30' && state.billing?.netKyc?.status === 'approved';
  const dunning = useMemo<DunningState>(() => {
    if (!hydrated || !net30Active) return { level: 'ok', weeksLate: 0, balance: 0 };
    return computeDunning(state.bookings, invoicePeriodPaid);
  }, [hydrated, net30Active, state.bookings]);

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
      // A city-scoped rule only applies to stays in that city.
      const cityMatch = (p: Policy) =>
        !p.city ||
        (opt.location ?? '').toLowerCase().includes(p.city.toLowerCase());

      for (const p of state.policies.filter((x) => x.enabled)) {
        if (p.type === 'max_nightly' && opt.type === 'hotel' && cityMatch(p)) {
          const nightly = opt.price / (opt.nights || 1);
          if (nightly > Number(p.value))
            flags.push({
              policy: p,
              message: `Nightly rate ~${Math.round(nightly)} is over the ${p.value} cap${p.city ? ` for ${p.city}` : ''}.`,
            });
        }
        if (p.type === 'max_hotel_star' && opt.type === 'hotel' && opt.star && cityMatch(p)) {
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

  // Resolution order: per-employee override → per-department override →
  // company default. This mirrors how most TMCs layer policy.
  const approvalModeFor = useCallback(
    (userId: string): BookingApprovalMode => {
      const u = state.users.find((x) => x.id === userId);
      if (u?.approvalMode && u.approvalMode !== 'default') return u.approvalMode;
      const dept = u?.department;
      const deptMode = dept ? state.departmentApprovalModes?.[dept] : undefined;
      if (deptMode) return deptMode;
      return state.company.approvalMode ?? 'open';
    },
    [state.users, state.company.approvalMode, state.departmentApprovalModes]
  );

  const setCompanyApprovalMode: StoreApi['setCompanyApprovalMode'] = useCallback(
    (mode) => setState((s) => ({ ...s, company: { ...s.company, approvalMode: mode } })),
    []
  );

  const setGuestBookingMode: StoreApi['setGuestBookingMode'] = useCallback(
    (mode) => setState((s) => ({ ...s, guestBookingMode: mode })),
    []
  );

  const setUserApprovalMode: StoreApi['setUserApprovalMode'] = useCallback(
    (userId, mode) =>
      setState((s) => ({
        ...s,
        users: s.users.map((u) => (u.id === userId ? { ...u, approvalMode: mode } : u)),
      })),
    []
  );

  const setDepartmentApprovalMode: StoreApi['setDepartmentApprovalMode'] = useCallback(
    (dept, mode) =>
      setState((s) => {
        const next = { ...(s.departmentApprovalModes ?? {}) };
        if (mode === 'default') delete next[dept];
        else next[dept] = mode;
        return { ...s, departmentApprovalModes: next };
      }),
    []
  );

  const inviteUser: StoreApi['inviteUser'] = useCallback((data) => {
    setState((s) => {
      const inviter =
        s.users.find((u) => u.id === s.activeUserId)?.name ?? 'Your team admin';
      const roleLabel =
        data.role === 'admin' ? 'Admin' : data.role === 'booker' ? 'Travel booker' : 'Traveler';
      let joinUrl = '/join';
      try {
        joinUrl = `${window.location.origin}/join?email=${encodeURIComponent(data.email)}`;
      } catch {
        /* non-browser */
      }
      sendEmail('invite', data.email, {
        name: data.name,
        company: s.company.name,
        inviter,
        role: roleLabel,
        joinUrl,
      });
      return {
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
      };
    });
  }, []);

  const updateUser: StoreApi['updateUser'] = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    }));
  }, []);

  const setHomeCity: StoreApi['setHomeCity'] = useCallback((userId, city, lat, lng) => {
    setState((s) => ({
      ...s,
      users: s.users.map((u) =>
        u.id === userId ? { ...u, homeCity: city, homeLat: lat, homeLng: lng } : u
      ),
    }));
  }, []);

  const setBillingMode: StoreApi['setBillingMode'] = useCallback((mode) => {
    setState((s) => ({ ...s, billing: { ...(s.billing ?? { mode }), mode } }));
  }, []);

  const linkCard: StoreApi['linkCard'] = useCallback((brand, last4) => {
    setState((s) => ({
      ...s,
      billing: { ...(s.billing ?? { mode: 'card' }), mode: 'card', cardBrand: brand, cardLast4: last4 },
    }));
  }, []);

  const requestNet30: StoreApi['requestNet30'] = useCallback(() => {
    setState((s) => ({ ...s, billing: { ...(s.billing ?? { mode: 'employee' }), netRequested: true } }));
  }, []);

  // Sales-rep only: begin Net 30 by sending a KYC form to the account owner
  // (the company's super admin). Net 30 is not active until the owner submits
  // and it's approved.
  const startNet30Kyc: StoreApi['startNet30Kyc'] = useCallback(() => {
    let repName = 'Your HeyVacay rep';
    try {
      repName = localStorage.getItem('hv_crm_me_v1') || repName;
    } catch {
      /* ignore */
    }
    setState((s) => {
      const owner =
        s.users.find((u) => u.role === 'admin' && u.superAdmin) ??
        s.users.find((u) => u.role === 'admin') ??
        s.users[0];
      if (!owner) return s;
      sendEmail('net30Kyc', owner.email, {
        ownerName: owner.name,
        company: s.company.name,
        rep: repName,
      });
      return {
        ...s,
        billing: {
          ...(s.billing ?? { mode: 'employee' as Billing['mode'] }),
          netRequested: true,
          netKyc: {
            status: 'sent',
            rep: repName,
            ownerName: owner.name,
            ownerEmail: owner.email,
            sentAt: todayISO(),
          },
        },
      };
    });
  }, []);

  // Account owner submits the KYC form. This does NOT auto-approve: it goes to
  // 'received' (= we have it) and waits for the HeyVacay team to review.
  const submitNet30Kyc: StoreApi['submitNet30Kyc'] = useCallback((fields: Net30KycFields) => {
    setState((s) => {
      const prev = s.billing?.netKyc;
      if (!prev) return s;
      const now = todayISO();
      return {
        ...s,
        billing: {
          ...(s.billing ?? { mode: 'employee' as Billing['mode'] }),
          netRequested: true,
          netKyc: {
            ...prev,
            status: 'received',
            submittedAt: now,
            fields,
            history: [
              ...(prev.history ?? []),
              { status: 'received', at: now, by: prev.ownerName },
            ],
          },
        },
      };
    });
  }, []);

  // HeyVacay reviewer moves the KYC through its lifecycle. On 'approved' Net 30
  // goes live (unlocking the Invoice Center). 'needs_attention' carries a note
  // telling the account what to fix.
  const setKycStatus: StoreApi['setKycStatus'] = useCallback((status, comment) => {
    let reviewer = 'HeyVacay team';
    try {
      reviewer = localStorage.getItem('hv_crm_me_v1') || reviewer;
    } catch {
      /* ignore */
    }
    setState((s) => {
      const prev = s.billing?.netKyc;
      if (!prev) return s;
      const now = todayISO();
      const approved = status === 'approved';
      return {
        ...s,
        billing: {
          ...(s.billing ?? { mode: 'employee' as Billing['mode'] }),
          ...(approved ? { mode: 'net30' as Billing['mode'] } : {}),
          netKyc: {
            ...prev,
            status,
            reviewer,
            reviewComment: status === 'needs_attention' ? comment : undefined,
            ...(approved ? { approvedAt: now } : {}),
            history: [...(prev.history ?? []), { status, at: now, by: reviewer, comment }],
          },
        },
      };
    });
  }, []);

  // Account owner replies to a needs_attention note → back to in_review.
  const respondKyc: StoreApi['respondKyc'] = useCallback((text) => {
    setState((s) => {
      const prev = s.billing?.netKyc;
      if (!prev) return s;
      const now = todayISO();
      return {
        ...s,
        billing: {
          ...(s.billing ?? { mode: 'employee' as Billing['mode'] }),
          netKyc: {
            ...prev,
            status: 'in_review',
            ownerResponse: text,
            history: [
              ...(prev.history ?? []),
              { status: 'in_review', at: now, by: prev.ownerName, comment: text },
            ],
          },
        },
      };
    });
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

  // Upsert an employee's (or department's) budget so every person can be given
  // a budget even if they don't have one yet.
  const setScopedBudget: StoreApi['setScopedBudget'] = useCallback(
    (scope, refId, limit, label) => {
      setState((s) => {
        const existing = s.budgets.find((b) => b.scope === scope && b.refId === refId);
        if (existing) {
          return {
            ...s,
            budgets: s.budgets.map((b) => (b.id === existing.id ? { ...b, limit } : b)),
          };
        }
        return {
          ...s,
          budgets: [
            ...s.budgets,
            {
              id: uid('bud'),
              scope,
              refId,
              label: label ?? refId ?? scope,
              limit,
              period: 'year' as const,
            },
          ],
        };
      });
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

  // Apply a policy change directly to state (used by super admins and on
  // approval of a requested change).
  const applyPolicyChange = useCallback((s: AppState, c: PolicyChange): AppState => {
    switch (c.kind) {
      case 'add':
        return { ...s, policies: [...s.policies, { ...c.policy, id: uid('p') }] };
      case 'toggle':
        return {
          ...s,
          policies: s.policies.map((p) => (p.id === c.id ? { ...p, enabled: !p.enabled } : p)),
        };
      case 'update':
        return {
          ...s,
          policies: s.policies.map((p) => (p.id === c.id ? { ...p, ...c.patch } : p)),
        };
      case 'remove':
        return { ...s, policies: s.policies.filter((p) => p.id !== c.id) };
      case 'companyMode':
        return { ...s, company: { ...s.company, approvalMode: c.mode } };
      case 'userMode':
        return {
          ...s,
          users: s.users.map((u) => (u.id === c.userId ? { ...u, approvalMode: c.mode } : u)),
        };
      case 'deptMode': {
        const next = { ...(s.departmentApprovalModes ?? {}) };
        if (c.mode === 'default') delete next[c.dept];
        else next[c.dept] = c.mode;
        return { ...s, departmentApprovalModes: next };
      }
      default:
        return s;
    }
  }, []);

  const changePolicy: StoreApi['changePolicy'] = useCallback(
    (change, summary) => {
      if (isSuperAdmin) {
        setState((s) => applyPolicyChange(s, change));
        return 'applied';
      }
      const req: PolicyChangeRequest = {
        id: uid('pcr'),
        by: activeUser.id,
        byName: activeUser.name,
        summary,
        change,
        createdAt: todayISO(),
        status: 'pending',
      };
      setState((s) => ({
        ...s,
        policyChangeRequests: [req, ...(s.policyChangeRequests ?? [])],
      }));
      return 'requested';
    },
    [isSuperAdmin, applyPolicyChange, activeUser.id, activeUser.name]
  );

  const resolvePolicyChange: StoreApi['resolvePolicyChange'] = useCallback(
    (id, approve) => {
      setState((s) => {
        const req = (s.policyChangeRequests ?? []).find((r) => r.id === id);
        if (!req || req.status !== 'pending') return s;
        const requests = (s.policyChangeRequests ?? []).map((r) =>
          r.id === id ? { ...r, status: approve ? ('approved' as const) : ('rejected' as const) } : r
        );
        const base = { ...s, policyChangeRequests: requests };
        return approve ? applyPolicyChange(base, req.change) : base;
      });
    },
    [applyPolicyChange]
  );

  const book: StoreApi['book'] = useCallback(
    ({ opt, travelerId, guestName, startDate, endDate, roomType, images, travelerNote, eventId, eventName, bypassPolicy, supplierRef, stripePaymentIntentId, liveContext }) => {
      const { savings, points: pointsEarned } = rewardsFor(opt);
      const guest = guestName?.trim() || undefined;
      // An event allow-listed stay is pre-cleared by an admin: skip the travel
      // policy entirely (no approval, no block) even if it's out of policy.
      const flags = bypassPolicy ? [] : evaluatePolicies(opt, startDate);
      // Approval mode gates on top of the travel policy: pre-approval forces
      // every trip through a manager; event-scoped trips not tied to an event
      // also route for approval (the UI normally prevents that case).
      const traveler = state.users.find((u) => u.id === travelerId);
      const mode: BookingApprovalMode = approvalModeFor(travelerId);
      // Booking for a custom name can require approval per company policy.
      const guestNeedsApproval =
        !!guest && (state.guestBookingMode ?? 'allowed') === 'approval';
      const needsApproval =
        flags.some((f) => f.policy.action === 'approve' || f.policy.action === 'block') ||
        (!bypassPolicy && mode === 'pre_approval') ||
        (mode === 'event_required' && !eventId) ||
        guestNeedsApproval;

      const booking: Booking = {
        id: uid('bk'),
        type: opt.type,
        title: opt.title,
        detail: opt.detail,
        travelerId,
        guestName: guest,
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
        destination:
          opt.type === 'flight'
            ? opt.destIata ?? opt.title
            : opt.location ?? opt.title,
        departAt: opt.departAt,
        arriveAt: opt.arriveAt,
        airline: opt.airline,
        images: images ?? opt.images,
        roomType,
        hid: opt.hid,
        travelerNote,
        eventId,
        eventName,
        supplierRef,
        stripePaymentIntentId,
        liveContext: needsApproval ? liveContext : undefined,
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
    [evaluatePolicies, approvalModeFor, state.activeUserId, state.users, state.company.approvalMode, activeUser.department]
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

  /** Flip a pending booking to confirmed (+ points), the legacy local path. */
  const confirmPendingLocal = useCallback(
    (id: string, patch: Partial<Booking> = {}) => {
      setState((s) => {
        const bk = s.bookings.find((b) => b.id === id);
        if (!bk) return s;
        const alreadyHasPoints = s.points.some((p) => p.bookingId === id);
        const points = alreadyHasPoints
          ? s.points
          : [
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
            b.id === id ? { ...b, status: 'confirmed' as const, ...patch } : b
          ),
          points,
        };
      });
    },
    []
  );

  /** Just patch a pending booking's rebook sub-state (no confirm, no points). */
  const patchBooking = useCallback((id: string, patch: Partial<Booking>) => {
    setState((s) => ({
      ...s,
      bookings: s.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }, []);

  /**
   * Approve a booking AND place the real supplier order (unattended), when a
   * live payload was captured at request time and live booking is on. Falls
   * back to the legacy local confirm when live booking is off or no payload
   * exists, and never books at a moved price — it flags a re-confirm instead.
   */
  const approveBookingLive = useCallback(
    async (id: string, note?: string, noteVisible = true): Promise<AutoBookResult> => {
      const bk = stateRef.current.bookings.find((b) => b.id === id);
      if (!bk || bk.status !== 'pending_approval') return { status: 'error', message: 'Not pending.' };
      if (!bk.liveContext) {
        confirmPendingLocal(id, { reviewNote: note || bk.reviewNote, reviewNoteVisible: note ? noteVisible : bk.reviewNoteVisible, rebookStatus: 'local' });
        return { status: 'live_off' };
      }
      const result = await autoBookOnApproval(bk.liveContext);
      switch (result.status) {
        case 'booked':
          confirmPendingLocal(id, {
            reviewNote: note || bk.reviewNote,
            reviewNoteVisible: note ? noteVisible : bk.reviewNoteVisible,
            rebookStatus: 'booked_live',
            supplierRef: result.supplierRef ?? bk.supplierRef,
            price: result.amount || bk.price,
            priceRefreshedTo: result.amount && result.amount !== bk.price ? result.amount : undefined,
          });
          break;
        case 'live_off':
          confirmPendingLocal(id, { reviewNote: note || bk.reviewNote, reviewNoteVisible: note ? noteVisible : bk.reviewNoteVisible, rebookStatus: 'local' });
          break;
        case 'price_changed':
          patchBooking(id, { rebookStatus: 'price_changed', priceRefreshedTo: result.newAmount, rebookMessage: `Supplier price moved to $${Math.round(result.newAmount)} — re-confirm to book.` });
          break;
        case 'unavailable':
          patchBooking(id, { rebookStatus: 'unavailable', rebookMessage: result.message || 'No longer available.' });
          break;
        case 'needs_payment':
          patchBooking(id, { rebookStatus: 'needs_payment', rebookMessage: result.message || 'Company card could not be charged.' });
          break;
        case 'needs_details':
          patchBooking(id, { rebookStatus: 'needs_details', rebookMessage: result.message || 'Traveler travel profile required.' });
          break;
        default:
          patchBooking(id, { rebookMessage: result.message || 'Could not complete the booking.' });
      }
      return result;
    },
    [confirmPendingLocal, patchBooking]
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

  const cancelTrip: StoreApi['cancelTrip'] = useCallback((id, details) => {
    setState((s) => ({
      ...s,
      bookings: s.bookings.map((b) =>
        b.id === id
          ? {
              ...b,
              status: 'cancelled',
              cancelledAt: new Date().toISOString().slice(0, 10),
              cancellationReason: details.reason,
              cancellationComment: details.comment,
              refundAmount: details.refundAmount,
              refundStatus: 'pending',
              cancelDeadline: details.cancelDeadline ?? b.cancelDeadline,
            }
          : b
      ),
      // A cancelled trip no longer earns its points.
      points: s.points.filter((p) => p.bookingId !== id),
    }));
  }, []);

  const attachBookingToEvent: StoreApi['attachBookingToEvent'] = useCallback(
    (bookingId, eventId, eventName) => {
      setState((s) => ({
        ...s,
        bookings: s.bookings.map((b) =>
          b.id === bookingId ? { ...b, eventId, eventName } : b
        ),
      }));
    },
    []
  );

  const savePlan: StoreApi['savePlan'] = useCallback((plan) => {
    setState((s) => {
      const existing = (s.tripPlans ?? []).some((p) => p.id === plan.id);
      return {
        ...s,
        tripPlans: existing
          ? (s.tripPlans ?? []).map((p) => (p.id === plan.id ? plan : p))
          : [plan, ...(s.tripPlans ?? [])],
      };
    });
  }, []);

  const submitPlan: StoreApi['submitPlan'] = useCallback((id) => {
    setState((s) => ({
      ...s,
      tripPlans: (s.tripPlans ?? []).map((p) =>
        p.id === id ? { ...p, status: 'pending_approval' as const } : p
      ),
    }));
  }, []);

  const removePlan: StoreApi['removePlan'] = useCallback((id) => {
    setState((s) => ({ ...s, tripPlans: (s.tripPlans ?? []).filter((p) => p.id !== id) }));
  }, []);

  const resolvePlan: StoreApi['resolvePlan'] = useCallback(
    (id, approve, note) => {
      setState((s) => {
        const plan = (s.tripPlans ?? []).find((p) => p.id === id);
        if (!plan || plan.status !== 'pending_approval') return s;
        if (!approve) {
          return {
            ...s,
            tripPlans: (s.tripPlans ?? []).map((p) =>
              p.id === id ? { ...p, status: 'declined' as const, reviewNote: note } : p
            ),
          };
        }
        // Approve → book both legs now, with confirmation numbers.
        const newBookings: Booking[] = [];
        const legs: PlannedItem[] = [plan.flight, plan.hotel].filter(Boolean) as PlannedItem[];
        const confos: Record<'flight' | 'hotel', string> = { flight: '', hotel: '' };
        for (const leg of legs) {
          const confirmation = `HV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          const { savings, points } = rewardsFor(leg.opt);
          const bk: Booking = {
            id: uid('bk'),
            type: leg.opt.type,
            title: leg.opt.title,
            detail: leg.opt.detail,
            travelerId: plan.travelerId,
            bookedById: plan.travelerId,
            department: s.users.find((u) => u.id === plan.travelerId)?.department ?? '',
            startDate: leg.startDate,
            endDate: leg.endDate,
            marketPrice: leg.opt.marketPrice,
            price: leg.opt.price,
            savings,
            pointsEarned: points,
            status: 'confirmed',
            createdAt: todayISO(),
            destination: plan.destination,
            roomType: leg.roomType,
            images: leg.images,
          };
          newBookings.push(bk);
          confos[leg.opt.type] = confirmation;
        }
        const updatedPlan: TripPlan = {
          ...plan,
          status: 'booked',
          reviewNote: note,
          flight: plan.flight ? { ...plan.flight, confirmation: confos.flight } : undefined,
          hotel: plan.hotel ? { ...plan.hotel, confirmation: confos.hotel } : undefined,
        };
        // Email the traveler the combined confirmation (no-op without a key).
        const trav = s.users.find((u) => u.id === plan.travelerId);
        if (trav?.email) {
          const total = legs.reduce((sum, l) => sum + l.opt.price, 0);
          sendEmail('confirmation', trav.email, {
            travelerName: trav.name,
            title: `Trip to ${plan.destination} approved`,
            dates: `${plan.startDate} – ${plan.endDate}`,
            total,
            savings: legs.reduce((sum, l) => sum + rewardsFor(l.opt).savings, 0),
            points: legs.reduce((sum, l) => sum + rewardsFor(l.opt).points, 0),
            inPolicy: legs.every((l) => l.inPolicy),
            note: `Your manager approved your trip. Flight confirmation: ${confos.flight || '—'} · Hotel confirmation: ${confos.hotel || '—'}.`,
          });
        }
        return {
          ...s,
          bookings: [...newBookings, ...s.bookings],
          tripPlans: (s.tripPlans ?? []).map((p) => (p.id === id ? updatedPlan : p)),
        };
      });
    },
    []
  );

  const proposeChange: StoreApi['proposeChange'] = useCallback((id, data) => {
    setState((s) => ({
      ...s,
      bookings: s.bookings.map((b) =>
        b.id === id
          ? {
              ...b,
              offer: {
                note: data.note,
                newPrice: data.newPrice,
                newRoomType: data.newRoomType,
                newImage: data.newImage,
                oldPrice: data.oldPrice ?? b.price,
                oldRoomType: data.oldRoomType ?? b.roomType,
                by: data.by,
                status: 'offered',
              },
              // Seed the chat with the manager's offer so the traveler sees it.
              chat: [
                ...(b.chat ?? []),
                {
                  id: uid('cm'),
                  authorId: s.activeUserId,
                  author: data.by,
                  role: 'manager' as const,
                  text: data.note,
                  ts: new Date().toISOString(),
                },
              ],
            }
          : b
      ),
    }));
  }, []);

  const sendChat: StoreApi['sendChat'] = useCallback((id, msg) => {
    setState((s) => ({
      ...s,
      bookings: s.bookings.map((b) =>
        b.id === id
          ? {
              ...b,
              chat: [
                ...(b.chat ?? []),
                { id: uid('cm'), ts: new Date().toISOString(), ...msg },
              ],
            }
          : b
      ),
    }));
  }, []);

  const respondOffer: StoreApi['respondOffer'] = useCallback((id, accept) => {
    setState((s) => {
      const bk = s.bookings.find((b) => b.id === id);
      if (!bk || !bk.offer) return s;
      if (!accept) {
        return {
          ...s,
          bookings: s.bookings.map((b) =>
            b.id === id
              ? { ...b, status: 'cancelled', offer: { ...b.offer!, status: 'declined' } }
              : b
          ),
          points: s.points.filter((p) => p.bookingId !== id),
        };
      }
      // Accept: apply the proposed changes and confirm, awarding points.
      const newPrice = bk.offer.newPrice ?? bk.price;
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
                price: newPrice,
                roomType: bk.offer!.newRoomType ?? b.roomType,
                offer: { ...b.offer!, status: 'accepted' },
              }
            : b
        ),
        points,
      };
    });
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

  const setPersonalCard: StoreApi['setPersonalCard'] = useCallback(
    (userId, brand, last4) =>
      setState((s) => ({
        ...s,
        users: s.users.map((u) =>
          u.id === userId
            ? {
                ...u,
                personalLinked: last4 ? true : u.personalLinked,
                personalCard: last4 ? { brand, last4 } : undefined,
              }
            : u
        ),
      })),
    []
  );

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
        const ownerName = [profile.firstName, profile.lastName]
          .map((x) => (x ?? '').trim())
          .filter(Boolean)
          .join(' ');
        return {
          ...s,
          company: {
            ...s.company,
            name: profile.companyName || s.company.name,
            currency: profile.currency || s.company.currency,
          },
          onboarding: profile,
          users: [
            // Name + email the signed-up owner (the admin account) from signup.
            ...s.users.map((u) =>
              u.id === 'u_admin'
                ? {
                    ...u,
                    name: ownerName || u.name,
                    email: profile.workEmail || u.email,
                  }
                : u
            ),
            ...newInvites,
          ],
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
      localStorage.removeItem('hv_ent_active_account');
      localStorage.removeItem('hv_ent_experience');
      // Clear every per-company workspace we isolated.
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('hv_ent_acct_')) localStorage.removeItem(k);
      }
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
    isSuperAdmin,
    fullAccess,
    userHasFullAccess,
    directReportIds,
    accessControl,
    setAccessControl,
    viewingAs: repViewing,
    setActiveUser,
    userById,
    spentForScope,
    companySpend,
    companySavings,
    dunning,
    pointsBalance,
    evaluatePolicies,
    inviteUser,
    updateUser,
    setHomeCity,
    approvalModeFor,
    setCompanyApprovalMode,
    guestBookingMode: state.guestBookingMode ?? 'allowed',
    setGuestBookingMode,
    setUserApprovalMode,
    setDepartmentApprovalMode,
    setBillingMode,
    startNet30Kyc,
    submitNet30Kyc,
    setKycStatus,
    respondKyc,
    linkCard,
    requestNet30,
    updateBudgetLimit,
    setScopedBudget,
    addPolicy,
    togglePolicy,
    updatePolicy,
    removePolicy,
    changePolicy,
    resolvePolicyChange,
    book,
    cancelBooking,
    cancelTrip,
    attachBookingToEvent,
    savePlan,
    submitPlan,
    resolvePlan,
    removePlan,
    approveBooking,
    approveBookingLive,
    proposeChange,
    respondOffer,
    sendChat,
    submitExpense,
    setPersonalCard,
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
