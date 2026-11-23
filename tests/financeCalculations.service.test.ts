import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMonthlyFinanceSummary,
  getBudgetAdherence,
  getAverageMonthlyExpenses,
  calculateFinancialHealthScore,
} from '../src/utils/financeCalculations.ts';

const tx = (over: any) => ({
  id: Math.random().toString(36),
  transactionType: 'expense',
  amount: 0,
  currency: 'PKR',
  accountId: 'a1',
  transactionDate: '2026-11-10',
  description: '',
  source: 'manual',
  status: 'completed',
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('financeService - accuracy', () => {
  it('sums money without floating-point drift', () => {
    const txs: any[] = [
      tx({ transactionType: 'income', amount: 0.1 }),
      tx({ transactionType: 'income', amount: 0.2 }),
      tx({ transactionType: 'expense', amount: 0.1 }),
    ];
    const s = getMonthlyFinanceSummary(txs, '2026-11', new Map(), []);
    assert.strictEqual(s.monthlyIncome, 0.3);
    assert.strictEqual(s.netSavings, 0.2);
  });

  it('excludes cancelled transactions from budget spend', () => {
    const txs: any[] = [
      tx({ amount: 400, categoryId: 'c1' }),
      tx({ amount: 900, categoryId: 'c1', status: 'cancelled' }),
    ];
    const budgets: any[] = [{ id: 'b', categoryId: 'c1', amount: 1000, period: 'monthly', alertThreshold: 80, isActive: true }];
    const [b] = getBudgetAdherence(budgets, txs, [], '2026-11');
    assert.strictEqual(b.spentAmount, 400);
    assert.strictEqual(b.remainingAmount, 600);
    assert.strictEqual(b.status, 'normal');
  });

  it('averages only prior months that have expenses', () => {
    const txs: any[] = [
      tx({ amount: 30000, transactionDate: '2026-10-05' }),
      tx({ amount: 60000, transactionDate: '2026-09-05' }),
      tx({ amount: 99999, transactionDate: '2026-11-05' }), // selected month: excluded
    ];
    assert.strictEqual(getAverageMonthlyExpenses(txs, '2026-11'), 45000);
    assert.strictEqual(getAverageMonthlyExpenses([], '2026-11'), 0);
  });

  it('emergency buffer uses real burn rate, not a hard-coded default', () => {
    // 90k savings / 30k avg burn = 3 months => 12 pts
    const a = calculateFinancialHealthScore(100000, 30000, 70, [], 90000, 30000);
    assert.strictEqual(a.factors.find(f => f.label === 'Emergency Buffer')!.score, 12);
    // No spending history at all => minimal score and honest message
    const b = calculateFinancialHealthScore(0, 0, 0, [], 500000, 0);
    const f = b.factors.find(x => x.label === 'Emergency Buffer')!;
    assert.strictEqual(f.score, 2);
    assert.match(f.description, /Not enough spending history/);
  });
});

describe('getMonthlyTrend', () => {
  it('returns N months oldest-first, crossing year boundaries, ignoring cancelled', async () => {
    const { getMonthlyTrend } = await import('../src/utils/financeCalculations.ts');
    const txs: any[] = [
      tx({ transactionType: 'income', amount: 1000, transactionDate: '2026-01-15' }),
      tx({ transactionType: 'expense', amount: 400, transactionDate: '2026-01-20' }),
      tx({ transactionType: 'expense', amount: 999, transactionDate: '2026-01-21', status: 'cancelled' }),
      tx({ transactionType: 'expense', amount: 50, transactionDate: '2025-11-02' }),
    ];
    const t = getMonthlyTrend(txs, '2026-01', 3);
    assert.deepStrictEqual(t.map(p => p.monthStr), ['2025-11', '2025-12', '2026-01']);
    assert.strictEqual(t[0].expense, 50);
    assert.strictEqual(t[1].income + t[1].expense, 0);
    assert.deepStrictEqual([t[2].income, t[2].expense, t[2].savings], [1000, 400, 600]);
  });
});
