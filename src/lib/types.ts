/**
 * HeyVacay Enterprise domain model.
 *
 * These types are the contract the UI is built against. Today they're served by
 * the in-browser demo store (src/lib/store.tsx); when staging is stood up the
 * same shapes come from the enterprise backend API with no UI changes.
 */

export type Role = 'admin' | 'booker' | 'employee';

/**
 * How much gating a booking goes through before it's confirmed:
 * - 'open'           — employee books freely (travel policy still applies).
 * - 'pre_approval'   — a manager must approve every booking before it's live.
 * - 'event_required' — a trip can only be booked against a manager-approved event.
 */
export type BookingApprovalMode = 'open' | 'pre_approval' | 'event_required';

export interface Company {
  id: string;
  name: string;
  currency: string; // ISO 4217, e.g. "USD"
  domain: string;
  /** Company-wide default booking approval mode (per-employee can override). */
  approvalMode?: BookingApprovalMode;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** An admin with full, company-wide control (vs. a team-manager admin). */
  superAdmin?: boolean;
  department: string;
  title: string;
  status: 'active' | 'invited' | 'deactivated';
  loyalty: { program: string; number: string }[];
  personalLinked: boolean;
  /** Per-employee booking approval mode; omitted/'default' inherits the company. */
  approvalMode?: BookingApprovalMode | 'default';
  /** Home city (for events: whether this person needs a hotel). */
  homeCity?: string;
  homeLat?: number;
  homeLng?: number;
  /** A saved personal card, so personal-card checkout pre-populates. */
  personalCard?: { brand: string; last4: string };
}

export type BudgetScope = 'company' | 'department' | 'employee';

export interface Budget {
  id: string;
  scope: BudgetScope;
  /** department name or user id; null for company-wide */
  refId: string | null;
  label: string;
  limit: number;
  period: 'trip' | 'month' | 'quarter' | 'year';
}

export type PolicyType =
  | 'max_hotel_star'
  | 'max_nightly'
  | 'max_cabin'
  | 'flight_cabin_by_duration'
  | 'advance_days';

export type PolicyAction = 'allow' | 'warn' | 'approve' | 'block';

/** One row of a flight cabin policy: the top allowed cabin up to a duration. */
export interface FlightCabinTier {
  /** Upper bound in hours; null means "and anything longer". */
  upToHours: number | null;
  /** Highest allowed cabin at this tier, e.g. "Economy". */
  cabin: string;
}

export interface Policy {
  id: string;
  name: string;
  type: PolicyType;
  value: number | string;
  action: PolicyAction;
  enabled: boolean;
  /** For flight_cabin_by_duration: cabin allowance by flight length. */
  tiers?: FlightCabinTier[];
  /** Optional city scope — the rule applies only to stays in this city. */
  city?: string;
}

/**
 * A requested change to travel policy. Non-super admins' policy edits are
 * recorded as one of these and applied only once a super admin approves.
 */
export type PolicyChange =
  | { kind: 'add'; policy: Omit<Policy, 'id'> }
  | { kind: 'toggle'; id: string }
  | { kind: 'update'; id: string; patch: Partial<Omit<Policy, 'id'>> }
  | { kind: 'remove'; id: string }
  | { kind: 'companyMode'; mode: BookingApprovalMode }
  | { kind: 'userMode'; userId: string; mode: BookingApprovalMode | 'default' }
  | { kind: 'deptMode'; dept: string; mode: BookingApprovalMode | 'default' };

export interface PolicyChangeRequest {
  id: string;
  by: string; // user id who requested it
  byName: string;
  summary: string;
  change: PolicyChange;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

/** One leg (flight or hotel) selected into a combined trip plan. */
export interface PlannedItem {
  opt: InventoryOption;
  startDate: string;
  endDate: string;
  roomType?: string;
  images?: string[];
  inPolicy: boolean;
  flags: string[];
  /** Confirmation number, set when the plan is booked. */
  confirmation?: string;
}

export type TripPlanStatus = 'planning' | 'pending_approval' | 'booked' | 'declined';

/** A combined flight + hotel trip planned and approved/booked together. */
export interface TripPlan {
  id: string;
  travelerId: string;
  destination: string;
  startDate: string;
  endDate: string;
  flight?: PlannedItem;
  hotel?: PlannedItem;
  status: TripPlanStatus;
  createdAt: string;
  reviewNote?: string;
}

export type BookingType = 'hotel' | 'flight';
export type BookingStatus = 'confirmed' | 'pending_approval' | 'cancelled';

export interface Booking {
  id: string;
  type: BookingType;
  title: string;
  detail: string;
  travelerId: string;
  /** Free-text traveler name when booking for someone not in the system
   *  (a guest, candidate, or contractor). When set, it is who's travelling;
   *  travelerId is the booker who owns the trip. */
  guestName?: string;
  bookedById: string;
  department: string;
  startDate: string; // ISO date
  endDate: string;
  marketPrice: number;
  price: number; // HeyVacay price (what the company pays)
  savings: number;
  pointsEarned: number;
  status: BookingStatus;
  createdAt: string;
  /** Policy rules this trip tripped, captured at booking time. */
  policyNotes?: string[];
  /** A reviewer's comment when approved/declined. */
  reviewNote?: string;
  /** Whether the reviewer's comment is shown to the traveler (default true). */
  reviewNoteVisible?: boolean;
  /** A note the traveler adds when submitting for approval. */
  travelerNote?: string;
  /** Hotel rate was free-cancellation (relevant to the approval window). */
  freeCancellation?: boolean;
  /** Destination label (flight dest city/IATA, or hotel location). */
  destination?: string;
  /** Flight departure / arrival times (ISO), when known. */
  departAt?: string;
  arriveAt?: string;
  /** Marketing airline name (flights). */
  airline?: string;
  /** Hotel images + the room type requested (shown to the approver). */
  images?: string[];
  roomType?: string;
  /** Hotel id, so the approver can load real room options to change it. */
  hid?: string;
  /** A manager's counter-offer when they "approve if changed". */
  offer?: {
    note: string;
    newPrice?: number;
    newRoomType?: string;
    /** Photo of the proposed room, for the traveler's full-change summary. */
    newImage?: string;
    /** Snapshot of what's being changed from, so the traveler sees before→after. */
    oldPrice?: number;
    oldRoomType?: string;
    by: string;
    status: 'offered' | 'accepted' | 'declined';
  };
  /** 1:1 chat thread between the traveler and the approving manager. */
  chat?: ChatMessage[];
  /** The event this trip is tied to (when booking is event-scoped). */
  eventId?: string;
  eventName?: string;
  /** The supplier/booking reference from a real (live) booking, when issued. */
  supplierRef?: string;
  /** Cancellation record (set when the trip is cancelled through the refund flow). */
  cancelledAt?: string;
  cancellationReason?: string;
  cancellationComment?: string;
  /** Amount refunded to the payer, and where it's going back to. */
  refundAmount?: number;
  refundStatus?: 'pending' | 'processed';
  /** Free-cancellation deadline captured at booking time (ISO date). */
  cancelDeadline?: string;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  author: string;
  role: 'traveler' | 'manager';
  text: string;
  ts: string;
}

export type ExpenseCategory =
  | 'Meals'
  | 'Ground transport'
  | 'Lodging'
  | 'Airfare'
  | 'Supplies'
  | 'Other';

export type ExpenseStatus =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'reimbursed';

export interface Expense {
  id: string;
  userId: string;
  merchant: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  status: ExpenseStatus;
  hasReceipt: boolean;
  note?: string;
  /** A reviewer's comment when approved/rejected (shown to the submitter). */
  reviewNote?: string;
  tripId?: string;
  /** GL account the expense posts to (set when synced to accounting). */
  glCode?: string;
  /** true once pushed to the connected accounting integration. */
  synced?: boolean;
  /** Owed back to the employee (paid on a personal card). */
  reimbursable?: boolean;
  /** How the underlying charge was paid. */
  paidWith?: 'company' | 'personal';
}

export type PointsBucket = 'self' | 'booker';

export interface PointsEntry {
  id: string;
  userId: string;
  delta: number; // + earn, - redeem
  reason: string;
  bucket: PointsBucket;
  bookingId?: string;
  createdAt: string;
}

/** One flown leg within a flight slice, for the details view. */
export interface FlightSegmentLite {
  originIata: string;
  destIata: string;
  departAt: string;
  arriveAt: string;
  durationMins?: number;
  carrier?: string;
  carrierIata?: string;
  carrierLogo?: string;
  flightNumber?: string;
  aircraft?: string;
}

export interface FlightSliceLite {
  originIata: string;
  destIata: string;
  durationMins?: number;
  stops: number;
  segments: FlightSegmentLite[];
}

export interface FlightDetails {
  kind: 'flight';
  cabin?: string;
  slices: FlightSliceLite[];
  conditions?: {
    changeable?: boolean | null;
    refundable?: boolean | null;
    carryOn?: number | null;
    checked?: number | null;
  };
}

export interface HotelDetails {
  kind: 'hotel';
  images: string[];
  amenities: string[];
  address?: string;
  rating?: number;
  reviews?: number;
}

export type OptionDetails = FlightDetails | HotelDetails;

/** A bookable option returned by search. */
export interface InventoryOption {
  id: string;
  type: BookingType;
  title: string;
  detail: string;
  marketPrice: number;
  price: number;
  star?: number;
  cabin?: string;
  carrier?: string;
  // hotel display
  hid?: string;
  imageUrl?: string;
  images?: string[];
  rating?: number;
  reviews?: number;
  location?: string;
  nights?: number;
  freeCancellation?: boolean;
  competitorSource?: string;
  // flight display
  airline?: string;
  airlineIata?: string;
  airlineLogo?: string;
  departAt?: string;
  arriveAt?: string;
  originIata?: string;
  destIata?: string;
  stops?: number;
  durationMins?: number;
  // rich payload for the "View details" view
  details?: OptionDetails;
}

export type IntegrationCategory =
  | 'Accounting'
  | 'HR / HRIS'
  | 'Expense & cards'
  | 'Identity'
  | 'Comms';

export type IntegrationStatus = 'available' | 'requested' | 'connected';

export interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  blurb: string;
  status: IntegrationStatus;
}

/** Captured by the guided sign-up flow and used to personalize the program. */
export interface OnboardingProfile {
  companyName: string;
  workEmail: string;
  teamSize: string;
  hq: string;
  currency: string;
  tripsPerMonth: string;
  books: 'flights' | 'hotels' | 'both';
  geography: 'domestic' | 'international' | 'mixed';
  annualSpend: number;
  bookingTool: string;
  expenseTool: string;
  integrations: string[];
  invites: string[];
  estimatedSavings: number;
  completedAt: string;
}

/** How bookings made for a custom (non-employee) traveler name are handled. */
export type GuestBookingMode = 'allowed' | 'approval';

export type BillingMode = 'card' | 'employee' | 'net30';

export interface Billing {
  /** card = company card on file (auto-charge); employee = traveler pays at
   *  booking; net30 = invoiced, traveler never prompted to pay. */
  mode: BillingMode;
  cardBrand?: string;
  cardLast4?: string;
  /** true once an admin has requested Net 30 (routes to the account manager). */
  netRequested?: boolean;
  /** Net-30 underwriting. Only a sales rep can start this; it sends a KYC form
   *  to the account owner, who fills it in. Net 30 goes live once approved. */
  netKyc?: Net30Kyc;
}

/** Fields the account owner fills in on the Net-30 KYC form. */
export interface Net30KycFields {
  legalName: string;
  taxId: string;
  billingEmail: string;
  billingAddress: string;
  estMonthlySpend: string;
  signerName: string;
  signerTitle: string;
}

export interface Net30Kyc {
  /** sent = waiting on the owner; submitted = owner returned it; approved = Net 30 live. */
  status: 'sent' | 'submitted' | 'approved';
  /** Sales rep who started the Net-30 setup. */
  rep: string;
  /** Account owner the form was sent to. */
  ownerName: string;
  ownerEmail: string;
  sentAt: string;
  submittedAt?: string;
  approvedAt?: string;
  fields?: Net30KycFields;
}

export interface AppState {
  company: Company;
  users: User[];
  budgets: Budget[];
  policies: Policy[];
  bookings: Booking[];
  expenses: Expense[];
  points: PointsEntry[];
  integrations: Integration[];
  billing?: Billing;
  onboarding?: OnboardingProfile;
  /** Expense category → GL account, used when posting to accounting. */
  accountingMap: Record<string, string>;
  /** Trailing monthly spend & savings, for the Reports charts. */
  history: { month: string; spend: number; savings: number }[];
  /** Per-department approval-mode overrides (department name → mode). Applied
   *  between the per-employee override and the company default. */
  departmentApprovalModes?: Record<string, BookingApprovalMode>;
  /** Whether booking for a custom/guest name needs manager approval.
   *  'allowed' (default) lets the booker do it directly; 'approval' routes it. */
  guestBookingMode?: GuestBookingMode;
  /** Pending/decided policy-change requests awaiting super-admin approval. */
  policyChangeRequests?: PolicyChangeRequest[];
  /** Combined flight+hotel trip plans (booked together on approval). */
  tripPlans?: TripPlan[];
  /** who is signed in for the demo */
  activeUserId: string;
}
