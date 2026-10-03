import type {
  AppState,
  Booking,
  Expense,
  InventoryOption,
  PointsEntry,
} from './types';
import { addDays, todayISO } from './format';

const T = todayISO();

const company = {
  id: 'co_northwind',
  name: 'Northwind Robotics',
  currency: 'USD',
  domain: 'northwind.co',
};

const users = [
  {
    id: 'u_admin',
    name: 'Danil Admin',
    email: 'admin@northwind.co',
    role: 'admin' as const,
    department: 'Operations',
    title: 'Travel Program Owner',
    status: 'active' as const,
    loyalty: [],
    personalLinked: true,
  },
  {
    id: 'u_dana',
    name: 'Dana Ruiz',
    email: 'dana@northwind.co',
    role: 'booker' as const,
    department: 'Sales',
    title: 'Executive Assistant',
    status: 'active' as const,
    loyalty: [{ program: 'United MileagePlus', number: 'UA38104922' }],
    personalLinked: true,
  },
  {
    id: 'u_marcus',
    name: 'Marcus Bell',
    email: 'marcus@northwind.co',
    role: 'employee' as const,
    department: 'Sales',
    title: 'Account Executive',
    status: 'active' as const,
    loyalty: [{ program: 'Marriott Bonvoy', number: 'MB-882190' }],
    personalLinked: true,
  },
  {
    id: 'u_priya',
    name: 'Priya Shah',
    email: 'priya@northwind.co',
    role: 'employee' as const,
    department: 'Engineering',
    title: 'Staff Engineer',
    status: 'active' as const,
    loyalty: [],
    personalLinked: false,
  },
  {
    id: 'u_leo',
    name: 'Leo Fontaine',
    email: 'leo@northwind.co',
    role: 'employee' as const,
    department: 'Engineering',
    title: 'Product Designer',
    status: 'active' as const,
    loyalty: [],
    personalLinked: true,
  },
  {
    id: 'u_sam',
    name: 'Sam Carter',
    email: 'sam@northwind.co',
    role: 'employee' as const,
    department: 'Marketing',
    title: 'Events Lead',
    status: 'invited' as const,
    loyalty: [],
    personalLinked: false,
  },
];

const budgets = [
  { id: 'b_co', scope: 'company' as const, refId: null, label: 'Company — annual T&E', limit: 400000, period: 'year' as const },
  { id: 'b_sales', scope: 'department' as const, refId: 'Sales', label: 'Sales', limit: 160000, period: 'year' as const },
  { id: 'b_eng', scope: 'department' as const, refId: 'Engineering', label: 'Engineering', limit: 90000, period: 'year' as const },
  { id: 'b_mkt', scope: 'department' as const, refId: 'Marketing', label: 'Marketing', limit: 60000, period: 'year' as const },
  { id: 'b_marcus', scope: 'employee' as const, refId: 'u_marcus', label: 'Marcus Bell', limit: 24000, period: 'year' as const },
  { id: 'b_priya', scope: 'employee' as const, refId: 'u_priya', label: 'Priya Shah', limit: 12000, period: 'year' as const },
  { id: 'b_leo', scope: 'employee' as const, refId: 'u_leo', label: 'Leo Fontaine', limit: 12000, period: 'year' as const },
];

const policies = [
  { id: 'p_star', name: 'Hotels up to 4 stars', type: 'max_hotel_star' as const, value: 4, action: 'warn' as const, enabled: true },
  { id: 'p_nightly', name: 'Nightly rate cap $350', type: 'max_nightly' as const, value: 350, action: 'approve' as const, enabled: true },
  { id: 'p_cabin', name: 'Economy by default', type: 'max_cabin' as const, value: 'Economy', action: 'approve' as const, enabled: true },
  { id: 'p_advance', name: 'Book 7+ days ahead', type: 'advance_days' as const, value: 7, action: 'warn' as const, enabled: true },
];

const bookings: Booking[] = [
  {
    id: 'bk_1', type: 'flight', title: 'SFO → JFK', detail: 'United · Economy · round trip',
    travelerId: 'u_marcus', bookedById: 'u_dana', department: 'Sales',
    startDate: addDays(T, -18), endDate: addDays(T, -15),
    marketPrice: 842, price: 611, savings: 231, pointsEarned: 462,
    status: 'confirmed', createdAt: addDays(T, -26),
  },
  {
    id: 'bk_2', type: 'hotel', title: 'The Standard, New York', detail: '3 nights · King · refundable',
    travelerId: 'u_marcus', bookedById: 'u_dana', department: 'Sales',
    startDate: addDays(T, -18), endDate: addDays(T, -15),
    marketPrice: 1290, price: 1044, savings: 246, pointsEarned: 246,
    status: 'confirmed', createdAt: addDays(T, -26),
  },
  {
    id: 'bk_3', type: 'flight', title: 'SEA → AUS', detail: 'Alaska · Economy · round trip',
    travelerId: 'u_priya', bookedById: 'u_priya', department: 'Engineering',
    startDate: addDays(T, 9), endDate: addDays(T, 12),
    marketPrice: 498, price: 404, savings: 94, pointsEarned: 188,
    status: 'confirmed', createdAt: addDays(T, -4),
  },
  {
    id: 'bk_4', type: 'hotel', title: 'Hotel Van Zandt, Austin', detail: '3 nights · Queen · breakfast',
    travelerId: 'u_priya', bookedById: 'u_priya', department: 'Engineering',
    startDate: addDays(T, 9), endDate: addDays(T, 12),
    marketPrice: 960, price: 828, savings: 132, pointsEarned: 132,
    status: 'pending_approval', createdAt: addDays(T, -4),
  },
  {
    id: 'bk_5', type: 'flight', title: 'JFK → LHR', detail: 'Delta · Economy · round trip',
    travelerId: 'u_leo', bookedById: 'u_leo', department: 'Engineering',
    startDate: addDays(T, 24), endDate: addDays(T, 30),
    marketPrice: 1180, price: 905, savings: 275, pointsEarned: 550,
    status: 'confirmed', createdAt: addDays(T, -2),
  },
];

const expenses: Expense[] = [
  { id: 'ex_1', userId: 'u_marcus', merchant: 'Blue Bottle Coffee', category: 'Meals', amount: 34.5, date: addDays(T, -16), status: 'approved', hasReceipt: true, tripId: 'bk_1' },
  { id: 'ex_2', userId: 'u_marcus', merchant: 'Uber', category: 'Ground transport', amount: 52.1, date: addDays(T, -16), status: 'approved', hasReceipt: true, tripId: 'bk_1' },
  { id: 'ex_3', userId: 'u_marcus', merchant: 'Carbone', category: 'Meals', amount: 188.0, date: addDays(T, -15), status: 'submitted', hasReceipt: true, tripId: 'bk_1', note: 'Client dinner — Acme' },
  { id: 'ex_4', userId: 'u_priya', merchant: 'Amazon', category: 'Supplies', amount: 76.2, date: addDays(T, -3), status: 'submitted', hasReceipt: false },
  { id: 'ex_5', userId: 'u_leo', merchant: 'Lyft', category: 'Ground transport', amount: 29.4, date: addDays(T, -1), status: 'submitted', hasReceipt: true },
];

const points: PointsEntry[] = [
  { id: 'pt_1', userId: 'u_marcus', delta: 462, reason: 'Flight savings · SFO → JFK', bucket: 'self', bookingId: 'bk_1', createdAt: addDays(T, -26) },
  { id: 'pt_2', userId: 'u_marcus', delta: 246, reason: 'Hotel savings · The Standard', bucket: 'self', bookingId: 'bk_2', createdAt: addDays(T, -26) },
  { id: 'pt_3', userId: 'u_dana', delta: 708, reason: 'Booker reward · Marcus NYC trip', bucket: 'booker', createdAt: addDays(T, -26) },
  { id: 'pt_4', userId: 'u_priya', delta: 188, reason: 'Flight savings · SEA → AUS', bucket: 'self', bookingId: 'bk_3', createdAt: addDays(T, -4) },
  { id: 'pt_5', userId: 'u_leo', delta: 550, reason: 'Flight savings · JFK → LHR', bucket: 'self', bookingId: 'bk_5', createdAt: addDays(T, -2) },
];

export const SEED: AppState = {
  company,
  users,
  budgets,
  policies,
  bookings,
  expenses,
  points,
  activeUserId: 'u_admin',
};

/** Sample search results for the booking flow (mock inventory). */
export function inventoryFor(
  type: 'hotel' | 'flight',
  destination: string
): InventoryOption[] {
  const d = destination.trim() || 'New York';
  if (type === 'flight') {
    return [
      { id: 'inv_f1', type: 'flight', title: `Nonstop to ${d}`, detail: 'United · Economy · 1 stop savings fare', carrier: 'United', cabin: 'Economy', marketPrice: 612, price: 468 },
      { id: 'inv_f2', type: 'flight', title: `Nonstop to ${d}`, detail: 'Delta · Economy · refundable', carrier: 'Delta', cabin: 'Economy', marketPrice: 689, price: 556 },
      { id: 'inv_f3', type: 'flight', title: `1 stop to ${d}`, detail: 'Alaska · Economy · lowest fare', carrier: 'Alaska', cabin: 'Economy', marketPrice: 451, price: 362 },
    ];
  }
  return [
    { id: 'inv_h1', type: 'hotel', title: `The Standard, ${d}`, detail: '3 nights · King · refundable', star: 4, marketPrice: 1290, price: 1044 },
    { id: 'inv_h2', type: 'hotel', title: `Kimpton, ${d}`, detail: '3 nights · Queen · breakfast', star: 4, marketPrice: 1110, price: 912 },
    { id: 'inv_h3', type: 'hotel', title: `Pod Hotel, ${d}`, detail: '3 nights · Double · value rate', star: 3, marketPrice: 690, price: 561 },
  ];
}
