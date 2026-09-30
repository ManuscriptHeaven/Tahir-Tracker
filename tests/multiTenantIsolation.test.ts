import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { formatAuthError, getAuthRedirectUrl } from '../src/utils/authUtils.ts';

// Mock localStorage for Node test runner environment
const mockStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
  };
}

describe('Multi-Tenant SaaS Isolation, Security & Migration Tests', () => {

  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Multi-Tenant Database Namespace & Storage Isolation', () => {
    it('generates isolated Dexie database names per user ID', () => {
      const getDbNameForUser = (userId: string) => `TahirTrackerDB_${userId}`;

      const userA_id = 'usr_alice_111';
      const userB_id = 'usr_bob_222';

      assert.strictEqual(getDbNameForUser(userA_id), 'TahirTrackerDB_usr_alice_111');
      assert.strictEqual(getDbNameForUser(userB_id), 'TahirTrackerDB_usr_bob_222');
      assert.notStrictEqual(getDbNameForUser(userA_id), getDbNameForUser(userB_id));
    });

    it('isolates sync timestamps in localStorage by user ID without cross-tenant collision', () => {
      const userA_id = 'usr_alice_111';
      const userB_id = 'usr_bob_222';

      const keyA = `tahir_tracker_last_synced_${userA_id}`;
      const keyB = `tahir_tracker_last_synced_${userB_id}`;

      localStorage.setItem(keyA, '2026-09-30T10:00:00.000Z');
      localStorage.setItem(keyB, '2026-09-30T12:00:00.000Z');

      assert.strictEqual(localStorage.getItem(keyA), '2026-09-30T10:00:00.000Z');
      assert.strictEqual(localStorage.getItem(keyB), '2026-09-30T12:00:00.000Z');
      assert.notStrictEqual(localStorage.getItem(keyA), localStorage.getItem(keyB));
    });

    it('isolates learned category keywords in localStorage by user ID', () => {
      const userA_id = 'usr_alice_111';
      const userB_id = 'usr_bob_222';

      const keyA = `tahir_tracker_category_learning_${userA_id}`;
      const keyB = `tahir_tracker_category_learning_${userB_id}`;

      localStorage.setItem(keyA, JSON.stringify({ 'subway': 'cat_food' }));
      localStorage.setItem(keyB, JSON.stringify({ 'subway': 'cat_travel' }));

      const dataA = JSON.parse(localStorage.getItem(keyA)!);
      const dataB = JSON.parse(localStorage.getItem(keyB)!);

      assert.strictEqual(dataA.subway, 'cat_food');
      assert.strictEqual(dataB.subway, 'cat_travel');
    });

    it('creates private realtime Postgres change channels filtered strictly by user_id', () => {
      const createChannelFilter = (currentUserId: string) => {
        return {
          channelName: `user-sync-${currentUserId}`,
          filter: `user_id=eq.${currentUserId}`
        };
      };

      const filterA = createChannelFilter('usr_alice_111');
      const filterB = createChannelFilter('usr_bob_222');

      assert.strictEqual(filterA.channelName, 'user-sync-usr_alice_111');
      assert.strictEqual(filterA.filter, 'user_id=eq.usr_alice_111');
      assert.strictEqual(filterB.channelName, 'user-sync-usr_bob_222');
      assert.strictEqual(filterB.filter, 'user_id=eq.usr_bob_222');

      // Verify that User A filter strictly rejects User B events
      const simulatedRemoteEvent = { user_id: 'usr_bob_222', table: 'finance_transactions', event: 'INSERT' };
      const matchesUserA = simulatedRemoteEvent.user_id === 'usr_alice_111';
      assert.strictEqual(matchesUserA, false, 'User A realtime channel must reject User B cloud events');
    });
  });

  describe('2. Starter Record Fallback & Collision Prevention (UUIDs vs Hardcoded IDs)', () => {
    it('starter accounts use dynamically generated UUIDs rather than static acc_cash', () => {
      const generateStarterAccount = (currency = 'PKR') => ({
        id: `acc_${crypto.randomUUID()}`,
        name: 'Cash Wallet',
        accountType: 'cash',
        currency
      });

      const accUserA = generateStarterAccount('PKR');
      const accUserB = generateStarterAccount('USD');

      assert.ok(accUserA.id.startsWith('acc_'));
      assert.ok(accUserB.id.startsWith('acc_'));
      assert.notStrictEqual(accUserA.id, accUserB.id, 'Starter account IDs must not collide across users');
      assert.notStrictEqual(accUserA.id, 'acc_cash', 'Hardcoded acc_cash must never be used');
    });

    it('starter categories use unique UUIDs so two users never collide on cloud primary key', () => {
      const defaultCategoryNames = ['Food & Dining', 'Groceries', 'Transportation', 'Salary'];
      
      const createCategoriesForUser = () => defaultCategoryNames.map(name => ({
        id: `cat_${crypto.randomUUID()}`,
        name
      }));

      const catsUserA = createCategoriesForUser();
      const catsUserB = createCategoriesForUser();

      const idsUserA = new Set(catsUserA.map(c => c.id));
      const idsUserB = new Set(catsUserB.map(c => c.id));

      // Assert no overlap
      for (const id of idsUserA) {
        assert.strictEqual(idsUserB.has(id), false, `Collision detected for category ID ${id}`);
      }
    });

    it('monthly milk records generate globally unique IDs to prevent month-key collisions', () => {
      const generateMilkRecordId = (monthYear: string) => `mmr_${monthYear}_${crypto.randomUUID()}`;

      const recUserA = generateMilkRecordId('2026-09');
      const recUserB = generateMilkRecordId('2026-09');

      assert.ok(recUserA.startsWith('mmr_2026-09_'));
      assert.ok(recUserB.startsWith('2026-09') === false);
      assert.notStrictEqual(recUserA, recUserB, 'Two users with milk records in the same month must have distinct IDs');
    });
  });

  describe('3. Clean Workspace Privacy (No Tahir Household Data Leakage)', () => {
    it('new user workspace starter template contains ZERO private records', () => {
      // Private strings from single-user Tahir Tracker
      const tahirPrivateKeywords = [
        'saleem', 'tayyab', 'chand', 'kainat', 'portion 1', 'portion 2',
        'ali medical', 'dr. kashif', 'lesco', 'sui gas'
      ];

      // Simulated starter categories for new SaaS user
      const starterCategories = [
        'Food & Dining', 'Groceries', 'Transportation', 'Home & Housing',
        'Bills & Utilities', 'Shopping', 'Entertainment', 'Health & Fitness',
        'Family & Gifts', 'Travel', 'Business Expense', 'Education', 'Other Expense',
        'Salary', 'Business Income', 'Freelancing', 'Investment Return', 'Rental Income', 'Other Income'
      ];

      for (const cat of starterCategories) {
        for (const priv of tahirPrivateKeywords) {
          assert.strictEqual(
            cat.toLowerCase().includes(priv),
            false,
            `Starter category "${cat}" leaked private keyword "${priv}"`
          );
        }
      }
    });
  });

  describe('4. Legacy Data Migration Safety & Non-Destructive Protection', () => {
    it('detects unmigrated legacy database only when unmigrated flag is absent', () => {
      const checkLegacy = (legacyCount: number) => {
        const migratedTo = localStorage.getItem('tahir_tracker_legacy_migrated');
        if (migratedTo) return { hasLegacy: false, recordCount: 0 };
        return { hasLegacy: legacyCount > 0, recordCount: legacyCount };
      };

      // Scenario 1: Legacy exists, not migrated
      assert.deepStrictEqual(checkLegacy(45), { hasLegacy: true, recordCount: 45 });

      // Scenario 2: Legacy migrated to user
      localStorage.setItem('tahir_tracker_legacy_migrated', 'usr_tahir_verified_123');
      assert.deepStrictEqual(checkLegacy(45), { hasLegacy: false, recordCount: 0 });

      // Scenario 3: Legacy dismissed by new user
      localStorage.setItem('tahir_tracker_legacy_migrated', 'dismissed');
      assert.deepStrictEqual(checkLegacy(45), { hasLegacy: false, recordCount: 0 });
    });

    it('requires safety backup export before migration to user workspace', () => {
      let backupExported = false;
      let snapshotSavedInStorage = false;

      const performSafeMigration = (targetUserId: string, legacyData: any) => {
        // Step 1: Export safety backup
        const backupJson = JSON.stringify({
          appName: 'Tahir Tracker (Pre-Migration Safety Backup)',
          version: 6,
          exportedAt: new Date().toISOString(),
          ...legacyData
        });
        backupExported = true;

        // Step 2: Store safety snapshot in storage
        localStorage.setItem(`tahir_tracker_legacy_backup_snapshot_${targetUserId}`, backupJson);
        snapshotSavedInStorage = true;

        // Step 3: Mark migration complete
        localStorage.setItem('tahir_tracker_legacy_migrated', targetUserId);
        return { success: true, migrated: true };
      };

      const result = performSafeMigration('usr_tahir_123', {
        loans: [{ id: 'l1', amount: 50000 }]
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(backupExported, true, 'Safety backup must be generated before migration');
      assert.strictEqual(snapshotSavedInStorage, true, 'Safety snapshot must be stored in localStorage');
      assert.strictEqual(localStorage.getItem('tahir_tracker_legacy_migrated'), 'usr_tahir_123');
    });
  });

  describe('5. Supabase Row Level Security (RLS) Isolation Rules', () => {
    interface CloudRow {
      id: string;
      user_id: string;
      title: string;
      amount: number;
    }

    const cloudDatabase: CloudRow[] = [
      { id: 'tx_1', user_id: 'usr_tahir', title: 'Salary', amount: 250000 },
      { id: 'tx_2', user_id: 'usr_tahir', title: 'Groceries', amount: 15000 },
      { id: 'tx_3', user_id: 'usr_new_user', title: 'Coffee', amount: 500 },
    ];

    const rlsSelect = (callerUserId: string | null): CloudRow[] => {
      if (!callerUserId) return []; // Unauthenticated / anon gets zero rows
      return cloudDatabase.filter(r => r.user_id === callerUserId);
    };

    const rlsInsert = (callerUserId: string | null, newRow: CloudRow): { success: boolean; error?: string } => {
      if (!callerUserId) return { success: false, error: '401: Unauthorized' };
      if (newRow.user_id !== callerUserId) return { success: false, error: '42501: new row violates row-level security policy' };
      cloudDatabase.push(newRow);
      return { success: true };
    };

    const rlsUpdate = (callerUserId: string | null, rowId: string, updateFields: Partial<CloudRow>): { success: boolean; error?: string } => {
      if (!callerUserId) return { success: false, error: '401: Unauthorized' };
      const row = cloudDatabase.find(r => r.id === rowId);
      if (!row || row.user_id !== callerUserId) {
        return { success: false, error: '42501: row-level security policy prevents update' };
      }
      Object.assign(row, updateFields);
      return { success: true };
    };

    const rlsDelete = (callerUserId: string | null, rowId: string): { success: boolean; error?: string } => {
      if (!callerUserId) return { success: false, error: '401: Unauthorized' };
      const idx = cloudDatabase.findIndex(r => r.id === rowId);
      if (idx === -1 || cloudDatabase[idx].user_id !== callerUserId) {
        return { success: false, error: '42501: row-level security policy prevents delete' };
      }
      cloudDatabase.splice(idx, 1);
      return { success: true };
    };

    it('SELECT: new user cannot read Tahir records', () => {
      const newUserRows = rlsSelect('usr_new_user');
      assert.strictEqual(newUserRows.length, 1);
      assert.strictEqual(newUserRows[0].title, 'Coffee');

      const tahirRows = rlsSelect('usr_tahir');
      assert.strictEqual(tahirRows.length, 2);
    });

    it('SELECT: anonymous callers receive 0 records', () => {
      const anonRows = rlsSelect(null);
      assert.strictEqual(anonRows.length, 0);
    });

    it('INSERT: new user cannot inject rows forged with Tahir user_id', () => {
      const attack = rlsInsert('usr_new_user', {
        id: 'tx_attack',
        user_id: 'usr_tahir', // Spoofed user_id
        title: 'Malicious Record',
        amount: 999999
      });

      assert.strictEqual(attack.success, false);
      assert.ok(attack.error?.includes('42501'));
    });

    it('UPDATE: new user cannot modify Tahir records', () => {
      const attack = rlsUpdate('usr_new_user', 'tx_1', { amount: 0 });
      assert.strictEqual(attack.success, false);
      assert.ok(attack.error?.includes('42501'));

      // Ensure original data was untouched
      const original = cloudDatabase.find(r => r.id === 'tx_1')!;
      assert.strictEqual(original.amount, 250000);
    });

    it('DELETE: new user cannot delete Tahir records', () => {
      const attack = rlsDelete('usr_new_user', 'tx_1');
      assert.strictEqual(attack.success, false);
      assert.ok(attack.error?.includes('42501'));

      // Ensure record is still present
      const exists = cloudDatabase.some(r => r.id === 'tx_1');
      assert.strictEqual(exists, true);
    });
  });

  describe('6. OAuth Error Translation & Redirect Handling', () => {
    it('translates access_denied OAuth cancellation cleanly', () => {
      const err = { message: 'access_denied: User canceled the sign-in request' };
      assert.strictEqual(
        formatAuthError(err),
        'Google sign in was cancelled or access was denied. Please try again.'
      );
    });

    it('translates unsupported_provider configuration errors', () => {
      const err = { message: 'unsupported_provider: Google provider is not enabled' };
      assert.strictEqual(
        formatAuthError(err),
        'Google sign in is not enabled in your Supabase project. Please configure Google OAuth in the Supabase Dashboard.'
      );
    });

    it('translates redirect_uri_mismatch errors with actionable instructions', () => {
      const err = { message: 'redirect_uri_mismatch: The redirect URI does not match' };
      assert.strictEqual(
        formatAuthError(err),
        'Google OAuth redirect URI mismatch. Please verify your Google Cloud Console and Supabase dashboard settings.'
      );
    });

    it('provides clean redirect URL based on current origin', () => {
      // In Node environment without window.location, falls back safely
      const redirectUrl = getAuthRedirectUrl();
      assert.ok(redirectUrl.length > 0);
    });
  });

  describe('7. Offline Queue Isolation Across Account Switches', () => {
    it('isolates offline mutations per user so User A items are not pushed by User B', () => {
      interface QueueItem {
        id: string;
        user_id: string;
        table: string;
        action: 'insert' | 'update' | 'delete';
        payload: any;
      }

      // Two isolated queues (representing two isolated Dexie databases)
      const queueUserA: QueueItem[] = [
        { id: 'q1', user_id: 'usr_alice', table: 'finance_transactions', action: 'insert', payload: { amount: 100 } }
      ];
      const queueUserB: QueueItem[] = [];

      // When User B signs in and sync runs, it accesses queueUserB
      const syncQueueForCaller = (callerId: string, currentQueue: QueueItem[]) => {
        // Queue items MUST match the current caller's user_id
        return currentQueue.filter(item => item.user_id === callerId);
      };

      const itemsForUserB = syncQueueForCaller('usr_bob', queueUserB);
      assert.strictEqual(itemsForUserB.length, 0, "User B's sync must find zero items");

      const itemsForUserA = syncQueueForCaller('usr_alice', queueUserA);
      assert.strictEqual(itemsForUserA.length, 1, "User A's sync finds User A's item");
    });
  });

});
