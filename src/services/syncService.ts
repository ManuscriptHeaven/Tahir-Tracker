import { RealtimeChannel } from '@supabase/supabase-js';
import { db, LEGACY_DUMMY_IDS } from '../db/db';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUserId, isAuthenticated, subscribeAuth } from './authService';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'realtime_active' | 'error' | 'offline' | 'unconfigured' | 'auth_required';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: string | null;
  message: string;
}

const STORAGE_LAST_SYNCED = 'tahir_tracker_last_synced';

function getInitialState(): SyncState {
  if (!isSupabaseConfigured()) return 'unconfigured';
  if (!isAuthenticated()) return 'auth_required';
  return 'idle';
}

function getInitialMessage(): string {
  if (!isSupabaseConfigured()) return 'Supabase not configured';
  if (!isAuthenticated()) return 'Sign in required for cloud sync';
  return 'Ready to sync';
}

let currentStatus: SyncStatus = {
  state: getInitialState(),
  lastSyncedAt: localStorage.getItem(STORAGE_LAST_SYNCED),
  message: getInitialMessage()
};

const listeners = new Set<(status: SyncStatus) => void>();

function notifyListeners() {
  listeners.forEach(fn => fn({ ...currentStatus }));
}

export function getSyncStatus(): SyncStatus {
  return { ...currentStatus };
}

export function subscribeSyncStatus(fn: (status: SyncStatus) => void): () => void {
  listeners.add(fn);
  fn({ ...currentStatus });
  return () => listeners.delete(fn);
}

function updateStatus(state: SyncState, message: string) {
  currentStatus = {
    state,
    lastSyncedAt: localStorage.getItem(STORAGE_LAST_SYNCED),
    message
  };
  notifyListeners();
}

// Map camelCase to snake_case for Supabase
export function toSnakeCase(obj: any): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = obj[key];
  }
  return result;
}

// Map snake_case to camelCase from Supabase
export function toCamelCase(obj: any): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

// Table instances mapping for automated reactive sync
export const TABLE_MAP: Record<string, any> = {
  utility_persons: db.utility_persons,
  utility_bills: db.utility_bills,
  utility_payments: db.utility_payments,
  milk_consumers: db.milk_consumers,
  milk_logs: db.milk_logs,
  milk_monthly_records: db.milk_monthly_records,
  petrol_refills: db.petrol_refills,
  rent_properties: db.rent_properties,
  rent_portions: db.rent_portions,
  rent_records: db.rent_records,
  loans: db.loans,
  settings: db.settings,
  finance_accounts: db.finance_accounts,
  finance_categories: db.finance_categories,
  finance_transactions: db.finance_transactions,
  finance_budgets: db.finance_budgets,
  finance_recurring_transactions: db.finance_recurring_transactions,
  finance_goals: db.finance_goals,
  finance_voice_entries: db.finance_voice_entries
};

import { 
  enqueueSyncOperation, 
  getPendingSyncOperations, 
  dequeueSyncOperation, 
  incrementRetryCount 
} from './syncQueue';

// Re-entrant sync depth counter to safely handle concurrent asynchronous remote sync events
let remoteSyncDepth = 0;

export function enterRemoteSync() {
  remoteSyncDepth++;
}

export function exitRemoteSync() {
  if (remoteSyncDepth > 0) {
    remoteSyncDepth--;
  }
}

export function setRemoteSyncActive(active: boolean) {
  if (active) {
    enterRemoteSync();
  } else {
    exitRemoteSync();
  }
}

export function isRemoteSyncing(): boolean {
  return remoteSyncDepth > 0;
}

let realtimeChannel: RealtimeChannel | null = null;
const pendingPushTimeouts = new Map<string, any>();

/**
 * Handle incoming Realtime Change Data Capture event from Supabase WebSocket
 */
async function handleRealtimeChange(payload: any) {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return;

  // Filter out events that do not belong to the authenticated user
  const eventUserId = payload.new?.user_id || payload.old?.user_id;
  if (eventUserId && eventUserId !== currentUserId) {
    return;
  }

  const table = payload.table;
  const dexieTable = TABLE_MAP[table];
  if (!dexieTable) return;

  const eventType = payload.eventType; // 'INSERT' | 'UPDATE' | 'DELETE'

  enterRemoteSync();
  try {
    if (eventType === 'DELETE') {
      const id = payload.old?.id;
      if (id) {
        await dexieTable.delete(id);
        const now = new Date().toISOString();
        localStorage.setItem(STORAGE_LAST_SYNCED, now);
        updateStatus('realtime_active', `Live sync: removed from ${table}`);
      }
    } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const newRow = payload.new;
      if (newRow && newRow.id) {
        // Exclude legacy dummy entries
        if ((LEGACY_DUMMY_IDS as any)[table]?.includes(newRow.id)) return;
        const camelObj = toCamelCase(newRow);

        // LWW Conflict Resolution: check if local record is newer
        const existing = await dexieTable.get(camelObj.id);
        if (existing) {
          const localTime = existing.updatedAt || existing.createdAt || '';
          const remoteTime = camelObj.updatedAt || camelObj.createdAt || '';
          if (localTime && remoteTime && localTime > remoteTime) {
            // Local is newer, don't overwrite with stale remote update
            return;
          }
        }

        await dexieTable.put(camelObj);
        const now = new Date().toISOString();
        localStorage.setItem(STORAGE_LAST_SYNCED, now);
        updateStatus('realtime_active', `Live sync: updated ${table}`);
      }
    }
  } catch (err) {
    console.error(`Error handling realtime change on ${table}:`, err);
  } finally {
    exitRemoteSync();
  }
}

/**
 * Subscribe to all Postgres database changes across all tables via Supabase WebSocket
 */
export function subscribeToRealtimeChanges(): () => void {
  const client = getSupabaseClient();
  const currentUserId = getCurrentUserId();
  if (!client || !isAuthenticated() || !currentUserId) return () => {};

  if (realtimeChannel) {
    try {
      client.removeChannel(realtimeChannel);
    } catch (_) {}
    realtimeChannel = null;
  }

  try {
    realtimeChannel = client
      .channel('public-db-realtime-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          handleRealtimeChange(payload);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          updateStatus('realtime_active', 'Realtime live sync connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('Realtime channel status:', status, err);
          updateStatus('offline', 'Realtime disconnected. Will reconnect.');
        }
      });

    return () => {
      if (realtimeChannel && client) {
        try {
          client.removeChannel(realtimeChannel);
        } catch (_) {}
        realtimeChannel = null;
      }
    };
  } catch (err) {
    console.error('Failed to subscribe to realtime changes:', err);
    return () => {};
  }
}

/**
 * Trigger debounced push for a table when local mutations occur
 */
export function triggerDebouncedPush(tableName: string, recordId?: string) {
  if (isRemoteSyncing()) return;
  if (!isSupabaseConfigured() || !navigator.onLine) return;
  if (!isAuthenticated() || !getCurrentUserId()) return;

  const key = recordId ? `${tableName}_${recordId}` : tableName;
  if (pendingPushTimeouts.has(key)) {
    clearTimeout(pendingPushTimeouts.get(key));
  }

  const timeoutId = setTimeout(async () => {
    pendingPushTimeouts.delete(key);
    if (recordId) {
      await pushRecordToSupabase(tableName, recordId);
    } else {
      await pushTableToSupabase(tableName);
    }
  }, 300);

  pendingPushTimeouts.set(key, timeoutId);
}

/**
 * Push a single modified record to Supabase
 */
export async function pushRecordToSupabase(tableName: string, recordId: string): Promise<void> {
  if (isRemoteSyncing()) return;
  const client = getSupabaseClient();
  const dexieTable = TABLE_MAP[tableName];
  const currentUserId = getCurrentUserId();
  if (!client || !dexieTable || !recordId || !currentUserId) return;

  try {
    const record = await dexieTable.get(recordId);
    if (!record) return;

    const dummyIds = (LEGACY_DUMMY_IDS as any)[tableName] || [];
    if (dummyIds.includes(record.id)) return;

    const payload = toSnakeCase(record);
    // Explicitly scope to authenticated user
    payload.user_id = currentUserId;

    const { error } = await client.from(tableName).upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn(`Supabase push error on ${tableName}/${recordId}:`, error.message);
      await incrementRetryCount(`${tableName}_${recordId}`);
    } else {
      await dequeueSyncOperation(`${tableName}_${recordId}`);
      const now = new Date().toISOString();
      localStorage.setItem(STORAGE_LAST_SYNCED, now);
      updateStatus('realtime_active', `Live sync: updated ${tableName}`);
    }
  } catch (err) {
    console.error(`Error in pushRecordToSupabase for ${tableName}/${recordId}:`, err);
  }
}

/**
 * Push an entire table's local records to Supabase
 */
export async function pushTableToSupabase(tableName: string): Promise<void> {
  if (isRemoteSyncing()) return;
  const client = getSupabaseClient();
  const dexieTable = TABLE_MAP[tableName];
  const currentUserId = getCurrentUserId();
  if (!client || !dexieTable || !currentUserId) return;

  try {
    const records = await dexieTable.toArray();
    const dummyIds = (LEGACY_DUMMY_IDS as any)[tableName] || [];
    const cleanRecords = records.filter((r: any) => !dummyIds.includes(r.id));

    if (cleanRecords.length > 0) {
      const payload = cleanRecords.map((r: any) => {
        const s = toSnakeCase(r);
        s.user_id = currentUserId;
        return s;
      });
      const { error } = await client.from(tableName).upsert(payload, { onConflict: 'id' });
      if (error) {
        console.warn(`Supabase push error on ${tableName}:`, error.message);
      } else {
        const now = new Date().toISOString();
        localStorage.setItem(STORAGE_LAST_SYNCED, now);
        updateStatus('realtime_active', `Synced ${cleanRecords.length} records in ${tableName}`);
      }
    }
  } catch (err) {
    console.error(`Error in pushTableToSupabase for ${tableName}:`, err);
  }
}

/**
 * Delete a specific record from Supabase immediately when deleted locally
 */
export async function deleteRemoteRecord(tableName: string, id: any): Promise<void> {
  if (isRemoteSyncing()) return;
  const client = getSupabaseClient();
  const currentUserId = getCurrentUserId();
  if (!client || !id || !currentUserId) return;

  try {
    const { error } = await client
      .from(tableName)
      .delete()
      .eq('id', id)
      .eq('user_id', currentUserId);

    if (error) {
      console.warn(`Supabase delete error on ${tableName}:`, error.message);
      await incrementRetryCount(`${tableName}_${id}`);
    } else {
      await dequeueSyncOperation(`${tableName}_${id}`);
      const now = new Date().toISOString();
      localStorage.setItem(STORAGE_LAST_SYNCED, now);
      updateStatus('realtime_active', `Live sync: Deleted from ${tableName}`);
    }
  } catch (err) {
    console.error(`Error deleting record from Supabase ${tableName}:`, err);
  }
}

let hooksInitialized = false;

/**
 * Attach mutation hooks to all Dexie tables so local writes auto-push to Supabase
 */
export function initDexieMutationHooks() {
  if (hooksInitialized) return;
  hooksInitialized = true;

  Object.entries(TABLE_MAP).forEach(([tableName, table]) => {
    if (!table || typeof table.hook !== 'function') return;

    table.hook('creating', function (primKey: any, obj: any) {
      if (!isRemoteSyncing()) {
        const idStr = String(primKey || obj?.id || '');
        if (idStr) {
          enqueueSyncOperation(tableName, 'upsert', idStr, obj);
          setTimeout(() => triggerDebouncedPush(tableName, idStr), 50);
        }
      }
    });

    table.hook('updating', function (modifications: any, primKey: any, obj: any) {
      if (!isRemoteSyncing()) {
        const idStr = String(primKey || obj?.id || '');
        if (idStr) {
          const merged = { ...obj, ...modifications };
          enqueueSyncOperation(tableName, 'upsert', idStr, merged);
          setTimeout(() => triggerDebouncedPush(tableName, idStr), 50);
        }
      }
    });

    table.hook('deleting', function (primKey: any) {
      if (!isRemoteSyncing()) {
        const idStr = String(primKey || '');
        if (idStr) {
          enqueueSyncOperation(tableName, 'delete', idStr);
          setTimeout(() => deleteRemoteRecord(tableName, primKey), 0);
        }
      }
    });
  });
}

/**
 * Process offline sync queue: pushes queued deletions and mutations with retries
 */
export async function processOfflineQueue(): Promise<void> {
  const client = getSupabaseClient();
  const currentUserId = getCurrentUserId();
  if (!client || !navigator.onLine || !currentUserId) return;

  const pending = await getPendingSyncOperations();
  if (pending.length === 0) return;

  for (const item of pending) {
    try {
      if (item.retryCount >= 5) {
        console.warn(`[SyncQueue] Dropping permanently failed item ${item.id} after 5 retries.`);
        await dequeueSyncOperation(item.id);
        continue;
      }

      if (item.action === 'delete') {
        const { error } = await client
          .from(item.tableName)
          .delete()
          .eq('id', item.recordId)
          .eq('user_id', currentUserId);

        if (!error) {
          await dequeueSyncOperation(item.id);
        } else {
          await incrementRetryCount(item.id);
        }
      } else if (item.action === 'upsert') {
        let payload = item.payload;
        if (!payload) {
          const dexieTable = TABLE_MAP[item.tableName];
          if (dexieTable) {
            payload = await dexieTable.get(item.recordId);
          }
        }
        if (payload) {
          const snakePayload = toSnakeCase(payload);
          snakePayload.user_id = currentUserId;
          const { error } = await client.from(item.tableName).upsert(snakePayload, { onConflict: 'id' });
          if (!error) {
            await dequeueSyncOperation(item.id);
          } else {
            await incrementRetryCount(item.id);
          }
        } else {
          await dequeueSyncOperation(item.id);
        }
      }
    } catch (err) {
      console.warn(`Error processing queue item ${item.id}:`, err);
    }
  }
}

/**
 * Merges remote records into Dexie using Last-Write-Wins (LWW) conflict resolution
 * and protection for pending local offline mutations and append-only financial records.
 */
async function mergeRemoteRecords(dexieTable: any, remoteRecords: any[], tableName: string) {
  if (!remoteRecords || remoteRecords.length === 0) return;
  const dummyIds = (LEGACY_DUMMY_IDS as any)[tableName] || [];
  const cleanRemotes = remoteRecords.filter(r => !dummyIds.includes(r.id));
  if (cleanRemotes.length === 0) return;

  enterRemoteSync();
  try {
    for (const r of cleanRemotes) {
      const camel = toCamelCase(r);
      const existing = await dexieTable.get(camel.id);
      if (existing) {
        // 1. If local record has a pending offline mutation waiting in sync_queue, NEVER let remote overwrite it!
        const hasPendingLocalEdit = await db.sync_queue.get(`${tableName}_${camel.id}`);
        if (hasPendingLocalEdit) {
          continue;
        }

        // 2. Append-only financial tables (transactions, payments, milk logs, petrol refills, loans)
        // are immutable historical records keyed by unique UUID. Never overwrite an existing local record.
        const isAppendOnly = [
          'finance_transactions',
          'utility_payments',
          'milk_logs',
          'petrol_refills',
          'loans'
        ].includes(tableName);
        if (isAppendOnly) {
          continue;
        }

        // 3. Mutable records: Use Last-Write-Wins comparison
        const localTime = existing.updatedAt || existing.createdAt || '';
        const remoteTime = camel.updatedAt || camel.createdAt || '';
        if (localTime && remoteTime && localTime > remoteTime) {
          // Local record is newer, keep local
          continue;
        }
      }
      await dexieTable.put(camel);
    }
  } finally {
    exitRemoteSync();
  }
}

export interface TableSyncError {
  table: string;
  operation: 'push' | 'pull';
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Strips any sensitive tokens, JWTs, or credentials from error messages
 */
export function sanitizeErrorMessage(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .replace(/Bearer\s+[A-Za-z0-9-_=.]+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[JWT_REDACTED]')
    .replace(/anonKey=[^\s&]+/gi, 'anonKey=[REDACTED]')
    .replace(/apikey=[^\s&]+/gi, 'apikey=[REDACTED]');
}

/**
 * Formats a list of per-table sync errors into a clear, actionable summary message
 */
export function formatSyncErrorsSummary(errors: TableSyncError[]): string {
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

/**
 * Execute a complete two-way synchronization between Dexie and Supabase
 */
export async function syncWithSupabase(): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    updateStatus('unconfigured', 'Supabase credentials not configured');
    return { success: false, message: 'Supabase credentials not configured' };
  }

  const currentUserId = getCurrentUserId();
  if (!isAuthenticated() || !currentUserId) {
    updateStatus('auth_required', 'Sign in required for cloud synchronization');
    return { success: false, message: 'Authentication required for cloud sync' };
  }

  if (!navigator.onLine) {
    updateStatus('offline', 'Device is offline');
    return { success: false, message: 'Device is offline' };
  }

  const client = getSupabaseClient();
  if (!client) {
    updateStatus('unconfigured', 'Supabase credentials not configured');
    return { success: false, message: 'Supabase credentials not configured' };
  }

  updateStatus('syncing', 'Synchronizing with cloud database...');
  const syncErrors: TableSyncError[] = [];

  try {
    // 0. Process offline mutation queue first (deletes propagate and prevent resurrecting)
    await processOfflineQueue();

    // 0b. Purge any dummy data from Supabase cloud
    for (const [table, ids] of Object.entries(LEGACY_DUMMY_IDS)) {
      try {
        await client.from(table).delete().in('id', ids).eq('user_id', currentUserId);
      } catch (_) {}
    }

    // Two-way sync across all tables
    const tableKeys = [
      'utility_persons', 'utility_bills', 'utility_payments',
      'milk_consumers', 'milk_logs', 'milk_monthly_records',
      'petrol_refills', 'rent_portions', 'rent_records',
      'loans', 'settings', 'finance_accounts', 'finance_categories',
      'finance_transactions', 'finance_budgets', 'finance_recurring_transactions',
      'finance_goals', 'finance_voice_entries'
    ];

    for (const tableName of tableKeys) {
      const dexieTable = TABLE_MAP[tableName];
      if (!dexieTable) continue;

      try {
        // 1. Push local records scoped to current authenticated user
        const localRecords = await dexieTable.toArray();
        const dummyIds = (LEGACY_DUMMY_IDS as any)[tableName] || [];
        const cleanLocal = localRecords.filter((r: any) => !dummyIds.includes(r.id));
        if (cleanLocal.length > 0) {
          const payload = cleanLocal.map((r: any) => {
            const s = toSnakeCase(r);
            s.user_id = currentUserId;
            return s;
          });
          const { error: pushError } = await client.from(tableName).upsert(payload, { onConflict: 'id' });
          if (pushError) {
            const errEntry: TableSyncError = {
              table: tableName,
              operation: 'push',
              code: pushError.code || 'UNKNOWN',
              message: sanitizeErrorMessage(pushError.message || 'Upsert failed'),
              details: sanitizeErrorMessage(pushError.details) || null,
              hint: sanitizeErrorMessage(pushError.hint) || null
            };
            syncErrors.push(errEntry);
            console.error(`[CloudSync] Supabase PUSH error on table "${tableName}":`, errEntry);
          }
        }

        // 2. Pull remote records scoped to current authenticated user with LWW merge
        const { data: remoteRecords, error: pullError } = await client
          .from(tableName)
          .select('*')
          .eq('user_id', currentUserId);

        if (pullError) {
          const errEntry: TableSyncError = {
            table: tableName,
            operation: 'pull',
            code: pullError.code || 'UNKNOWN',
            message: sanitizeErrorMessage(pullError.message || 'Fetch failed'),
            details: sanitizeErrorMessage(pullError.details) || null,
            hint: sanitizeErrorMessage(pullError.hint) || null
          };
          syncErrors.push(errEntry);
          console.error(`[CloudSync] Supabase PULL error on table "${tableName}":`, errEntry);
        } else if (remoteRecords) {
          await mergeRemoteRecords(dexieTable, remoteRecords, tableName);
        }
      } catch (tableErr: any) {
        // Safe continuation: unexpected table exceptions don't prevent remaining tables from syncing
        const errEntry: TableSyncError = {
          table: tableName,
          operation: 'push',
          code: 'TABLE_EXCEPTION',
          message: sanitizeErrorMessage(tableErr?.message || 'Unexpected table error'),
          details: null,
          hint: null
        };
        syncErrors.push(errEntry);
        console.error(`[CloudSync] Exception during sync of table "${tableName}":`, tableErr);
      }
    }

    if (syncErrors.length > 0) {
      const failureMessage = formatSyncErrorsSummary(syncErrors);
      updateStatus('error', failureMessage);
      return { success: false, message: failureMessage };
    }

    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_LAST_SYNCED, now);

    updateStatus('synced', 'All records synced with Supabase successfully');
    return { success: true, message: 'Synchronization completed successfully!' };
  } catch (err: any) {
    console.error('Synchronization failed:', err);
    const sanitizedMsg = sanitizeErrorMessage(err?.message || 'Unknown network error');
    updateStatus('error', `Sync failed: ${sanitizedMsg}`);
    return { success: false, message: err?.message || 'Sync failed' };
  }
}

/**
 * Initialize automatic sync listeners (network, realtime, mutation hooks, visibility change & heartbeat)
 */
export function initSyncService(): () => void {
  // 1. Initialize Dexie mutation hooks so any local write auto-pushes to Supabase
  initDexieMutationHooks();

  let unsubscribeRealtime = () => {};

  const startRealtime = () => {
    if (isSupabaseConfigured() && isAuthenticated()) {
      unsubscribeRealtime = subscribeToRealtimeChanges();
    }
  };

  const handleOnline = () => {
    if (!isSupabaseConfigured()) {
      updateStatus('unconfigured', 'Supabase not configured');
    } else if (!isAuthenticated()) {
      updateStatus('auth_required', 'Sign in required for cloud sync');
    } else {
      syncWithSupabase();
      startRealtime();
    }
  };

  const handleOffline = () => {
    updateStatus('offline', 'Device is offline');
    if (unsubscribeRealtime) unsubscribeRealtime();
  };

  // 2. Sync on tab focus / phone unlock / app return
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && isSupabaseConfigured() && isAuthenticated()) {
      syncWithSupabase();
      startRealtime();
    }
  };

  const handleFocus = () => {
    if (isSupabaseConfigured() && isAuthenticated()) {
      syncWithSupabase();
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);

  // 3. React to Authentication State Changes
  const unsubscribeAuth = subscribeAuth((authState) => {
    if (authState.isAuthenticated && authState.user) {
      if (navigator.onLine && isSupabaseConfigured()) {
        syncWithSupabase();
        startRealtime();
      } else if (!navigator.onLine) {
        updateStatus('offline', 'Device is offline');
      }
    } else if (!authState.isAuthenticated) {
      if (unsubscribeRealtime) unsubscribeRealtime();
      if (isSupabaseConfigured()) {
        updateStatus('auth_required', 'Sign in required for cloud synchronization');
      }
    }
  });

  // 4. Initial sync and realtime connection
  if (navigator.onLine && isSupabaseConfigured() && isAuthenticated()) {
    setTimeout(() => {
      syncWithSupabase();
      startRealtime();
    }, 1000);
  } else if (!isSupabaseConfigured()) {
    updateStatus('unconfigured', 'Supabase not configured');
  } else if (!isAuthenticated()) {
    updateStatus('auth_required', 'Sign in required for cloud sync');
  }

  // 5. Background heartbeat poll (every 25 seconds when app is active and authenticated)
  const heartbeatTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine && isSupabaseConfigured() && isAuthenticated()) {
      syncWithSupabase();
    }
  }, 25000);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
    clearInterval(heartbeatTimer);
    if (unsubscribeRealtime) unsubscribeRealtime();
    unsubscribeAuth();
  };
}
