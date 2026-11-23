import { db } from '../db/db';
import {
  buildRecurringTransaction,
  computeNextRunDate,
  planRecurringOccurrences,
} from '../utils/financeCalculations';
import { getTodayLocalDateStr } from '../utils/dateTime';

/**
 * Records every due occurrence of recurring rules that have "auto process" on,
 * catching up on any periods missed while the app was closed.
 *
 * Safe to call repeatedly / from several tabs: it runs in a single Dexie
 * transaction and each generated transaction has a deterministic id, so the
 * same occurrence can never be recorded twice.
 *
 * Returns how many transactions were recorded.
 */
export async function processAutoRecurring(today: string = getTodayLocalDateStr()): Promise<number> {
  let recorded = 0;

  await db.transaction(
    'rw',
    [db.finance_recurring_transactions, db.finance_transactions, db.finance_accounts, db.finance_categories],
    async () => {
      const [rules, accounts, categories] = await Promise.all([
        db.finance_recurring_transactions.filter(r => r.isActive && r.autoProcess && r.nextRunDate <= today).toArray(),
        db.finance_accounts.toArray(),
        db.finance_categories.toArray(),
      ]);
      if (rules.length === 0) return;

      const accountsById = new Map(accounts.map(a => [a.id, a] as const));
      const categoriesById = new Map(categories.map(c => [c.id, c] as const));
      const nowIso = new Date().toISOString();

      for (const rule of rules) {
        const dates = planRecurringOccurrences(rule, today);
        if (dates.length === 0) continue;

        for (const date of dates) {
          const record = buildRecurringTransaction(rule, date, accountsById, categoriesById, nowIso);
          if (!(await db.finance_transactions.get(record.id))) {
            await db.finance_transactions.add(record);
            recorded += 1;
          }
        }

        const nextRunDate = computeNextRunDate(dates[dates.length - 1], rule.frequency, rule.startDate);
        const finished = !!rule.endDate && nextRunDate > rule.endDate;
        await db.finance_recurring_transactions.update(rule.id, {
          nextRunDate,
          isActive: finished ? false : rule.isActive,
          updatedAt: nowIso,
        });
      }
    }
  );

  return recorded;
}
