import { db, LEGACY_DUMMY_IDS } from '../db/db';
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
  AppSettings,
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  FinanceBudget,
  FinanceRecurringTransaction,
  FinanceGoal,
  FinanceVoiceEntry
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
    // 0. PURGE ANY DUMMY DATA FROM SUPABASE CLOUD (Ensures PWA/APK never pull dummy records)
    for (const [table, ids] of Object.entries(LEGACY_DUMMY_IDS)) {
      try {
        await client.from(table).delete().in('id', ids);
      } catch (_) {
        // Ignore if table does not exist or already clean
      }
    }

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
    const localBills = (await db.utility_bills.toArray()).filter(b => !LEGACY_DUMMY_IDS.utility_bills.includes(b.id));
    if (localBills.length > 0) {
      const payload = localBills.map(toSnakeCase);
      const { error } = await client.from('utility_bills').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase utility_bills push error:', error.message);
    }
    const { data: remoteBills } = await client.from('utility_bills').select('*');
    if (remoteBills && remoteBills.length > 0) {
      const camelBills: UtilityBill[] = remoteBills
        .filter((b: any) => !LEGACY_DUMMY_IDS.utility_bills.includes(b.id))
        .map(toCamelCase);
      if (camelBills.length > 0) await db.utility_bills.bulkPut(camelBills);
    }

    // 3. UTILITY PAYMENTS
    const localPayments = (await db.utility_payments.toArray()).filter(p => !LEGACY_DUMMY_IDS.utility_payments.includes(p.id));
    if (localPayments.length > 0) {
      const payload = localPayments.map(toSnakeCase);
      const { error } = await client.from('utility_payments').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase utility_payments push error:', error.message);
    }
    const { data: remotePayments } = await client.from('utility_payments').select('*');
    if (remotePayments && remotePayments.length > 0) {
      const camelPayments: UtilityPayment[] = remotePayments
        .filter((p: any) => !LEGACY_DUMMY_IDS.utility_payments.includes(p.id))
        .map(toCamelCase);
      if (camelPayments.length > 0) await db.utility_payments.bulkPut(camelPayments);
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
    const localLogs = (await db.milk_logs.toArray()).filter(l => !LEGACY_DUMMY_IDS.milk_logs.includes(l.id));
    if (localLogs.length > 0) {
      const payload = localLogs.map(toSnakeCase);
      const { error } = await client.from('milk_logs').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase milk_logs push error:', error.message);
    }
    const { data: remoteLogs } = await client.from('milk_logs').select('*');
    if (remoteLogs && remoteLogs.length > 0) {
      const camelLogs: MilkDailyLog[] = remoteLogs
        .filter((l: any) => !LEGACY_DUMMY_IDS.milk_logs.includes(l.id))
        .map(toCamelCase);
      if (camelLogs.length > 0) await db.milk_logs.bulkPut(camelLogs);
    }

    // 6. PETROL REFILLS (Guaranteed no dummy entries)
    const localPetrol = (await db.petrol_refills.toArray()).filter(p => !LEGACY_DUMMY_IDS.petrol_refills.includes(p.id));
    if (localPetrol.length > 0) {
      const payload = localPetrol.map(toSnakeCase);
      const { error } = await client.from('petrol_refills').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase petrol_refills push error:', error.message);
    }
    const { data: remotePetrol } = await client.from('petrol_refills').select('*');
    if (remotePetrol && remotePetrol.length > 0) {
      const camelPetrol: PetrolRefill[] = remotePetrol
        .filter((p: any) => !LEGACY_DUMMY_IDS.petrol_refills.includes(p.id))
        .map(toCamelCase);
      if (camelPetrol.length > 0) await db.petrol_refills.bulkPut(camelPetrol);
    }

    // 7. RENT PORTIONS
    const localPortions = (await db.rent_portions.toArray()).filter(
      p => !LEGACY_DUMMY_IDS.rent_portions.includes(p.id) && !p.tenantName?.startsWith('Tenant ') && p.tenantPhone !== '0300-1111111'
    );
    if (localPortions.length > 0) {
      const payload = localPortions.map(toSnakeCase);
      const { error } = await client.from('rent_portions').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase rent_portions push error:', error.message);
    }
    const { data: remotePortions } = await client.from('rent_portions').select('*');
    if (remotePortions && remotePortions.length > 0) {
      const camelPortions: RentPortion[] = remotePortions
        .filter((p: any) => !LEGACY_DUMMY_IDS.rent_portions.includes(p.id) && !p.tenant_name?.startsWith('Tenant ') && p.tenant_phone !== '0300-1111111')
        .map(toCamelCase);
      if (camelPortions.length > 0) await db.rent_portions.bulkPut(camelPortions);
    }

    // 8. RENT RECORDS
    const localRentRecords = (await db.rent_records.toArray()).filter(r => !LEGACY_DUMMY_IDS.rent_records.includes(r.id));
    if (localRentRecords.length > 0) {
      const payload = localRentRecords.map(toSnakeCase);
      const { error } = await client.from('rent_records').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase rent_records push error:', error.message);
    }
    const { data: remoteRentRecords } = await client.from('rent_records').select('*');
    if (remoteRentRecords && remoteRentRecords.length > 0) {
      const camelRentRecords: RentMonthlyRecord[] = remoteRentRecords
        .filter((r: any) => !LEGACY_DUMMY_IDS.rent_records.includes(r.id))
        .map(toCamelCase);
      if (camelRentRecords.length > 0) await db.rent_records.bulkPut(camelRentRecords);
    }

    // 9. LOANS
    const localLoans = (await db.loans.toArray()).filter(l => !LEGACY_DUMMY_IDS.loans.includes(l.id));
    if (localLoans.length > 0) {
      const payload = localLoans.map(toSnakeCase);
      const { error } = await client.from('loans').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase loans push error:', error.message);
    }
    const { data: remoteLoans } = await client.from('loans').select('*');
    if (remoteLoans && remoteLoans.length > 0) {
      const camelLoans: LoanTransaction[] = remoteLoans
        .filter((l: any) => !LEGACY_DUMMY_IDS.loans.includes(l.id))
        .map(toCamelCase);
      if (camelLoans.length > 0) await db.loans.bulkPut(camelLoans);
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

    // 11. FINANCE ACCOUNTS
    const localAccounts = await db.finance_accounts.toArray();
    if (localAccounts.length > 0) {
      const payload = localAccounts.map(toSnakeCase);
      const { error } = await client.from('finance_accounts').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase finance_accounts push error:', error.message);
    }
    const { data: remoteAccounts } = await client.from('finance_accounts').select('*');
    if (remoteAccounts && remoteAccounts.length > 0) {
      const camelAccounts: FinanceAccount[] = remoteAccounts.map(toCamelCase);
      await db.finance_accounts.bulkPut(camelAccounts);
    }

    // 12. FINANCE CATEGORIES
    const localCategories = await db.finance_categories.toArray();
    if (localCategories.length > 0) {
      const payload = localCategories.map(toSnakeCase);
      const { error } = await client.from('finance_categories').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase finance_categories push error:', error.message);
    }
    const { data: remoteCategories } = await client.from('finance_categories').select('*');
    if (remoteCategories && remoteCategories.length > 0) {
      const camelCategories: FinanceCategory[] = remoteCategories.map(toCamelCase);
      await db.finance_categories.bulkPut(camelCategories);
    }

    // 13. FINANCE TRANSACTIONS
    const localTransactions = (await db.finance_transactions.toArray()).filter(t => !LEGACY_DUMMY_IDS.finance_transactions.includes(t.id));
    if (localTransactions.length > 0) {
      const payload = localTransactions.map(toSnakeCase);
      const { error } = await client.from('finance_transactions').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase finance_transactions push error:', error.message);
    }
    const { data: remoteTransactions } = await client.from('finance_transactions').select('*');
    if (remoteTransactions && remoteTransactions.length > 0) {
      const camelTransactions: FinanceTransaction[] = remoteTransactions
        .filter((t: any) => !LEGACY_DUMMY_IDS.finance_transactions.includes(t.id))
        .map(toCamelCase);
      if (camelTransactions.length > 0) await db.finance_transactions.bulkPut(camelTransactions);
    }

    // 14. FINANCE BUDGETS
    const localBudgets = (await db.finance_budgets.toArray()).filter(b => !LEGACY_DUMMY_IDS.finance_budgets.includes(b.id));
    if (localBudgets.length > 0) {
      const payload = localBudgets.map(toSnakeCase);
      const { error } = await client.from('finance_budgets').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase finance_budgets push error:', error.message);
    }
    const { data: remoteBudgets } = await client.from('finance_budgets').select('*');
    if (remoteBudgets && remoteBudgets.length > 0) {
      const camelBudgets: FinanceBudget[] = remoteBudgets
        .filter((b: any) => !LEGACY_DUMMY_IDS.finance_budgets.includes(b.id))
        .map(toCamelCase);
      if (camelBudgets.length > 0) await db.finance_budgets.bulkPut(camelBudgets);
    }

    // 15. FINANCE RECURRING
    const localRecurring = (await db.finance_recurring_transactions.toArray()).filter(r => !LEGACY_DUMMY_IDS.finance_recurring_transactions.includes(r.id));
    if (localRecurring.length > 0) {
      const payload = localRecurring.map(toSnakeCase);
      const { error } = await client.from('finance_recurring_transactions').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase finance_recurring push error:', error.message);
    }
    const { data: remoteRecurring } = await client.from('finance_recurring_transactions').select('*');
    if (remoteRecurring && remoteRecurring.length > 0) {
      const camelRecurring: FinanceRecurringTransaction[] = remoteRecurring
        .filter((r: any) => !LEGACY_DUMMY_IDS.finance_recurring_transactions.includes(r.id))
        .map(toCamelCase);
      if (camelRecurring.length > 0) await db.finance_recurring_transactions.bulkPut(camelRecurring);
    }

    // 16. FINANCE GOALS
    const localGoals = (await db.finance_goals.toArray()).filter(g => !LEGACY_DUMMY_IDS.finance_goals.includes(g.id));
    if (localGoals.length > 0) {
      const payload = localGoals.map(toSnakeCase);
      const { error } = await client.from('finance_goals').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase finance_goals push error:', error.message);
    }
    const { data: remoteGoals } = await client.from('finance_goals').select('*');
    if (remoteGoals && remoteGoals.length > 0) {
      const camelGoals: FinanceGoal[] = remoteGoals
        .filter((g: any) => !LEGACY_DUMMY_IDS.finance_goals.includes(g.id))
        .map(toCamelCase);
      if (camelGoals.length > 0) await db.finance_goals.bulkPut(camelGoals);
    }

    // 17. FINANCE VOICE ENTRIES
    const localVoice = (await db.finance_voice_entries.toArray()).filter(v => !LEGACY_DUMMY_IDS.finance_voice_entries.includes(v.id));
    if (localVoice.length > 0) {
      const payload = localVoice.map(toSnakeCase);
      const { error } = await client.from('finance_voice_entries').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase finance_voice_entries push error:', error.message);
    }
    const { data: remoteVoice } = await client.from('finance_voice_entries').select('*');
    if (remoteVoice && remoteVoice.length > 0) {
      const camelVoice: FinanceVoiceEntry[] = remoteVoice
        .filter((v: any) => !LEGACY_DUMMY_IDS.finance_voice_entries.includes(v.id))
        .map(toCamelCase);
      if (camelVoice.length > 0) await db.finance_voice_entries.bulkPut(camelVoice);
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
