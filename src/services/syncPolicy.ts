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
