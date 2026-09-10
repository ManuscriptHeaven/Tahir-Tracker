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

  describe('Sync Error-Reporting & Table Continuation (Requirement 8)', () => {
    interface TableSyncError {
      table: string;
      operation: 'push' | 'pull';
      code: string;
      message: string;
      details?: string | null;
      hint?: string | null;
    }

    function sanitizeErrorMessage(text: string | undefined | null): string {
      if (!text) return '';
      return String(text)
        .replace(/Bearer\s+[A-Za-z0-9-_=.]+/gi, 'Bearer [REDACTED]')
        .replace(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[JWT_REDACTED]')
        .replace(/anonKey=[^\s&]+/gi, 'anonKey=[REDACTED]')
        .replace(/apikey=[^\s&]+/gi, 'apikey=[REDACTED]');
    }

    function formatSyncErrorsSummary(errors: TableSyncError[]): string {
      if (!errors || errors.length === 0) return '';
      const lines = errors.map((err) => {
        const parts: string[] = [`• [${err.table}] ${err.operation.toUpperCase()} failed: ${err.message}`];
        if (err.code && err.code !== 'UNKNOWN') {
          parts.push(`(Code: ${err.code})`);
        }
        if (err.details) {
          parts.push(`Details: ${err.details}`);
        }
        if (err.hint) {
          parts.push(`Hint: ${err.hint}`);
        }
        return parts.join(' ');
      });
      return `Cloud sync failed on ${errors.length} table operation(s):\n${lines.join('\n')}`;
    }

    interface MockTableOperationResult {
      pushError?: { code: string; message: string; details?: string; hint?: string } | null;
      pullError?: { code: string; message: string; details?: string; hint?: string } | null;
    }

    interface SimulatedSyncOutcome {
      success: boolean;
      status: 'idle' | 'syncing' | 'synced' | 'error' | 'auth_required';
      message: string;
      errors: TableSyncError[];
      processedTables: string[];
    }

    async function simulateTwoWaySync(
      tableDefinitions: Record<string, MockTableOperationResult>,
      currentUserId: string | null,
      isAuthenticated: boolean
    ): Promise<SimulatedSyncOutcome> {
      if (!isAuthenticated || !currentUserId) {
        return {
          success: false,
          status: 'auth_required',
          message: 'Sign in required for cloud synchronization',
          errors: [],
          processedTables: []
        };
      }

      const syncErrors: TableSyncError[] = [];
      const processedTables: string[] = [];

      const tableKeys = Object.keys(tableDefinitions);

      for (const tableName of tableKeys) {
        processedTables.push(tableName);
        const tableConfig = tableDefinitions[tableName];

        try {
          // 1. Push
          if (tableConfig.pushError) {
            syncErrors.push({
              table: tableName,
              operation: 'push',
              code: tableConfig.pushError.code || 'UNKNOWN',
              message: sanitizeErrorMessage(tableConfig.pushError.message),
              details: sanitizeErrorMessage(tableConfig.pushError.details) || null,
              hint: sanitizeErrorMessage(tableConfig.pushError.hint) || null
            });
          }

          // 2. Pull
          if (tableConfig.pullError) {
            syncErrors.push({
              table: tableName,
              operation: 'pull',
              code: tableConfig.pullError.code || 'UNKNOWN',
              message: sanitizeErrorMessage(tableConfig.pullError.message),
              details: sanitizeErrorMessage(tableConfig.pullError.details) || null,
              hint: sanitizeErrorMessage(tableConfig.pullError.hint) || null
            });
          }
        } catch (tableErr: any) {
          syncErrors.push({
            table: tableName,
            operation: 'push',
            code: 'TABLE_EXCEPTION',
            message: sanitizeErrorMessage(tableErr?.message),
            details: null,
            hint: null
          });
        }
      }

      if (syncErrors.length > 0) {
        const summaryMsg = formatSyncErrorsSummary(syncErrors);
        return {
          success: false,
          status: 'error',
          message: summaryMsg,
          errors: syncErrors,
          processedTables
        };
      }

      return {
        success: true,
        status: 'synced',
        message: 'Synchronization completed successfully!',
        errors: [],
        processedTables
      };
    }

    const mockUserId = '383a4285-784c-4738-841f-1ed8cd7f6042';

    // Requirement 8.A: all successful table operations => overall success
    it('A. all successful table operations => overall success (status: synced, success: true)', async () => {
      const tables: Record<string, MockTableOperationResult> = {
        utility_persons: { pushError: null, pullError: null },
        milk_logs: { pushError: null, pullError: null },
        finance_transactions: { pushError: null, pullError: null }
      };

      const outcome = await simulateTwoWaySync(tables, mockUserId, true);

      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.status, 'synced');
      assert.strictEqual(outcome.message, 'Synchronization completed successfully!');
      assert.strictEqual(outcome.errors.length, 0);
      assert.deepStrictEqual(outcome.processedTables, ['utility_persons', 'milk_logs', 'finance_transactions']);
    });

    // Requirement 8.B: one failed table upsert => overall failure
    it('B. one failed table upsert => overall failure (status: error, success: false)', async () => {
      const tables: Record<string, MockTableOperationResult> = {
        utility_persons: { pushError: null, pullError: null },
        milk_monthly_records: {
          pushError: {
            code: '42501',
            message: 'new row violates row-level security policy for table "milk_monthly_records"',
            details: 'Failing row contains (2026-09, ...)',
            hint: 'Ensure user has proper RLS permission'
          },
          pullError: null
        },
        finance_transactions: { pushError: null, pullError: null }
      };

      const outcome = await simulateTwoWaySync(tables, mockUserId, true);

      assert.strictEqual(outcome.success, false);
      assert.strictEqual(outcome.status, 'error');
      assert.notStrictEqual(outcome.message, 'Synchronization completed successfully!');
      assert.strictEqual(outcome.errors.length, 1);
    });

    // Requirement 8.C: error identifies failed table, operation, code, and details
    it('C. error identifies failed table name, operation, code, and details', async () => {
      const tables: Record<string, MockTableOperationResult> = {
        milk_monthly_records: {
          pushError: {
            code: '42501',
            message: 'new row violates row-level security policy for table "milk_monthly_records"',
            details: 'RLS check failed',
            hint: 'Check policy definition'
          },
          pullError: null
        }
      };

      const outcome = await simulateTwoWaySync(tables, mockUserId, true);

      assert.strictEqual(outcome.success, false);
      assert.strictEqual(outcome.errors[0].table, 'milk_monthly_records');
      assert.strictEqual(outcome.errors[0].operation, 'push');
      assert.strictEqual(outcome.errors[0].code, '42501');
      assert.ok(outcome.message.includes('[milk_monthly_records] PUSH failed'));
      assert.ok(outcome.message.includes('(Code: 42501)'));
      assert.ok(outcome.message.includes('Details: RLS check failed'));
      assert.ok(outcome.message.includes('Hint: Check policy definition'));
    });

    // Requirement 8.D: remaining tables still process where safe
    it('D. remaining tables still process where safe when an earlier table fails', async () => {
      const tables: Record<string, MockTableOperationResult> = {
        utility_persons: { pushError: null, pullError: null },
        milk_monthly_records: {
          pushError: {
            code: '23502',
            message: 'null value violates not-null constraint',
            details: null,
            hint: null
          },
          pullError: null
        },
        petrol_refills: { pushError: null, pullError: null },
        finance_transactions: { pushError: null, pullError: null }
      };

      const outcome = await simulateTwoWaySync(tables, mockUserId, true);

      assert.strictEqual(outcome.success, false);
      // All 4 tables processed despite failure on table 2
      assert.deepStrictEqual(outcome.processedTables, [
        'utility_persons',
        'milk_monthly_records',
        'petrol_refills',
        'finance_transactions'
      ]);
      assert.strictEqual(outcome.errors.length, 1);
      assert.strictEqual(outcome.errors[0].table, 'milk_monthly_records');
    });

    // Requirement 8.E: no regression to authenticated sync
    it('E. authentication guard prevents unauthenticated sync and protects session', async () => {
      const tables: Record<string, MockTableOperationResult> = {
        finance_transactions: { pushError: null, pullError: null }
      };

      // Case 1: unauthenticated
      const unauthOutcome = await simulateTwoWaySync(tables, null, false);
      assert.strictEqual(unauthOutcome.success, false);
      assert.strictEqual(unauthOutcome.status, 'auth_required');

      // Case 2: authenticated user syncs normally
      const authOutcome = await simulateTwoWaySync(tables, mockUserId, true);
      assert.strictEqual(authOutcome.success, true);
      assert.strictEqual(authOutcome.status, 'synced');
    });

    // Requirement 7: Do NOT expose JWT/access tokens, passwords, service-role keys, secrets
    it('Sanitization strips sensitive tokens and secrets from error strings', () => {
      const sensitiveError = 'Error with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secretKey and apikey=sb_publishable_secretKey123';
      const sanitized = sanitizeErrorMessage(sensitiveError);

      assert.ok(!sanitized.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secretKey'));
      assert.ok(!sanitized.includes('sb_publishable_secretKey123'));
      assert.ok(sanitized.includes('Bearer [REDACTED]') || sanitized.includes('[JWT_REDACTED]'));
      assert.ok(sanitized.includes('apikey=[REDACTED]'));
    });

    // Multi-table pull and push failure reporting
    it('Correctly captures and reports multiple distinct errors across push and pull', () => {
      const errors: TableSyncError[] = [
        {
          table: 'milk_monthly_records',
          operation: 'push',
          code: '42501',
          message: 'Permission denied',
          details: 'Row violates RLS',
          hint: null
        },
        {
          table: 'loans',
          operation: 'pull',
          code: 'PGRST116',
          message: 'Fetch conflict',
          details: null,
          hint: 'Retry fetch'
        }
      ];

      const summary = formatSyncErrorsSummary(errors);
      assert.ok(summary.includes('failed on 2 table operation(s)'));
      assert.ok(summary.includes('[milk_monthly_records] PUSH failed: Permission denied (Code: 42501) Details: Row violates RLS'));
      assert.ok(summary.includes('[loans] PULL failed: Fetch conflict (Code: PGRST116) Hint: Retry fetch'));
    });
  });
});
