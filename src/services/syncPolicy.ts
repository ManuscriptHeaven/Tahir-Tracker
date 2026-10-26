export const SYNC_TABLE_KEYS = [
  'utility_persons',
  'utility_bills',
  'utility_payments',
  'milk_consumers',
  'milk_logs',
  'milk_monthly_records',
  'petrol_refills',
  'rent_properties',
  'rent_portions',
  'rent_records',
  'loans',
  'settings',
  'finance_accounts',
  'finance_categories',
  'finance_transactions',
  'finance_budgets',
  'finance_recurring_transactions',
  'finance_goals',
  'finance_voice_entries'
] as const;

export type SyncTableName = (typeof SYNC_TABLE_KEYS)[number];


export type SyncModule = 'finance' | 'utility' | 'loans' | 'milk' | 'petrol' | 'rent';
const tableModules: Record<SyncTableName, SyncModule | null> = {
  utility_persons: 'utility', utility_bills: 'utility', utility_payments: 'utility',
  milk_consumers: 'milk', milk_logs: 'milk', milk_monthly_records: 'milk',
  petrol_refills: 'petrol',
  rent_properties: 'rent', rent_portions: 'rent', rent_records: 'rent',
  loans: 'loans', settings: null,
  finance_accounts: 'finance', finance_categories: 'finance',
  finance_transactions: 'finance', finance_budgets: 'finance',
  finance_recurring_transactions: 'finance', finance_goals: 'finance',
  finance_voice_entries: 'finance'
};
let allowedModules: Set<string> | null = null;

export function setSyncAllowedModules(modules: readonly string[] | null): void {
  allowedModules = modules === null ? null : new Set(modules);
}
export function isSyncTableAllowed(tableName: string): boolean {
  const module = tableModules[tableName as SyncTableName];
  return module === null || (module !== undefined && allowedModules !== null && allowedModules.has(module));
}

export function isBootstrapSync(lastSyncedAt: string | null | undefined): boolean {
  return !lastSyncedAt;
}

const RETRY_DELAYS_MS = [
  5_000,
  15_000,
  60_000,
  5 * 60_000,
  30 * 60_000,
  60 * 60_000
] as const;

export function getRetryDelayMs(retryCount: number): number {
  return RETRY_DELAYS_MS[
    Math.min(Math.max(retryCount - 1, 0), RETRY_DELAYS_MS.length - 1)
  ];
}

export function isRetryTimestampReady(
  nextRetryAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!nextRetryAt) return true;
  const next = Date.parse(nextRetryAt);
  return Number.isNaN(next) || next <= nowMs;
}
