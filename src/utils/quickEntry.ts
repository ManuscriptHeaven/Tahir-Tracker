/**
 * Helpers for the quick "Add Transaction" form: put the categories and
 * accounts the user actually uses first, and remember the last choices so a
 * new entry usually needs only an amount and a tap on Save.
 */

export interface QuickEntryCategory {
  id: string;
  type: 'expense' | 'income';
}

export interface QuickEntryTransaction {
  transactionType: string;
  categoryId?: string;
  accountId?: string;
  transactionDate: string; // YYYY-MM-DD
}

export type QuickEntryType = 'expense' | 'income' | 'transfer';

export interface QuickEntryPrefs {
  expenseCategoryId?: string;
  incomeCategoryId?: string;
  accountId?: string;
}

const USAGE_WINDOW_DAYS = 120;

function isRecent(dateStr: string, today: string, windowDays: number): boolean {
  const date = Date.parse(`${dateStr}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(date) || Number.isNaN(now)) return false;
  return now - date <= windowDays * 86_400_000;
}

/**
 * Categories of the given type, most used in the last few months first.
 * Categories with equal use keep their original order.
 */
export function rankCategoriesByUsage<C extends QuickEntryCategory>(
  categories: C[],
  transactions: QuickEntryTransaction[],
  type: 'expense' | 'income',
  today: string
): C[] {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.transactionType !== type || !tx.categoryId) continue;
    if (!isRecent(tx.transactionDate, today, USAGE_WINDOW_DAYS)) continue;
    counts.set(tx.categoryId, (counts.get(tx.categoryId) || 0) + 1);
  }
  return categories
    .map((category, index) => ({ category, index }))
    .filter(({ category }) => category.type === type)
    .sort((a, b) => (counts.get(b.category.id) || 0) - (counts.get(a.category.id) || 0) || a.index - b.index)
    .map(({ category }) => category);
}

/** Accounts, most used in the last few months first. */
export function rankAccountsByUsage<A extends { id: string }>(
  accounts: A[],
  transactions: QuickEntryTransaction[],
  today: string
): A[] {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.accountId || !isRecent(tx.transactionDate, today, USAGE_WINDOW_DAYS)) continue;
    counts.set(tx.accountId, (counts.get(tx.accountId) || 0) + 1);
  }
  return accounts
    .map((account, index) => ({ account, index }))
    .sort((a, b) => (counts.get(b.account.id) || 0) - (counts.get(a.account.id) || 0) || a.index - b.index)
    .map(({ account }) => account);
}

/**
 * Picks the starting category: the last one used for this type if it still
 * exists, otherwise the most used one.
 */
export function pickDefaultCategoryId(
  rankedCategories: { id: string }[],
  type: 'expense' | 'income',
  prefs: QuickEntryPrefs
): string {
  const remembered = type === 'income' ? prefs.incomeCategoryId : prefs.expenseCategoryId;
  if (remembered && rankedCategories.some(c => c.id === remembered)) return remembered;
  return rankedCategories[0]?.id || '';
}

/** Picks the starting account: the last one used if it still exists, otherwise the most used one. */
export function pickDefaultAccountId(rankedAccounts: { id: string }[], prefs: QuickEntryPrefs): string {
  if (prefs.accountId && rankedAccounts.some(a => a.id === prefs.accountId)) return prefs.accountId;
  return rankedAccounts[0]?.id || '';
}

/** Reads a typed amount such as "1,500" or "2500.50". Returns NaN when it is not a number. */
export function parseAmountInput(raw: string): number {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return NaN;
  return parseFloat(cleaned);
}

function prefsKey(userId: string | null): string {
  return userId ? `tahir_tracker_quick_entry_${userId}` : 'tahir_tracker_quick_entry';
}

export function loadQuickEntryPrefs(userId: string | null): QuickEntryPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(prefsKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveQuickEntryPrefs(userId: string | null, update: QuickEntryPrefs): void {
  try {
    const next = { ...loadQuickEntryPrefs(userId), ...update };
    globalThis.localStorage?.setItem(prefsKey(userId), JSON.stringify(next));
  } catch {
    // Remembering choices is a convenience; never block saving a transaction.
  }
}
