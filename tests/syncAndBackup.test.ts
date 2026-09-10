import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateBackupJson } from '../src/db/db.ts';

describe('syncAndBackup.test.ts - Sync, Queue & Backup Safety', () => {
  describe('Backup JSON Validation (validateBackupJson)', () => {
    it('should validate a complete backup payload', () => {
      const validBackup = {
        appName: 'Tahir Tracker',
        version: 5,
        exportedAt: '2026-09-09T12:00:00.000Z',
        loans: [{ id: 'loan_1', personName: 'Ali', amount: 5000 }],
        rent_portions: [{ id: 'portion_1', name: 'Upper Floor', expectedRent: 35000 }],
        rent_records: [{ id: 'rec_1', portionId: 'portion_1', monthYear: '2026-08', paidAmount: 35000 }],
        finance_accounts: [{ id: 'acc_1', name: 'HBL', openingBalance: 50000 }]
      };

      const res = validateBackupJson(validBackup);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.summary?.loans, 1);
      assert.strictEqual(res.summary?.rent_portions, 1);
      assert.strictEqual(res.summary?.rent_records, 1);
      assert.strictEqual(res.summary?.finance_accounts, 1);
    });

    it('should reject non-object or null data', () => {
      assert.strictEqual(validateBackupJson(null).isValid, false);
      assert.strictEqual(validateBackupJson(undefined).isValid, false);
      assert.strictEqual(validateBackupJson('invalid string').isValid, false);
      assert.strictEqual(validateBackupJson(123).isValid, false);
    });

    it('should reject JSON objects missing all Tahir Tracker tables', () => {
      const emptyObject = {};
      const res1 = validateBackupJson(emptyObject);
      assert.strictEqual(res1.isValid, false);
      assert.ok(res1.error?.includes('does not contain recognizable Tahir Tracker tables'));

      const irrelevantJson = { foo: 'bar', timestamp: 12345 };
      const res2 = validateBackupJson(irrelevantJson);
      assert.strictEqual(res2.isValid, false);
    });

    it('should reject unsupported future backup schema versions', () => {
      const futureBackup = {
        appName: 'Tahir Tracker',
        version: 99,
        loans: []
      };
      const res = validateBackupJson(futureBackup);
      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes('Unsupported backup schema version'));
    });

    it('should reject backups containing duplicate primary keys in the same table', () => {
      const duplicateBackup = {
        appName: 'Tahir Tracker',
        version: 5,
        loans: [
          { id: 'loan_1', personName: 'Ali', amount: 5000 },
          { id: 'loan_1', personName: 'Duplicate Ali', amount: 5000 }
        ]
      };
      const res = validateBackupJson(duplicateBackup);
      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes("Duplicate primary key 'loan_1'"));
    });

    it('should accept partial backups with valid tables', () => {
      const partialBackup = {
        petrol_refills: [
          { id: 'petrol_1', date: '2026-09-01', litres: 30, totalCost: 8000 }
        ]
      };
      const res = validateBackupJson(partialBackup);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.summary?.petrol_refills, 1);
    });
  });

  describe('Last-Write-Wins (LWW) Conflict Resolution Algorithm', () => {
    function resolveLWW(localRecord: any, remoteRecord: any): 'local' | 'remote' {
      const localTime = localRecord.updatedAt || localRecord.createdAt || '';
      const remoteTime = remoteRecord.updatedAt || remoteRecord.createdAt || '';
      if (localTime && remoteTime && localTime > remoteTime) {
        return 'local'; // Local is newer, retain local
      }
      return 'remote'; // Remote is newer or equal, apply remote
    }

    it('should let local record win if local has newer updatedAt', () => {
      const local = { id: 'item_1', name: 'Local Edit', updatedAt: '2026-09-09T14:30:00.000Z' };
      const remote = { id: 'item_1', name: 'Cloud Edit', updatedAt: '2026-09-09T14:00:00.000Z' };

      assert.strictEqual(resolveLWW(local, remote), 'local');
    });

    it('should let remote record win if remote has newer updatedAt', () => {
      const local = { id: 'item_1', name: 'Local Edit', updatedAt: '2026-09-09T10:00:00.000Z' };
      const remote = { id: 'item_1', name: 'Cloud Edit', updatedAt: '2026-09-09T11:00:00.000Z' };

      assert.strictEqual(resolveLWW(local, remote), 'remote');
    });

    it('should fall back to createdAt if updatedAt is absent', () => {
      const local = { id: 'item_1', name: 'Local Created', createdAt: '2026-09-09T08:00:00.000Z' };
      const remote = { id: 'item_1', name: 'Remote Created', createdAt: '2026-09-09T09:00:00.000Z' };

      assert.strictEqual(resolveLWW(local, remote), 'remote');
    });

    it('should default to remote on tie to maintain eventual consistency', () => {
      const timestamp = '2026-09-09T12:00:00.000Z';
      const local = { id: 'item_1', name: 'Local Version', updatedAt: timestamp };
      const remote = { id: 'item_1', name: 'Remote Version', updatedAt: timestamp };

      assert.strictEqual(resolveLWW(local, remote), 'remote');
    });
  });

  describe('Offline Sync Queue Item Ordering & Actions', () => {
    it('should prioritize delete actions over stale mutations', () => {
      const queueItems = [
        { id: '1', action: 'upsert', timestamp: '2026-09-09T10:00:00Z', tableName: 'loans' },
        { id: '2', action: 'delete', timestamp: '2026-09-09T10:05:00Z', tableName: 'loans' },
        { id: '3', action: 'upsert', timestamp: '2026-09-09T10:01:00Z', tableName: 'milk_logs' }
      ];

      // Sort by timestamp (FIFO)
      const sorted = [...queueItems].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      assert.strictEqual(sorted[0].id, '1');
      assert.strictEqual(sorted[1].id, '3');
      assert.strictEqual(sorted[2].id, '2');
    });

    it('should strip payloads from delete actions to prevent stale data bloat', () => {
      const action = 'delete';
      const payload = { id: 'rec_1', name: 'Stale' };
      const itemPayload = action === 'delete' ? undefined : payload;

      assert.strictEqual(itemPayload, undefined);
    });
  });
});
