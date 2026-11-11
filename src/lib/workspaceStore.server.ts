import 'server-only';

/**
 * Per-company workspace store — the enterprise app's shared, multi-device data
 * layer. Where `tokenStore.server.ts` holds integration tokens, this holds the
 * actual company workspace: users, policies, budgets, bookings, expenses, points,
 * trip plans, policy-change requests, and a settings record (company profile,
 * billing, onboarding, accounting map, history, approval modes, …).
 *
 * Storage is NORMALIZED: one DynamoDB item per entity.
 *   pk = companyId
 *   sk = "<type>#<id>"   e.g. "user#u_123", "booking#bk_9", "settings#root"
 * A Query on pk returns the whole company, so a fresh device loads the live
 * shared workspace instead of per-browser localStorage.
 *
 * When DynamoDB is unconfigured/unreachable (local dev, build, missing IAM) we
 * fall back to an in-process Map so nothing crashes — data just doesn't survive
 * a restart in that mode.
 */

import { WORKSPACE_TABLE, AWS_REGION } from '@/lib/config.server';
import type {
  AppState,
  Booking,
  Budget,
  Expense,
  PointsEntry,
  Policy,
  PolicyChangeRequest,
  TripPlan,
  User,
} from '@/lib/types';

export type Role = 'admin' | 'booker' | 'employee';

export interface WorkspaceData {
  state: AppState;
  role: Role;
}

/** The collection fields stored as one item each, keyed by the entity `id`. */
const COLLECTIONS = [
  'users',
  'budgets',
  'policies',
  'bookings',
  'expenses',
  'points',
  'tripPlans',
  'policyChangeRequests',
] as const;
type CollectionField = (typeof COLLECTIONS)[number];

// sk prefix per collection field.
const SK_PREFIX: Record<CollectionField, string> = {
  users: 'user',
  budgets: 'budget',
  policies: 'policy',
  bookings: 'booking',
  expenses: 'expense',
  points: 'points',
  tripPlans: 'tripplan',
  policyChangeRequests: 'pcr',
};
const PREFIX_TO_FIELD: Record<string, CollectionField> = Object.fromEntries(
  Object.entries(SK_PREFIX).map(([field, prefix]) => [prefix, field as CollectionField])
) as Record<string, CollectionField>;

const SETTINGS_SK = 'settings#root';

/** Everything that isn't one of the normalized collections lives in settings. */
interface SettingsRecord {
  company: AppState['company'];
  billing?: AppState['billing'];
  onboarding?: AppState['onboarding'];
  accountingMap: AppState['accountingMap'];
  history: AppState['history'];
  departmentApprovalModes?: AppState['departmentApprovalModes'];
  guestBookingMode?: AppState['guestBookingMode'];
  integrations: AppState['integrations'];
  activeUserId: string;
  role: Role;
}

/* ------------------------------------------------------------------ */
/* In-process fallback                                                 */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown> & { pk: string; sk: string };
const mem: Map<string, Map<string, Row>> = (() => {
  const g = globalThis as unknown as { __hvEntWorkspace?: Map<string, Map<string, Row>> };
  if (!g.__hvEntWorkspace) g.__hvEntWorkspace = new Map();
  return g.__hvEntWorkspace;
})();
const memCompany = (id: string) => {
  if (!mem.has(id)) mem.set(id, new Map());
  return mem.get(id)!;
};

/* ------------------------------------------------------------------ */
/* DynamoDB document client (lazy)                                     */
/* ------------------------------------------------------------------ */

type DocClient = {
  query: (args: unknown) => Promise<{ Items?: Row[]; LastEvaluatedKey?: unknown }>;
  batchWrite: (args: unknown) => Promise<unknown>;
};

let docClientPromise: Promise<DocClient | null> | null = null;

async function getDocClient(): Promise<DocClient | null> {
  if (!WORKSPACE_TABLE) return null;
  if (docClientPromise) return docClientPromise;
  docClientPromise = (async () => {
    try {
      const [{ DynamoDBClient }, lib] = await Promise.all([
        import('@aws-sdk/client-dynamodb'),
        import('@aws-sdk/lib-dynamodb'),
      ]);
      const base = new DynamoDBClient({ region: AWS_REGION });
      const doc = lib.DynamoDBDocumentClient.from(base, {
        marshallOptions: { removeUndefinedValues: true },
      });
      return {
        query: (args: unknown) =>
          doc.send(new lib.QueryCommand(args as never)) as Promise<{
            Items?: Row[];
            LastEvaluatedKey?: unknown;
          }>,
        batchWrite: (args: unknown) => doc.send(new lib.BatchWriteCommand(args as never)),
      };
    } catch (err) {
      console.warn('[workspace] DynamoDB unavailable, using in-memory store:', (err as Error)?.message);
      return null;
    }
  })();
  return docClientPromise;
}

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

/** Turn a full workspace into the set of rows it should be stored as. */
function toRows(companyId: string, data: WorkspaceData): Row[] {
  const { state, role } = data;
  const rows: Row[] = [];
  const settings: SettingsRecord = {
    company: state.company,
    billing: state.billing,
    onboarding: state.onboarding,
    accountingMap: state.accountingMap,
    history: state.history,
    departmentApprovalModes: state.departmentApprovalModes,
    guestBookingMode: state.guestBookingMode,
    integrations: state.integrations,
    activeUserId: state.activeUserId,
    role,
  };
  rows.push({ pk: companyId, sk: SETTINGS_SK, data: settings } as Row);
  for (const field of COLLECTIONS) {
    const arr = (state[field] as Array<{ id: string }> | undefined) || [];
    for (const item of arr) {
      if (!item || typeof item.id !== 'string') continue;
      rows.push({ pk: companyId, sk: `${SK_PREFIX[field]}#${item.id}`, data: item } as Row);
    }
  }
  return rows;
}

/** Rebuild a workspace from its stored rows. Returns null if there's no data. */
function fromRows(rows: Row[]): WorkspaceData | null {
  const settingsRow = rows.find((r) => r.sk === SETTINGS_SK);
  if (!settingsRow) return null;
  const settings = settingsRow.data as SettingsRecord;

  const collections: Record<CollectionField, unknown[]> = {
    users: [],
    budgets: [],
    policies: [],
    bookings: [],
    expenses: [],
    points: [],
    tripPlans: [],
    policyChangeRequests: [],
  };
  for (const r of rows) {
    if (r.sk === SETTINGS_SK) continue;
    const prefix = String(r.sk).split('#')[0];
    const field = PREFIX_TO_FIELD[prefix];
    if (field) collections[field].push(r.data);
  }

  const state: AppState = {
    company: settings.company,
    users: collections.users as User[],
    budgets: collections.budgets as Budget[],
    policies: collections.policies as Policy[],
    bookings: collections.bookings as Booking[],
    expenses: collections.expenses as Expense[],
    points: collections.points as PointsEntry[],
    integrations: settings.integrations,
    billing: settings.billing,
    onboarding: settings.onboarding,
    accountingMap: settings.accountingMap,
    history: settings.history,
    departmentApprovalModes: settings.departmentApprovalModes,
    guestBookingMode: settings.guestBookingMode,
    policyChangeRequests: collections.policyChangeRequests as PolicyChangeRequest[],
    tripPlans: collections.tripPlans as TripPlan[],
    activeUserId: settings.activeUserId,
  };
  return { state, role: settings.role || 'admin' };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

async function queryAll(companyId: string): Promise<Row[]> {
  const doc = await getDocClient();
  if (!doc) return [...memCompany(companyId).values()];
  const out: Row[] = [];
  let startKey: unknown = undefined;
  do {
    const res = await doc.query({
      TableName: WORKSPACE_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': companyId },
      ExclusiveStartKey: startKey,
    });
    out.push(...(res.Items || []));
    startKey = res.LastEvaluatedKey;
  } while (startKey);
  return out;
}

export async function loadWorkspace(companyId: string): Promise<WorkspaceData | null> {
  if (!companyId) return null;
  try {
    const rows = await queryAll(companyId);
    return fromRows(rows);
  } catch (err) {
    console.error('[workspace] load failed:', (err as Error)?.message);
    return fromRows([...memCompany(companyId).values()]);
  }
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const prefixOf = (sk: string) => String(sk).split('#')[0];

/**
 * Core write: upsert `desired` rows and delete stored rows **only** under the
 * `managedPrefixes` that are no longer present. Rows under any other prefix are
 * left untouched, so independent writers (main workspace, events, CRM) can share
 * the same partition without clobbering each other.
 */
async function writeScoped(
  pk: string,
  desired: Row[],
  managedPrefixes: Set<string>
): Promise<void> {
  const desiredSks = new Set(desired.map((r) => r.sk));

  let existingSks: string[] = [];
  try {
    const existing = await queryAll(pk);
    existingSks = existing.map((r) => String(r.sk));
  } catch {
    existingSks = [...memCompany(pk).keys()];
  }
  const toDelete = existingSks.filter(
    (sk) => managedPrefixes.has(prefixOf(sk)) && !desiredSks.has(sk)
  );

  // In-process mirror: replace only the managed-prefix rows.
  const bucket = memCompany(pk);
  for (const sk of toDelete) bucket.delete(sk);
  for (const r of desired) bucket.set(r.sk, r);

  const doc = await getDocClient();
  if (!doc) return;

  const requests = [
    ...desired.map((Item) => ({ PutRequest: { Item } })),
    ...toDelete.map((sk) => ({ DeleteRequest: { Key: { pk, sk } } })),
  ];
  try {
    for (const group of chunk(requests, 25)) {
      await doc.batchWrite({ RequestItems: { [WORKSPACE_TABLE]: group } });
    }
  } catch (err) {
    console.error('[workspace] save failed:', (err as Error)?.message);
  }
}

/** Append a single row without deleting anything (for append-only logs). */
async function putOne(pk: string, sk: string, data: unknown): Promise<void> {
  memCompany(pk).set(sk, { pk, sk, data } as Row);
  const doc = await getDocClient();
  if (!doc) return;
  try {
    await doc.batchWrite({ RequestItems: { [WORKSPACE_TABLE]: [{ PutRequest: { Item: { pk, sk, data } } }] } });
  } catch (err) {
    console.error('[workspace] putOne failed:', (err as Error)?.message);
  }
}

/* ------------------------------------------------------------------ */
/* Access audit log — every time a rep enters a customer account       */
/* ------------------------------------------------------------------ */

const AUDIT_PK = 'audit';

export interface AccessLogEntry {
  id: string;
  companyId: string;
  companyName: string;
  repName: string;
  reason: string;
  comment?: string;
  /** ISO timestamp. */
  at: string;
}

/** Record one account-access event (append-only, internal). */
export async function appendAccessLog(entry: AccessLogEntry): Promise<void> {
  await putOne(AUDIT_PK, `access#${entry.id}`, entry);
}

/** Read the access log, newest first — all, or just one company's. */
export async function loadAccessLog(companyId?: string): Promise<AccessLogEntry[]> {
  const all = await loadCollection<AccessLogEntry>(AUDIT_PK, 'access');
  const rows = companyId ? all.filter((e) => e.companyId === companyId) : all;
  return rows.sort((a, b) => (a.at < b.at ? 1 : -1));
}

// Prefixes the main workspace owns (everything except events, which are synced
// separately but live in the same company partition).
const MAIN_PREFIXES = new Set<string>([
  'settings',
  ...Object.values(SK_PREFIX),
]);

/**
 * Persist the main company workspace (settings + the normalized collections),
 * leaving event rows (synced separately) untouched.
 */
export async function saveWorkspace(
  companyId: string,
  data: WorkspaceData
): Promise<void> {
  if (!companyId) return;
  await writeScoped(companyId, toRows(companyId, data), MAIN_PREFIXES);
}

/* ------------------------------------------------------------------ */
/* Generic per-prefix collection sync (events, CRM, …)                 */
/* ------------------------------------------------------------------ */

/** Load every item stored under `<prefix>#*` in a partition. */
export async function loadCollection<T = unknown>(
  pk: string,
  prefix: string
): Promise<T[]> {
  if (!pk) return [];
  let rows: Row[];
  try {
    rows = await queryAll(pk);
  } catch {
    rows = [...memCompany(pk).values()];
  }
  return rows.filter((r) => prefixOf(r.sk) === prefix).map((r) => r.data as T);
}

/** Replace the `<prefix>#*` items in a partition (puts + scoped deletes).
 *  `keyOf` extracts each item's id — defaults to `item.id`. */
export async function saveCollection<T>(
  pk: string,
  prefix: string,
  items: T[],
  keyOf: (item: T) => string = (it) => (it as unknown as { id: string }).id
): Promise<void> {
  if (!pk) return;
  const desired: Row[] = items
    .map((it) => ({ item: it, key: keyOf(it) }))
    .filter((x) => typeof x.key === 'string' && x.key.length > 0)
    .map((x) => ({ pk, sk: `${prefix}#${x.key}`, data: x.item }) as Row);
  await writeScoped(pk, desired, new Set([prefix]));
}

/** Read a single settings-style record stored at `<name>#root`. */
export async function loadRecord<T = unknown>(
  pk: string,
  name: string
): Promise<T | null> {
  if (!pk) return null;
  let rows: Row[];
  try {
    rows = await queryAll(pk);
  } catch {
    rows = [...memCompany(pk).values()];
  }
  const row = rows.find((r) => r.sk === `${name}#root`);
  return row ? (row.data as T) : null;
}

/** Write a single settings-style record at `<name>#root`. */
export async function saveRecord(
  pk: string,
  name: string,
  data: unknown
): Promise<void> {
  if (!pk) return;
  await writeScoped(pk, [{ pk, sk: `${name}#root`, data } as Row], new Set([name]));
}
