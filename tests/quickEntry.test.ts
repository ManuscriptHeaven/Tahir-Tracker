import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rankCategoriesByUsage,
  rankAccountsByUsage,
  pickDefaultCategoryId,
  pickDefaultAccountId,
  parseAmountInput
} from '../src/utils/quickEntry.ts';

const cats = [
  { id: 'food', type: 'expense' as const },
  { id: 'fuel', type: 'expense' as const },
  { id: 'bills', type: 'expense' as const },
  { id: 'salary', type: 'income' as const }
];
const tx = (categoryId: string, transactionDate: string, transactionType = 'expense', accountId = 'cash') =>
  ({ categoryId, transactionDate, transactionType, accountId });

test('most used recent categories come first, unused keep their order', () => {
  const ranked = rankCategoriesByUsage(cats, [
    tx('fuel', '2026-11-20'), tx('fuel', '2026-11-21'), tx('bills', '2026-11-01'),
    tx('food', '2025-01-01'), tx('food', '2025-01-02'), tx('food', '2025-01-03') // too old to count
  ], 'expense', '2026-11-27');
  assert.deepEqual(ranked.map(c => c.id), ['fuel', 'bills', 'food']);
});

test('ranking only includes categories of the chosen type', () => {
  const ranked = rankCategoriesByUsage(cats, [tx('salary', '2026-11-01', 'income')], 'income', '2026-11-27');
  assert.deepEqual(ranked.map(c => c.id), ['salary']);
});

test('accounts ranked by recent use', () => {
  const accounts = [{ id: 'cash' }, { id: 'hbl' }];
  const ranked = rankAccountsByUsage(accounts, [tx('food', '2026-11-20', 'expense', 'hbl')], '2026-11-27');
  assert.deepEqual(ranked.map(a => a.id), ['hbl', 'cash']);
});

test('remembered category wins when it still exists, else most used', () => {
  const ranked = [{ id: 'fuel' }, { id: 'food' }];
  assert.equal(pickDefaultCategoryId(ranked, 'expense', { expenseCategoryId: 'food' }), 'food');
  assert.equal(pickDefaultCategoryId(ranked, 'expense', { expenseCategoryId: 'deleted' }), 'fuel');
  assert.equal(pickDefaultCategoryId(ranked, 'income', { expenseCategoryId: 'food' }), 'fuel');
  assert.equal(pickDefaultCategoryId([], 'expense', {}), '');
});

test('remembered account wins when it still exists', () => {
  assert.equal(pickDefaultAccountId([{ id: 'cash' }, { id: 'hbl' }], { accountId: 'hbl' }), 'hbl');
  assert.equal(pickDefaultAccountId([{ id: 'cash' }], { accountId: 'gone' }), 'cash');
});

test('amount input accepts commas and decimals, rejects junk', () => {
  assert.equal(parseAmountInput('1,500'), 1500);
  assert.equal(parseAmountInput(' 2500.50 '), 2500.5);
  assert.equal(parseAmountInput('.5'), 0.5);
  assert.ok(Number.isNaN(parseAmountInput('')));
  assert.ok(Number.isNaN(parseAmountInput('12a')));
  assert.ok(Number.isNaN(parseAmountInput('1.2.3')));
});
