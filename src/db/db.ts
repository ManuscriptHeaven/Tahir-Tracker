import Dexie, { type Table } from 'dexie';
import type {
  LoanTransaction,
  MilkConsumer,
  MilkDailyLog,
  MilkMonthlyRecord,
  PetrolRefill,
  RentProperty,
  RentPortion,
  RentMonthlyRecord,
  AppSettings,
  UtilityPerson,
  UtilityBill,
  UtilityPayment,
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  FinanceBudget,
  FinanceRecurringTransaction,
  FinanceGoal,
  FinanceVoiceEntry
} from '../types/index.ts';
import { getWorkspaceSettingsId } from '../services/tenantWorkspace.ts';

export class TahirTrackerDB extends Dexie {
  loans!: Table<LoanTransaction, string>;
  milk_consumers!: Table<MilkConsumer, string>;
  milk_logs!: Table<MilkDailyLog, string>;
  milk_monthly_records!: Table<MilkMonthlyRecord, string>;
  petrol_refills!: Table<PetrolRefill, string>;
  rent_properties!: Table<RentProperty, string>;
  rent_portions!: Table<RentPortion, string>;
  rent_records!: Table<RentMonthlyRecord, string>;
  settings!: Table<AppSettings, number>;
  utility_persons!: Table<UtilityPerson, string>;
  utility_bills!: Table<UtilityBill, string>;
  utility_payments!: Table<UtilityPayment, string>;

  // Personal Finance Tables (Version 3)
  finance_accounts!: Table<FinanceAccount, string>;
  finance_categories!: Table<FinanceCategory, string>;
  finance_transactions!: Table<FinanceTransaction, string>;
  finance_budgets!: Table<FinanceBudget, string>;
  finance_recurring_transactions!: Table<FinanceRecurringTransaction, string>;
  finance_goals!: Table<FinanceGoal, string>;
  finance_voice_entries!: Table<FinanceVoiceEntry, string>;

  // Offline Sync Queue Table (Version 5)
  sync_queue!: Table<any, string>;

  constructor(dbName: string = 'TahirTrackerDB') {
    super(dbName);
    this.version(1).stores({
      loans: 'id, personName, type, date, dueDate, status, createdAt',
      milk_consumers: 'id, name, active, createdAt',
      milk_logs: 'id, date, consumerId, status, [date+consumerId]',
      petrol_refills: 'id, date, odometerReading, createdAt',
      rent_portions: 'id, portionName, tenantName, active',
      rent_records: 'id, portionId, monthYear, status, [monthYear+portionId]',
      settings: '++id'
    });

    this.version(2).stores({
      utility_persons: 'id, name, createdAt',
      utility_bills: 'id, personId, monthYear, year, month',
      utility_payments: 'id, utilityBillId, personId, paymentDate'
    });

    this.version(3).stores({
      finance_accounts: 'id, name, accountType, isActive, createdAt',
      finance_categories: 'id, name, type, parentCategoryId, isDefault, isActive, createdAt',
      finance_transactions: 'id, transactionType, categoryId, accountId, transferToAccountId, transactionDate, source, status, [transactionDate+transactionType], [categoryId+transactionDate]',
      finance_budgets: 'id, categoryId, period, isActive',
      finance_recurring_transactions: 'id, transactionType, categoryId, accountId, frequency, nextRunDate, isActive',
      finance_goals: 'id, status, targetDate, createdAt',
      finance_voice_entries: 'id, status, createdAt'
    });

    this.version(4).stores({
      milk_monthly_records: 'id, monthYear, status, updatedAt'
    });

    this.version(5).stores({
      sync_queue: 'id, tableName, action, recordId, timestamp'
    });

    // Version 6: Multi-property rent hierarchy (Property -> Portion -> Rent Records)
    this.version(6).stores({
      rent_properties: 'id, name, status, createdAt, updatedAt',
      rent_portions: 'id, propertyId, portionName, tenantName, active, [propertyId+active]'
    });
  }
}

// Multi-tenant database instance management
const userDbInstances = new Map<string, TahirTrackerDB>();
let currentActiveUserId: string | null = null;
let defaultFallbackDb: TahirTrackerDB | null = null;

export function getActiveDb(): TahirTrackerDB {
  if (currentActiveUserId) {
    let instance = userDbInstances.get(currentActiveUserId);
    if (!instance) {
      instance = new TahirTrackerDB(`TahirTrackerDB_${currentActiveUserId}`);
      userDbInstances.set(currentActiveUserId, instance);
    }
    return instance;
  }
  if (!defaultFallbackDb) {
    defaultFallbackDb = new TahirTrackerDB('TahirTrackerDB');
  }
  return defaultFallbackDb;
}

export function switchUserDb(userId: string | null): TahirTrackerDB {
  currentActiveUserId = userId;
  return getActiveDb();
}

export function closeUserDb(userId: string): void {
  const instance = userDbInstances.get(userId);
  if (instance) {
    try {
      instance.close();
    } catch (_) {}
    userDbInstances.delete(userId);
  }
  if (currentActiveUserId === userId) {
    currentActiveUserId = null;
  }
}

export function getCurrentDbUserId(): string | null {
  return currentActiveUserId;
}

/**
 * Transparent proxy for active database:
 * Ensures all direct imports `import { db } from './db'` dynamically route
 * to the currently authenticated user's isolated IndexedDB instance.
 */
export const db = new Proxy({} as TahirTrackerDB, {
  get(_target, prop) {
    const active = getActiveDb();
    const val = (active as any)[prop];
    if (typeof val === 'function') {
      return val.bind(active);
    }
    return val;
  }
});

// Known legacy dummy/sample IDs to remove across all modules
export const LEGACY_DUMMY_IDS = {
  petrol_refills: ['pet_1', 'pet_2', 'pet_3', 'pet_4'],
  loans: ['loan_1', 'loan_2'],
  milk_logs: [
    '2026-08-01_c1', '2026-08-01_c2', '2026-08-01_c3',
    '2026-08-02_c1', '2026-08-02_c2', '2026-08-02_c3',
    '2026-08-03_c1', '2026-08-03_c2', '2026-08-03_c3'
  ],
  rent_records: ['2026-08_p1', '2026-08_p2', '2026-08_p3', '2026-08_p4'],
  rent_portions: ['p1', 'p2', 'p3', 'p4'],
  utility_bills: ['ub_2026_08_saleem'],
  utility_payments: ['pay_2026_08_def'],
  finance_transactions: [
    'tx_sep_01', 'tx_sep_02', 'tx_sep_03',
    'tx_aug_01', 'tx_aug_02', 'tx_aug_03', 'tx_aug_04',
    'tx_aug_05', 'tx_aug_06', 'tx_aug_07'
  ],
  finance_goals: ['goal_laptop', 'goal_emergency'],
  finance_recurring_transactions: ['rec_salary', 'rec_internet', 'rec_netflix'],
  finance_budgets: ['b_food', 'b_groceries', 'b_transport', 'b_utilities', 'b_shopping'],
  finance_voice_entries: ['ve_01', 've_02', 've_03']
};

// Purge any legacy sample/dummy data from previous installations (runs once per install)
export async function cleanupLegacyDummyData(): Promise<void> {
  try {
    const settings = await db.settings.toArray();
    const curSettings = settings[0];
    if (curSettings?.legacyCleanupDone) {
      return; // Already executed once, never run destructive deletions again
    }

    await db.petrol_refills.bulkDelete(LEGACY_DUMMY_IDS.petrol_refills);
    await db.loans.bulkDelete(LEGACY_DUMMY_IDS.loans);
    await db.milk_logs.bulkDelete(LEGACY_DUMMY_IDS.milk_logs);
    await db.rent_records.bulkDelete(LEGACY_DUMMY_IDS.rent_records);

    // Delete dummy rent portions if they still have placeholder tenant names or phones
    const portions = await db.rent_portions.toArray();
    const dummyPortions = portions.filter(
      p => p.tenantName?.startsWith('Tenant ') || p.tenantPhone === '0300-1111111' || LEGACY_DUMMY_IDS.rent_portions.includes(p.id)
    );
    if (dummyPortions.length > 0) {
      await db.rent_portions.bulkDelete(dummyPortions.map(p => p.id));
    }

    await db.utility_bills.bulkDelete(LEGACY_DUMMY_IDS.utility_bills);
    await db.utility_payments.bulkDelete(LEGACY_DUMMY_IDS.utility_payments);
    await db.finance_transactions.bulkDelete(LEGACY_DUMMY_IDS.finance_transactions);
    await db.finance_goals.bulkDelete(LEGACY_DUMMY_IDS.finance_goals);
    await db.finance_recurring_transactions.bulkDelete(LEGACY_DUMMY_IDS.finance_recurring_transactions);
    await db.finance_budgets.bulkDelete(LEGACY_DUMMY_IDS.finance_budgets);
    await db.finance_voice_entries.bulkDelete(LEGACY_DUMMY_IDS.finance_voice_entries);

    // Mark cleanup as completed so user accounts and data are never touched again
    if (curSettings?.id) {
      await db.settings.update(curSettings.id, { legacyCleanupDone: true });
    }
  } catch (err) {
    console.error('Failed to cleanup legacy dummy data:', err);
  }
}

// Checks whether a user has already completed onboarding for their workspace
export async function checkUserOnboardingStatus(userId: string): Promise<boolean> {
  try {
    const userDb = switchUserDb(userId);
    const settings = await userDb.settings.toCollection().first();
    if (settings?.onboardingCompleted) return true;
    // If settings already exist and have categories, mark as completed
    const catCount = await userDb.finance_categories.count();
    if (catCount > 0) return true;
    return false;
  } catch (_) {
    return false;
  }
}

// Multi-User SaaS Clean Workspace Initialization
// Creates a clean private workspace with safe generic defaults and unique UUIDs.
// Tahir's private records (Saleem, Tayyab, Chand, utility records, etc.) are strictly EXCLUDED.
export async function initializeUserWorkspace(
  userId: string,
  options?: {
    currency?: string;
    enabledModules?: string[];
  }
): Promise<void> {
  const userDb = switchUserDb(userId);
  const now = new Date().toISOString();
  const currency = options?.currency || 'PKR';

  try {
    // 1. User Settings
    const settingsCount = await userDb.settings.count();
    if (settingsCount === 0) {
      await userDb.settings.add({
        id: getWorkspaceSettingsId(userId),
        currency,
        milkDefaultRate: 260,
        rentDueDayDefault: 10,
        theme: 'light',
        onboardingCompleted: true,
        enabledModules: options?.enabledModules || ['finance', 'rent', 'utility', 'milk', 'petrol', 'loans']
      });
    }

    // 2. Generic Starter Cash Account with Unique UUID
    const accountsCount = await userDb.finance_accounts.count();
    if (accountsCount === 0) {
      const defaultAccount: FinanceAccount = {
        id: `acc_${crypto.randomUUID()}`,
        name: 'Cash Wallet',
        accountType: 'cash',
        openingBalance: 0,
        currency,
        isActive: true,
        institution: 'Cash In Hand',
        icon: '💵',
        color: 'emerald',
        notes: 'Primary cash wallet',
        createdAt: now,
        updatedAt: now
      };
      await userDb.finance_accounts.add(defaultAccount);
    }

    // 3. Standard Categories with Globally Unique UUIDs
    const categoriesCount = await userDb.finance_categories.count();
    if (categoriesCount === 0) {
      const defaultCategories: FinanceCategory[] = [
        // Expenses
        { id: `cat_${crypto.randomUUID()}`, name: 'Food & Dining', type: 'expense', icon: '🍔', isDefault: true, isActive: true, color: '#f97316', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Groceries', type: 'expense', icon: '🛒', isDefault: true, isActive: true, color: '#10b981', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Transportation', type: 'expense', icon: '🚗', isDefault: true, isActive: true, color: '#3b82f6', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Home & Housing', type: 'expense', icon: '🏠', isDefault: true, isActive: true, color: '#8b5cf6', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Bills & Utilities', type: 'expense', icon: '💡', isDefault: true, isActive: true, color: '#eab308', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Shopping', type: 'expense', icon: '🛍️', isDefault: true, isActive: true, color: '#ec4899', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Entertainment', type: 'expense', icon: '🎬', isDefault: true, isActive: true, color: '#6366f1', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Health & Fitness', type: 'expense', icon: '🏥', isDefault: true, isActive: true, color: '#ef4444', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Family & Gifts', type: 'expense', icon: '🎁', isDefault: true, isActive: true, color: '#f43f5e', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Travel', type: 'expense', icon: '✈️', isDefault: true, isActive: true, color: '#06b6d4', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Business Expense', type: 'expense', icon: '💼', isDefault: true, isActive: true, color: '#64748b', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Education', type: 'expense', icon: '📚', isDefault: true, isActive: true, color: '#14b8a6', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Other Expense', type: 'expense', icon: '📦', isDefault: true, isActive: true, color: '#94a3b8', createdAt: now, updatedAt: now },

        // Incomes
        { id: `cat_${crypto.randomUUID()}`, name: 'Salary', type: 'income', icon: '💵', isDefault: true, isActive: true, color: '#10b981', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Business Income', type: 'income', icon: '💼', isDefault: true, isActive: true, color: '#059669', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Freelancing', type: 'income', icon: '💻', isDefault: true, isActive: true, color: '#7c3aed', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Investment Return', type: 'income', icon: '📈', isDefault: true, isActive: true, color: '#16a34a', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Rental Income', type: 'income', icon: '🏠', isDefault: true, isActive: true, color: '#d97706', createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, name: 'Other Income', type: 'income', icon: '🪙', isDefault: true, isActive: true, color: '#475569', createdAt: now, updatedAt: now }
      ];
      await userDb.finance_categories.bulkAdd(defaultCategories);
    }
  } catch (err) {
    console.error('Failed to initialize user workspace:', err);
  }
}

// Checks if legacy unmigrated data exists in 'TahirTrackerDB'
export async function checkLegacyDataExists(): Promise<{ hasLegacy: boolean; recordCount: number }> {
  if (typeof window === 'undefined') return { hasLegacy: false, recordCount: 0 };
  try {
    const exists = await Dexie.exists('TahirTrackerDB');
    if (!exists) return { hasLegacy: false, recordCount: 0 };
    
    // Check if already migrated
    const migratedTo = localStorage.getItem('tahir_tracker_legacy_migrated');
    if (migratedTo) return { hasLegacy: false, recordCount: 0 };

    const legacyDb = new TahirTrackerDB('TahirTrackerDB');
    let total = 0;
    total += await legacyDb.finance_transactions.count();
    total += await legacyDb.milk_logs.count();
    total += await legacyDb.petrol_refills.count();
    total += await legacyDb.rent_records.count();
    total += await legacyDb.utility_bills.count();
    total += await legacyDb.loans.count();
    total += await legacyDb.rent_portions.count();
    legacyDb.close();

    return { hasLegacy: total > 0, recordCount: total };
  } catch (_) {
    return { hasLegacy: false, recordCount: 0 };
  }
}

// Exports a safety backup JSON of legacy 'TahirTrackerDB' before migration
export async function exportLegacyDatabaseBackupJson(): Promise<string | null> {
  try {
    const legacyDb = new TahirTrackerDB('TahirTrackerDB');
    const data = {
      appName: 'Tahir Tracker (Pre-Migration Safety Backup)',
      version: 6,
      exportedAt: new Date().toISOString(),
      loans: await legacyDb.loans.toArray(),
      milk_consumers: await legacyDb.milk_consumers.toArray(),
      milk_logs: await legacyDb.milk_logs.toArray(),
      milk_monthly_records: await legacyDb.milk_monthly_records.toArray(),
      petrol_refills: await legacyDb.petrol_refills.toArray(),
      rent_properties: await legacyDb.rent_properties.toArray(),
      rent_portions: await legacyDb.rent_portions.toArray(),
      rent_records: await legacyDb.rent_records.toArray(),
      settings: await legacyDb.settings.toArray(),
      utility_persons: await legacyDb.utility_persons.toArray(),
      utility_bills: await legacyDb.utility_bills.toArray(),
      utility_payments: await legacyDb.utility_payments.toArray(),
      finance_accounts: await legacyDb.finance_accounts.toArray(),
      finance_categories: await legacyDb.finance_categories.toArray(),
      finance_transactions: await legacyDb.finance_transactions.toArray(),
      finance_budgets: await legacyDb.finance_budgets.toArray(),
      finance_recurring_transactions: await legacyDb.finance_recurring_transactions.toArray(),
      finance_goals: await legacyDb.finance_goals.toArray(),
      finance_voice_entries: await legacyDb.finance_voice_entries.toArray()
    };
    legacyDb.close();
    return JSON.stringify(data, null, 2);
  } catch (err) {
    console.error('Failed to export legacy backup:', err);
    return null;
  }
}

// Migrates Tahir's legacy local records strictly to verified owner account with pre-backup
export async function migrateLegacyDataToUser(targetUserId: string): Promise<{ success: boolean; migratedCount: number; error?: string }> {
  try {
    const backupJson = await exportLegacyDatabaseBackupJson();
    if (!backupJson) {
      return { success: false, migratedCount: 0, error: 'Could not export legacy safety backup' };
    }

    try {
      localStorage.setItem(`tahir_tracker_legacy_backup_snapshot_${targetUserId}`, backupJson);
    } catch (_) {}

    const legacyDb = new TahirTrackerDB('TahirTrackerDB');
    const userDb = switchUserDb(targetUserId);

    let count = 0;
    await userDb.transaction('rw', [
      userDb.loans, userDb.milk_consumers, userDb.milk_logs, userDb.milk_monthly_records,
      userDb.petrol_refills, userDb.rent_properties, userDb.rent_portions, userDb.rent_records,
      userDb.settings, userDb.utility_persons, userDb.utility_bills, userDb.utility_payments,
      userDb.finance_accounts, userDb.finance_categories, userDb.finance_transactions,
      userDb.finance_budgets, userDb.finance_recurring_transactions, userDb.finance_goals,
      userDb.finance_voice_entries
    ], async () => {
      const tables: Array<keyof TahirTrackerDB> = [
        'loans', 'milk_consumers', 'milk_logs', 'milk_monthly_records',
        'petrol_refills', 'rent_properties', 'rent_portions', 'rent_records',
        'settings', 'utility_persons', 'utility_bills', 'utility_payments',
        'finance_accounts', 'finance_categories', 'finance_transactions',
        'finance_budgets', 'finance_recurring_transactions', 'finance_goals',
        'finance_voice_entries'
      ];

      for (const tbl of tables) {
        const recs = await (legacyDb as any)[tbl].toArray();
        if (recs && recs.length > 0) {
          await (userDb as any)[tbl].bulkPut(recs);
          count += recs.length;
        }
      }
    });

    legacyDb.close();
    localStorage.setItem('tahir_tracker_legacy_migrated', targetUserId);
    return { success: true, migratedCount: count };
  } catch (err: any) {
    console.error('Migration failed:', err);
    return { success: false, migratedCount: 0, error: err?.message || 'Migration error' };
  }
}

// Backward-compatible initialization for test suites and existing callers
export async function initializeDefaultData(userId?: string) {
  if (userId || currentActiveUserId) {
    await initializeUserWorkspace(userId || currentActiveUserId!);
    return;
  }
  // Fallback for standalone/offline tests
  await initializeUserWorkspace('default_workspace');
}

// Validates structure and integrity of backup JSON before import
export function validateBackupJson(data: any): { isValid: boolean; error?: string; summary?: Record<string, number> } {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Backup data is not a valid JSON object.' };
  }

  // Version compatibility check
  if (data.version !== undefined && (typeof data.version !== 'number' || data.version > 6 || data.version < 1)) {
    return { isValid: false, error: `Unsupported backup schema version: ${data.version}. Current version is 6.` };
  }

  // Check that at least some valid Tahir Tracker table arrays exist
  const knownTables = [
    'loans', 'milk_consumers', 'milk_logs', 'milk_monthly_records',
    'petrol_refills', 'rent_properties', 'rent_portions', 'rent_records', 'settings',
    'utility_persons', 'utility_bills', 'utility_payments',
    'finance_accounts', 'finance_categories', 'finance_transactions',
    'finance_budgets', 'finance_recurring_transactions', 'finance_goals',
    'finance_voice_entries'
  ];

  const presentTables = knownTables.filter(t => Array.isArray(data[t]));
  if (presentTables.length === 0) {
    return { isValid: false, error: 'Backup JSON does not contain recognizable Tahir Tracker tables.' };
  }

  // Check for duplicate primary keys in each table to avoid unique constraint violations
  for (const t of presentTables) {
    const idSet = new Set<string>();
    for (const item of data[t]) {
      if (item && item.id) {
        if (idSet.has(item.id)) {
          return { isValid: false, error: `Duplicate primary key '${item.id}' found in table '${t}'.` };
        }
        idSet.add(item.id);
      }
    }
  }

  const summary: Record<string, number> = {};
  for (const t of presentTables) {
    summary[t] = data[t].length;
  }

  return { isValid: true, summary };
}

// Full DB JSON Export (sync_queue is safely excluded)
export async function exportDatabaseToJson(): Promise<string> {
  const data = {
    appName: 'Tahir Tracker',
    version: 6,
    exportedAt: new Date().toISOString(),
    loans: await db.loans.toArray(),
    milk_consumers: await db.milk_consumers.toArray(),
    milk_logs: await db.milk_logs.toArray(),
    milk_monthly_records: await db.milk_monthly_records.toArray(),
    petrol_refills: await db.petrol_refills.toArray(),
    rent_properties: await db.rent_properties.toArray(),
    rent_portions: await db.rent_portions.toArray(),
    rent_records: await db.rent_records.toArray(),
    settings: await db.settings.toArray(),
    utility_persons: await db.utility_persons.toArray(),
    utility_bills: await db.utility_bills.toArray(),
    utility_payments: await db.utility_payments.toArray(),
    // Finance module tables
    finance_accounts: await db.finance_accounts.toArray(),
    finance_categories: await db.finance_categories.toArray(),
    finance_transactions: await db.finance_transactions.toArray(),
    finance_budgets: await db.finance_budgets.toArray(),
    finance_recurring_transactions: await db.finance_recurring_transactions.toArray(),
    finance_goals: await db.finance_goals.toArray(),
    finance_voice_entries: await db.finance_voice_entries.toArray()
  };
  return JSON.stringify(data, null, 2);
}

// Full DB JSON Import with Pre-Validation
export async function importDatabaseFromJson(jsonString: string): Promise<boolean> {
  let data: any;
  try {
    data = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error(`Invalid JSON file format: ${err?.message || 'Parse error'}`);
  }

  // Pre-validate before touching any local tables
  const validation = validateBackupJson(data);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid backup data.');
  }

  try {
    await db.transaction('rw', [
      db.loans,
      db.milk_consumers,
      db.milk_logs,
      db.milk_monthly_records,
      db.petrol_refills,
      db.rent_properties,
      db.rent_portions,
      db.rent_records,
      db.settings,
      db.utility_persons,
      db.utility_bills,
      db.utility_payments,
      db.finance_accounts,
      db.finance_categories,
      db.finance_transactions,
      db.finance_budgets,
      db.finance_recurring_transactions,
      db.finance_goals,
      db.finance_voice_entries,
      db.sync_queue
    ], async () => {
      if (Array.isArray(data.loans)) {
        await db.loans.clear();
        await db.loans.bulkAdd(data.loans);
      }
      if (Array.isArray(data.milk_consumers)) {
        await db.milk_consumers.clear();
        await db.milk_consumers.bulkAdd(data.milk_consumers);
      }
      if (Array.isArray(data.milk_logs)) {
        await db.milk_logs.clear();
        await db.milk_logs.bulkAdd(data.milk_logs);
      }
      if (Array.isArray(data.milk_monthly_records)) {
        await db.milk_monthly_records.clear();
        await db.milk_monthly_records.bulkAdd(data.milk_monthly_records);
      }
      if (Array.isArray(data.petrol_refills)) {
        await db.petrol_refills.clear();
        await db.petrol_refills.bulkAdd(data.petrol_refills);
      }
      if (Array.isArray(data.rent_properties)) {
        await db.rent_properties.clear();
        await db.rent_properties.bulkAdd(data.rent_properties);
      }
      if (Array.isArray(data.rent_portions)) {
        await db.rent_portions.clear();
        await db.rent_portions.bulkAdd(data.rent_portions);
      }
      if (Array.isArray(data.rent_records)) {
        await db.rent_records.clear();
        await db.rent_records.bulkAdd(data.rent_records);
      }
      if (Array.isArray(data.settings) && data.settings.length > 0) {
        await db.settings.clear();
        await db.settings.bulkAdd(data.settings);
      }
      if (Array.isArray(data.utility_persons)) {
        await db.utility_persons.clear();
        await db.utility_persons.bulkAdd(data.utility_persons);
      }
      if (Array.isArray(data.utility_bills)) {
        await db.utility_bills.clear();
        await db.utility_bills.bulkAdd(data.utility_bills);
      }
      if (Array.isArray(data.utility_payments)) {
        await db.utility_payments.clear();
        await db.utility_payments.bulkAdd(data.utility_payments);
      }
      // Finance tables
      if (Array.isArray(data.finance_accounts)) {
        await db.finance_accounts.clear();
        await db.finance_accounts.bulkAdd(data.finance_accounts);
      }
      if (Array.isArray(data.finance_categories)) {
        await db.finance_categories.clear();
        await db.finance_categories.bulkAdd(data.finance_categories);
      }
      if (Array.isArray(data.finance_transactions)) {
        await db.finance_transactions.clear();
        await db.finance_transactions.bulkAdd(data.finance_transactions);
      }
      if (Array.isArray(data.finance_budgets)) {
        await db.finance_budgets.clear();
        await db.finance_budgets.bulkAdd(data.finance_budgets);
      }
      if (Array.isArray(data.finance_recurring_transactions)) {
        await db.finance_recurring_transactions.clear();
        await db.finance_recurring_transactions.bulkAdd(data.finance_recurring_transactions);
      }
      if (Array.isArray(data.finance_goals)) {
        await db.finance_goals.clear();
        await db.finance_goals.bulkAdd(data.finance_goals);
      }
      if (Array.isArray(data.finance_voice_entries)) {
        await db.finance_voice_entries.clear();
        await db.finance_voice_entries.bulkAdd(data.finance_voice_entries);
      }
      // Stale sync queues from backups must NEVER be replayed to cloud.
      // Always purge the local queue upon restoring an authoritative snapshot.
      await db.sync_queue.clear();
    });
    return true;
  } catch (err: any) {
    console.error('Import failed:', err);
    throw new Error(`Database restore error: ${err?.message || 'Transaction aborted'}`);
  }
}

// Reset Database to Defaults
export async function resetDatabaseToDefaults(): Promise<void> {
  await db.loans.clear();
  await db.milk_consumers.clear();
  await db.milk_logs.clear();
  await db.milk_monthly_records.clear();
  await db.petrol_refills.clear();
  await db.rent_properties.clear();
  await db.rent_portions.clear();
  await db.rent_records.clear();
  await db.settings.clear();
  await db.utility_persons.clear();
  await db.utility_bills.clear();
  await db.utility_payments.clear();
  await db.finance_accounts.clear();
  await db.finance_categories.clear();
  await db.finance_transactions.clear();
  await db.finance_budgets.clear();
  await db.finance_recurring_transactions.clear();
  await db.finance_goals.clear();
  await db.finance_voice_entries.clear();
  await db.sync_queue.clear();
  await initializeDefaultData();
}
