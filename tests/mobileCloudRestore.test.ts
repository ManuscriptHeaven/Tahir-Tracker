import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateStarterIds } from '../src/services/syncReconcile.ts';

const localAccount = {
  id: 'acc_550e8400-e29b-41d4-a716-446655440000',
  name: 'Cash Wallet', accountType: 'cash', currency: 'PKR',
  notes: 'Primary cash wallet', openingBalance: 0
};
const remoteAccount = { id: 'acc_cash', name: 'Cash Wallet', account_type: 'cash', currency: 'PKR' };
const localCategory = {
  id: 'cat_550e8400-e29b-41d4-a716-446655440001',
  name: 'Groceries', type: 'expense', isDefault: true
};
const remoteCategory = { id: 'cat_groceries', name: 'Groceries', type: 'expense' };

describe('restoring cloud data onto an existing mobile PWA', () => {
  it('removes unused mobile starter duplicates when cloud equivalents exist', () => {
    assert.deepEqual(findDuplicateStarterIds(
      'finance_accounts', [localAccount], [remoteAccount], [], [], []
    ), [localAccount.id]);
    assert.deepEqual(findDuplicateStarterIds(
      'finance_categories', [localCategory], [remoteCategory], [], [], []
    ), [localCategory.id]);
  });

  it('keeps offline records that have transactions or budgets attached', () => {
    assert.deepEqual(findDuplicateStarterIds(
      'finance_accounts', [localAccount], [remoteAccount],
      [{ id: 'tx-local', accountId: localAccount.id }], [], []
    ), []);
    assert.deepEqual(findDuplicateStarterIds(
      'finance_categories', [localCategory], [remoteCategory], [],
      [{ id: 'budget-local', categoryId: localCategory.id }], []
    ), []);
  });

  it('keeps custom accounts and categories and avoids matching a different currency', () => {
    assert.deepEqual(findDuplicateStarterIds(
      'finance_accounts', [{ ...localAccount, notes: 'My main wallet' }],
      [remoteAccount], [], [], []
    ), []);
    assert.deepEqual(findDuplicateStarterIds(
      'finance_accounts', [localAccount],
      [{ ...remoteAccount, currency: 'USD' }], [], [], []
    ), []);
    assert.deepEqual(findDuplicateStarterIds(
      'finance_categories', [{ ...localCategory, isDefault: false }],
      [remoteCategory], [], [], []
    ), []);
  });
});
