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
  department: string;
  title: string;
  status: 'active' | 'invited' | 'deactivated';
  loyalty: { program: string; number: string }[];
  personalLinked: boolean;
  /** Per-employee booking approval mode; omitted/'default' inherits the company. */
  approvalMode?: BookingApprovalMode | 'default';
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

export type BookingType = 'hotel' | 'flight';
export type BookingStatus = 'confirmed' | 'pending_approval' | 'cancelled';

export interface Booking {
  id: string;
  type: BookingType;
  title: string;
  detail: string;
  travelerId: string;
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

export type BillingMode = 'card' | 'employee' | 'net30';

export interface Billing {
  /** card = company card on file (auto-charge); employee = traveler pays at
   *  booking; net30 = invoiced, traveler never prompted to pay. */
  mode: BillingMode;
  cardBrand?: string;
  cardLast4?: string;
  /** true once an admin has requested Net 30 (routes to the account manager). */
  netRequested?: boolean;
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
  /** who is signed in for the demo */
  activeUserId: string;
}
