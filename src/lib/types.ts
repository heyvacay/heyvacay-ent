/**
 * HeyVacay Enterprise domain model.
 *
 * These types are the contract the UI is built against. Today they're served by
 * the in-browser demo store (src/lib/store.tsx); when staging is stood up the
 * same shapes come from the enterprise backend API with no UI changes.
 */

export type Role = 'admin' | 'booker' | 'employee';

export interface Company {
  id: string;
  name: string;
  currency: string; // ISO 4217, e.g. "USD"
  domain: string;
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
  | 'advance_days';

export type PolicyAction = 'allow' | 'warn' | 'approve' | 'block';

export interface Policy {
  id: string;
  name: string;
  type: PolicyType;
  value: number | string;
  action: PolicyAction;
  enabled: boolean;
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
  tripId?: string;
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

/** A bookable option returned by the (mock) search. */
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
}

export interface AppState {
  company: Company;
  users: User[];
  budgets: Budget[];
  policies: Policy[];
  bookings: Booking[];
  expenses: Expense[];
  points: PointsEntry[];
  /** who is signed in for the demo */
  activeUserId: string;
}
