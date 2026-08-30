import { db } from '../db/db';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { 
  UtilityPerson, 
  UtilityBill, 
  UtilityPayment, 
  MilkConsumer, 
  MilkDailyLog, 
  PetrolRefill, 
  RentPortion, 
  RentMonthlyRecord, 
  LoanTransaction,
  AppSettings
} from '../types';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'unconfigured';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: string | null;
  message: string;
}

const STORAGE_LAST_SYNCED = 'tahir_tracker_last_synced';

let currentStatus: SyncStatus = {
  state: isSupabaseConfigured() ? 'idle' : 'unconfigured',
  lastSyncedAt: localStorage.getItem(STORAGE_LAST_SYNCED),
  message: isSupabaseConfigured() ? 'Ready to sync' : 'Supabase not configured'
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
function toSnakeCase(obj: any): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = obj[key];
  }
  return result;
}

// Map snake_case to camelCase from Supabase
function toCamelCase(obj: any): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

/**
 * Execute a complete two-way synchronization between Dexie and Supabase
 */
export async function syncWithSupabase(): Promise<{ success: boolean; message: string }> {
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

  try {
    // 1. UTILITY PERSONS
    const localPersons = await db.utility_persons.toArray();
    if (localPersons.length > 0) {
      const payload = localPersons.map(toSnakeCase);
      const { error } = await client.from('utility_persons').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase utility_persons push error:', error.message);
    }
    const { data: remotePersons } = await client.from('utility_persons').select('*');
    if (remotePersons && remotePersons.length > 0) {
      const camelPersons: UtilityPerson[] = remotePersons.map(toCamelCase);
      await db.utility_persons.bulkPut(camelPersons);
    }

    // 2. UTILITY BILLS
    const localBills = await db.utility_bills.toArray();
    if (localBills.length > 0) {
      const payload = localBills.map(toSnakeCase);
      const { error } = await client.from('utility_bills').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase utility_bills push error:', error.message);
    }
    const { data: remoteBills } = await client.from('utility_bills').select('*');
    if (remoteBills && remoteBills.length > 0) {
      const camelBills: UtilityBill[] = remoteBills.map(toCamelCase);
      await db.utility_bills.bulkPut(camelBills);
    }

    // 3. UTILITY PAYMENTS
    const localPayments = await db.utility_payments.toArray();
    if (localPayments.length > 0) {
      const payload = localPayments.map(toSnakeCase);
      const { error } = await client.from('utility_payments').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase utility_payments push error:', error.message);
    }
    const { data: remotePayments } = await client.from('utility_payments').select('*');
    if (remotePayments && remotePayments.length > 0) {
      const camelPayments: UtilityPayment[] = remotePayments.map(toCamelCase);
      await db.utility_payments.bulkPut(camelPayments);
    }

    // 4. MILK CONSUMERS
    const localConsumers = await db.milk_consumers.toArray();
    if (localConsumers.length > 0) {
      const payload = localConsumers.map(toSnakeCase);
      const { error } = await client.from('milk_consumers').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase milk_consumers push error:', error.message);
    }
    const { data: remoteConsumers } = await client.from('milk_consumers').select('*');
    if (remoteConsumers && remoteConsumers.length > 0) {
      const camelConsumers: MilkConsumer[] = remoteConsumers.map(toCamelCase);
      await db.milk_consumers.bulkPut(camelConsumers);
    }

    // 5. MILK LOGS
    const localLogs = await db.milk_logs.toArray();
    if (localLogs.length > 0) {
      const payload = localLogs.map(toSnakeCase);
      const { error } = await client.from('milk_logs').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase milk_logs push error:', error.message);
    }
    const { data: remoteLogs } = await client.from('milk_logs').select('*');
    if (remoteLogs && remoteLogs.length > 0) {
      const camelLogs: MilkDailyLog[] = remoteLogs.map(toCamelCase);
      await db.milk_logs.bulkPut(camelLogs);
    }

    // 6. PETROL REFILLS
    const localPetrol = await db.petrol_refills.toArray();
    if (localPetrol.length > 0) {
      const payload = localPetrol.map(toSnakeCase);
      const { error } = await client.from('petrol_refills').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase petrol_refills push error:', error.message);
    }
    const { data: remotePetrol } = await client.from('petrol_refills').select('*');
    if (remotePetrol && remotePetrol.length > 0) {
      const camelPetrol: PetrolRefill[] = remotePetrol.map(toCamelCase);
      await db.petrol_refills.bulkPut(camelPetrol);
    }

    // 7. RENT PORTIONS
    const localPortions = await db.rent_portions.toArray();
    if (localPortions.length > 0) {
      const payload = localPortions.map(toSnakeCase);
      const { error } = await client.from('rent_portions').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase rent_portions push error:', error.message);
    }
    const { data: remotePortions } = await client.from('rent_portions').select('*');
    if (remotePortions && remotePortions.length > 0) {
      const camelPortions: RentPortion[] = remotePortions.map(toCamelCase);
      await db.rent_portions.bulkPut(camelPortions);
    }

    // 8. RENT RECORDS
    const localRentRecords = await db.rent_records.toArray();
    if (localRentRecords.length > 0) {
      const payload = localRentRecords.map(toSnakeCase);
      const { error } = await client.from('rent_records').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase rent_records push error:', error.message);
    }
    const { data: remoteRentRecords } = await client.from('rent_records').select('*');
    if (remoteRentRecords && remoteRentRecords.length > 0) {
      const camelRentRecords: RentMonthlyRecord[] = remoteRentRecords.map(toCamelCase);
      await db.rent_records.bulkPut(camelRentRecords);
    }

    // 9. LOANS
    const localLoans = await db.loans.toArray();
    if (localLoans.length > 0) {
      const payload = localLoans.map(toSnakeCase);
      const { error } = await client.from('loans').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase loans push error:', error.message);
    }
    const { data: remoteLoans } = await client.from('loans').select('*');
    if (remoteLoans && remoteLoans.length > 0) {
      const camelLoans: LoanTransaction[] = remoteLoans.map(toCamelCase);
      await db.loans.bulkPut(camelLoans);
    }

    // 10. SETTINGS
    const localSettings = await db.settings.toArray();
    if (localSettings.length > 0) {
      const payload = localSettings.map(toSnakeCase);
      const { error } = await client.from('settings').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase settings push error:', error.message);
    }
    const { data: remoteSettings } = await client.from('settings').select('*');
    if (remoteSettings && remoteSettings.length > 0) {
      const camelSettings: AppSettings[] = remoteSettings.map(toCamelCase);
      await db.settings.bulkPut(camelSettings);
    }

    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_LAST_SYNCED, now);

    updateStatus('synced', 'All records synced with Supabase successfully');
    return { success: true, message: 'Synchronization completed successfully!' };
  } catch (err: any) {
    console.error('Synchronization failed:', err);
    updateStatus('error', `Sync failed: ${err?.message || 'Unknown network error'}`);
    return { success: false, message: err?.message || 'Sync failed' };
  }
}

/**
 * Initialize automatic sync listeners (network online/offline & initial sync)
 */
export function initSyncService(): () => void {
  const handleOnline = () => {
    if (isSupabaseConfigured()) {
      syncWithSupabase();
    } else {
      updateStatus('unconfigured', 'Supabase not configured');
    }
  };

  const handleOffline = () => {
    updateStatus('offline', 'Device is offline');
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial sync attempt if online & configured
  if (navigator.onLine && isSupabaseConfigured()) {
    // Delay slightly to allow Dexie initial population
    setTimeout(() => {
      syncWithSupabase();
    }, 1500);
  } else if (!isSupabaseConfigured()) {
    updateStatus('unconfigured', 'Supabase not configured');
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
