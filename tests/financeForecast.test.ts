import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAccountBalances,
  getMonthlyFinanceSummary,
  getCashFlowForecast,
  computeNextRunDate,
  planRecurringOccurrences,
  buildRecurringTransaction,
  getMonthlyTrend,
} from '../src/utils/financeCalculations.ts';

const acc = (id: string, type: string, opening = 0): any => ({ id, name: id, accountType: type, openingBalance: opening, isActive: true, currency: 'PKR' });
const tx = (o: any): any => ({
  id: Math.random().toString(36), transactionType: 'expense', amount: 0, currency: 'PKR', accountId: 'bank',
  transactionDate: '2026-11-10', description: 'x', source: 'manual', status: 'completed', createdAt: '', updatedAt: '', ...o,
});
const rule = (o: any): any => ({
  id: 'r1', title: 'Rent', transactionType: 'expense', amount: 1000, accountId: 'bank', frequency: 'monthly',
  startDate: '2026-11-01', nextRunDate: '2026-11-01', autoProcess: true, isActive: true, createdAt: '', updatedAt: '', ...o,
});

describe('pending transactions', () => {
  it('never change balances, but are reported separately', () => {
    const accounts = [acc('bank', 'bank', 1000)];
    const txs = [
      tx({ transactionType: 'income', amount: 500 }),
      tx({ transactionType: 'income', amount: 9000, status: 'pending' }),
      tx({ transactionType: 'expense', amount: 200, status: 'pending' }),
      tx({ transactionType: 'expense', amount: 300, status: 'cancelled' }),
    ];
    const balances = calculateAccountBalances(accounts, txs);
    assert.strictEqual(balances.get('bank'), 1500);
    const s = getMonthlyFinanceSummary(txs, '2026-11', balances, accounts);
    assert.strictEqual(s.monthlyIncome, 500);
    assert.strictEqual(s.monthlyExpenses, 0);
    assert.strictEqual(s.pendingIncome, 9000);
    assert.strictEqual(s.pendingExpenses, 200);
    assert.strictEqual(s.pendingCount, 2);
    assert.strictEqual(s.projectedLiquidBalance, 1500 + 9000 - 200);
  });

  it('treats a missing status as settled (legacy rows)', () => {
    const accounts = [acc('bank', 'bank', 0)];
    const legacy = tx({ transactionType: 'income', amount: 700 });
    delete legacy.status;
    assert.strictEqual(calculateAccountBalances(accounts, [legacy]).get('bank'), 700);
  });

  it('are excluded from the monthly trend', () => {
    const t = getMonthlyTrend([tx({ transactionType: 'income', amount: 100 }), tx({ transactionType: 'income', amount: 900, status: 'pending' })], '2026-11', 1);
    assert.strictEqual(t[0].income, 100);
  });
});

describe('recurring planner', () => {
  it('keeps the original day of month (31st does not drift to 28th)', () => {
    let d = '2026-01-31';
    const seen: string[] = [d];
    for (let i = 0; i < 3; i++) { d = computeNextRunDate(d, 'monthly', '2026-01-31'); seen.push(d); }
    assert.deepStrictEqual(seen, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('catches up every missed period and honours endDate', () => {
    const r = rule({ nextRunDate: '2026-08-05', startDate: '2026-08-05' });
    assert.deepStrictEqual(planRecurringOccurrences(r, '2026-11-23'), ['2026-08-05', '2026-09-05', '2026-10-05', '2026-11-05']);
    const ended = rule({ nextRunDate: '2026-08-05', startDate: '2026-08-05', endDate: '2026-09-30' });
    assert.deepStrictEqual(planRecurringOccurrences(ended, '2026-11-23'), ['2026-08-05', '2026-09-05']);
  });

  it('caps runaway rules', () => {
    const r = rule({ frequency: 'daily', nextRunDate: '2020-01-01', startDate: '2020-01-01' });
    assert.strictEqual(planRecurringOccurrences(r, '2026-11-23', 60).length, 60);
  });

  it('builds a deterministic transaction id (idempotent recording)', () => {
    const a = buildRecurringTransaction(rule({}), '2026-11-01', new Map([['bank', { name: 'HBL' }]]), new Map(), 'now');
    const b = buildRecurringTransaction(rule({}), '2026-11-01', new Map(), new Map(), 'later');
    assert.strictEqual(a.id, b.id);
    assert.strictEqual(a.accountName, 'HBL');
    assert.strictEqual(a.source, 'recurring');
  });
});

describe('cash-flow forecast', () => {
  const accounts = [acc('bank', 'bank', 5000), acc('card', 'credit_card', 0)];
  const balances = calculateAccountBalances(accounts, []);

  it('applies recurring rules and pending items on their dates and finds the low point', () => {
    const f = getCashFlowForecast({
      accounts, accountBalances: balances, fromDate: '2026-11-23', days: 30,
      recurringRules: [rule({ nextRunDate: '2026-11-25', startDate: '2026-11-25', amount: 4000 })], // rent, then again 2026-12-25
      transactions: [tx({ transactionType: 'income', amount: 2000, status: 'pending', transactionDate: '2026-12-01' })],
    });
    assert.strictEqual(f.startBalance, 5000);
    assert.strictEqual(f.series.find(p => p.date === '2026-11-24')!.balance, 5000);
    assert.strictEqual(f.series.find(p => p.date === '2026-11-25')!.balance, 1000);
    assert.strictEqual(f.lowestBalance, 1000);
    assert.strictEqual(f.lowestDate, '2026-11-25');
    assert.strictEqual(f.series.find(p => p.date === '2026-12-01')!.balance, 3000);
    assert.strictEqual(f.firstNegativeDate, null);
    assert.strictEqual(f.events.length, 2);
  });

  it('flags the first day money runs out; overdue items land on day one', () => {
    const f = getCashFlowForecast({
      accounts, accountBalances: balances, fromDate: '2026-11-23', days: 5,
      recurringRules: [rule({ nextRunDate: '2026-11-01', startDate: '2026-11-01', amount: 6000 })],
      transactions: [],
    });
    assert.strictEqual(f.firstNegativeDate, '2026-11-23');
    assert.strictEqual(f.endBalance, -1000);
  });

  it('ignores credit-card spend and inactive rules, and treats liquid->liquid transfers as neutral', () => {
    const f = getCashFlowForecast({
      accounts: [...accounts, acc('wallet', 'digital_wallet', 0)], accountBalances: new Map([['bank', 5000], ['card', 0], ['wallet', 0]]),
      fromDate: '2026-11-23', days: 5,
      recurringRules: [
        rule({ id: 'a', accountId: 'card', nextRunDate: '2026-11-24', amount: 999 }),
        rule({ id: 'b', isActive: false, nextRunDate: '2026-11-24' }),
        rule({ id: 'c', transactionType: 'transfer', accountId: 'bank', transferToAccountId: 'wallet', nextRunDate: '2026-11-24', amount: 700 }),
      ],
      transactions: [],
    });
    assert.strictEqual(f.endBalance, 5000);
    assert.strictEqual(f.events.length, 0);
  });
});
