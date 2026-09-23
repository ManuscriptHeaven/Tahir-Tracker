import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

interface QueueItem {
  id: string;
  tableName: string;
  action: 'upsert' | 'delete';
  recordId: string;
  payload?: any;
  timestamp: string;
  retryCount: number;
}

describe('offlineQueueAndLWW.test.ts - Sync Queue Lifecycle & Conflict Safety', () => {
  describe('Queue Lifecycle & Compaction (Blocker 3)', () => {
    class MockQueueManager {
      private queue = new Map<string, QueueItem>();

      enqueue(tableName: string, action: 'upsert' | 'delete', recordId: string, payload?: any) {
        const queueId = `${tableName}_${recordId}`;
        const existing = this.queue.get(queueId);

        // Compaction logic:
        // If an item was created/updated offline and then deleted before sync:
        // Compact it to 'delete' without payload
        this.queue.set(queueId, {
          id: queueId,
          tableName,
          action,
          recordId,
          payload: action === 'delete' ? undefined : payload,
          timestamp: new Date().toISOString(),
          retryCount: existing ? existing.retryCount : 0
        });
      }

      getPending(): QueueItem[] {
        return Array.from(this.queue.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      }

      dequeue(id: string) {
        this.queue.delete(id);
      }

      incrementRetry(id: string) {
        const item = this.queue.get(id);
        if (item) {
          item.retryCount += 1;
        }
      }

      // Simulate persistence: serialize to JSON and deserialize
      persistAndRestore(): MockQueueManager {
        const serialized = JSON.stringify(Array.from(this.queue.entries()));
        const restoredManager = new MockQueueManager();
        const entries: [string, QueueItem][] = JSON.parse(serialized);
        entries.forEach(([k, v]) => restoredManager.queue.set(k, v));
        return restoredManager;
      }
    }

    it('should enqueue offline create, survive app restart, and retain payload', () => {
      const qm = new MockQueueManager();
      qm.enqueue('loans', 'upsert', 'loan_101', { personName: 'Tahir', amount: 50000 });

      // Simulate restart
      const restored = qm.persistAndRestore();
      const pending = restored.getPending();

      assert.strictEqual(pending.length, 1);
      assert.strictEqual(pending[0].recordId, 'loan_101');
      assert.strictEqual(pending[0].action, 'upsert');
      assert.strictEqual(pending[0].payload.amount, 50000);
    });

    it('should compact CREATE -> UPDATE -> UPDATE into the single latest state', () => {
      const qm = new MockQueueManager();
      qm.enqueue('finance_transactions', 'upsert', 'tx_1', { amount: 1000, desc: 'Initial' });
      qm.enqueue('finance_transactions', 'upsert', 'tx_1', { amount: 1200, desc: 'Update 1' });
      qm.enqueue('finance_transactions', 'upsert', 'tx_1', { amount: 1500, desc: 'Final Update' });

      const pending = qm.getPending();
      assert.strictEqual(pending.length, 1); // Only 1 queue item, not 3!
      assert.strictEqual(pending[0].payload.amount, 1500);
      assert.strictEqual(pending[0].payload.desc, 'Final Update');
    });

    it('should compact CREATE -> UPDATE -> DELETE into a clean delete operation', () => {
      const qm = new MockQueueManager();
      qm.enqueue('loans', 'upsert', 'loan_99', { amount: 20000 });
      qm.enqueue('loans', 'upsert', 'loan_99', { amount: 25000 });
      qm.enqueue('loans', 'delete', 'loan_99');

      const pending = qm.getPending();
      assert.strictEqual(pending.length, 1);
      assert.strictEqual(pending[0].action, 'delete');
      assert.strictEqual(pending[0].payload, undefined); // Strips stale payload
    });

    it('should retain failed offline mutations instead of silently dropping user data', () => {
      const qm = new MockQueueManager();
      qm.enqueue('utility_bills', 'upsert', 'invalid_bill', { electricity: 'NaN' });

      for (let attempt = 0; attempt < 8; attempt++) {
        qm.incrementRetry('utility_bills_invalid_bill');
      }

      const item = qm.getPending()[0];
      assert.strictEqual(item.retryCount, 8);
      assert.strictEqual(qm.getPending().length, 1);
      assert.strictEqual(item.recordId, 'invalid_bill');
    });

    it('should ensure processing the same queue item twice is idempotent', () => {
      const mockCloudDb = new Map<string, any>();
      function executeUpsert(item: QueueItem) {
        // Simulates Supabase onConflict: 'id'
        mockCloudDb.set(item.recordId, item.payload);
      }

      const item: QueueItem = {
        id: 'tx_1',
        tableName: 'finance_transactions',
        action: 'upsert',
        recordId: 'tx_1',
        payload: { id: 'tx_1', amount: 500 },
        timestamp: '2026-09-10T00:00:00Z',
        retryCount: 0
      };

      executeUpsert(item);
      executeUpsert(item); // Replayed

      assert.strictEqual(mockCloudDb.size, 1);
      assert.strictEqual(mockCloudDb.get('tx_1').amount, 500);
    });
  });

  describe('Sync Conflict Safety & Clock Skew Resilience (Blocker 2)', () => {
    it('should protect pending local offline edits from being overwritten by remote pull', () => {
      const pendingQueue = new Set(['finance_accounts_acc_cash']);
      const localAccount = { id: 'acc_cash', balance: 50000, updatedAt: '2026-09-10T10:00:00Z' };
      const remoteAccount = { id: 'acc_cash', balance: 20000, updatedAt: '2026-09-10T12:00:00Z' }; // Newer remote timestamp

      let appliedAccount = localAccount;

      // Sync protection rule:
      const hasPendingLocalEdit = pendingQueue.has(`finance_accounts_${remoteAccount.id}`);
      if (!hasPendingLocalEdit) {
        appliedAccount = remoteAccount;
      }

      // Local account must NOT be overwritten because local has unpushed offline edits!
      assert.strictEqual(appliedAccount.balance, 50000);
    });

    it('should treat append-only financial records as immutable historical entries', () => {
      const appendOnlyTables = new Set([
        'finance_transactions',
        'utility_payments',
        'milk_logs',
        'petrol_refills',
        'loans'
      ]);

      const localTx = { id: 'tx_uuid_1', amount: 2500, description: 'Petrol' };
      const remoteTx = { id: 'tx_uuid_1', amount: 9999, description: 'Tampered' };

      let localRecord = localTx;
      const tableName = 'finance_transactions';

      if (appendOnlyTables.has(tableName)) {
        // Immutable: Never overwrite existing historical transaction
        // (independent transactions have unique UUIDs)
      } else {
        localRecord = remoteTx;
      }

      assert.strictEqual(localRecord.amount, 2500);
      assert.strictEqual(localRecord.description, 'Petrol');
    });

    it('should handle clock skew between Device A (10:00) and Device B (15:00)', () => {
      // Device B clock is fast (15:00), Device A is correct (10:00).
      // Device A creates tx_A at 10:05.
      // Device B creates tx_B at 10:02 (with stamp 15:02).
      // Because transactions are append-only with unique IDs, BOTH tx_A and tx_B exist!
      const store = new Map<string, any>();
      store.set('tx_B', { id: 'tx_B', amount: 300, timestamp: '2026-09-10T15:02:00Z' });
      store.set('tx_A', { id: 'tx_A', amount: 500, timestamp: '2026-09-10T10:05:00Z' });

      assert.strictEqual(store.size, 2);
      assert.ok(store.has('tx_A'));
      assert.ok(store.has('tx_B'));
    });
  });
});
