import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setSyncAllowedModules, isSyncTableAllowed } from '../src/services/syncPolicy.ts';

test('finance-only accounts sync finance and settings, but not other trackers', () => {
  setSyncAllowedModules(['finance']);
  assert.equal(isSyncTableAllowed('finance_transactions'), true);
  assert.equal(isSyncTableAllowed('settings'), true);
  assert.equal(isSyncTableAllowed('milk_logs'), false);
  assert.equal(isSyncTableAllowed('rent_records'), false);
  setSyncAllowedModules(null);
});
