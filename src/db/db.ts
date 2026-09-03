import Dexie, { Table } from 'dexie';
import {
  LoanTransaction,
  MilkConsumer,
  MilkDailyLog,
  MilkMonthlyRecord,
  PetrolRefill,
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
} from '../types';

export class TahirTrackerDB extends Dexie {
  loans!: Table<LoanTransaction, string>;
  milk_consumers!: Table<MilkConsumer, string>;
  milk_logs!: Table<MilkDailyLog, string>;
  milk_monthly_records!: Table<MilkMonthlyRecord, string>;
  petrol_refills!: Table<PetrolRefill, string>;
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

  constructor() {
    super('TahirTrackerDB');
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
  }
}

export const db = new TahirTrackerDB();

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

// Purge any legacy sample/dummy data from previous installations
export async function cleanupLegacyDummyData(): Promise<void> {
  try {
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

    // Reset fake opening balances on default accounts if they were set to the old dummy numbers
    const accounts = await db.finance_accounts.toArray();
    for (const acc of accounts) {
      if (
        (acc.id === 'acc_cash' && acc.openingBalance === 25000) ||
        (acc.id === 'acc_hbl' && acc.openingBalance === 350000) ||
        (acc.id === 'acc_easypaisa' && acc.openingBalance === 15000) ||
        (acc.id === 'acc_savings' && acc.openingBalance === 500000)
      ) {
        await db.finance_accounts.update(acc.id, { openingBalance: 0 });
      }
    }
  } catch (err) {
    console.error('Failed to cleanup legacy dummy data:', err);
  }
}

// Default seed data initialization (No dummy transactions/logs)
export async function initializeDefaultData() {
  const now = new Date().toISOString();

  try {
    // 1. Settings (Default config)
    const settingsCount = await db.settings.count();
    if (settingsCount === 0) {
      await db.settings.add({
        currency: 'PKR',
        milkDefaultRate: 260,
        rentDueDayDefault: 10,
        theme: 'light'
      });
    }

    // 2. Milk Consumers (Configured household members)
    const consumersCount = await db.milk_consumers.count();
    if (consumersCount === 0) {
      const defaultConsumers: MilkConsumer[] = [
        { id: 'c1', name: 'Saleem', defaultDailyKg: 1, active: true, createdAt: now },
        { id: 'c2', name: 'Tayyab', defaultDailyKg: 3, active: true, createdAt: now },
        { id: 'c3', name: 'Chand', defaultDailyKg: 3, active: true, createdAt: now },
      ];
      await db.milk_consumers.bulkAdd(defaultConsumers);
    }
    // (NO DUMMY MILK LOGS SEEDED)

    // 3. Utility Persons (Configured household contributor)
    const utilityPersonsCount = await db.utility_persons.count();
    if (utilityPersonsCount === 0) {
      const saleemPerson: UtilityPerson = {
        id: 'p_saleem',
        name: 'Saleem',
        monthlyExpectedContribution: 9500,
        currency: 'PKR',
        createdAt: now,
        updatedAt: now
      };
      await db.utility_persons.add(saleemPerson);
    }
    // (NO DUMMY UTILITY BILLS OR PAYMENTS SEEDED)

    // 4. Finance Accounts (Standard accounts with 0 initial opening balance)
    const accountsCount = await db.finance_accounts.count();
    if (accountsCount === 0) {
      const defaultAccounts: FinanceAccount[] = [
        {
          id: 'acc_cash',
          name: 'Cash Wallet',
          accountType: 'cash',
          openingBalance: 0,
          currency: 'PKR',
          isActive: true,
          institution: 'Cash In Hand',
          icon: '💵',
          color: 'emerald',
          notes: 'Daily pocket and physical cash',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'acc_hbl',
          name: 'HBL Account',
          accountType: 'bank',
          openingBalance: 0,
          currency: 'PKR',
          isActive: true,
          institution: 'Habib Bank Limited',
          accountNumber: '',
          icon: '🏦',
          color: 'blue',
          notes: 'Primary bank account',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'acc_easypaisa',
          name: 'Easypaisa',
          accountType: 'digital_wallet',
          openingBalance: 0,
          currency: 'PKR',
          isActive: true,
          institution: 'Telenor Bank',
          icon: '📱',
          color: 'teal',
          notes: 'Digital mobile wallet',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'acc_credit_card',
          name: 'Credit Card',
          accountType: 'credit_card',
          openingBalance: 0,
          currency: 'PKR',
          isActive: true,
          institution: 'Credit Card',
          accountNumber: '',
          icon: '💳',
          color: 'indigo',
          notes: 'Monthly billing cycle',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'acc_savings',
          name: 'Savings Account',
          accountType: 'savings',
          openingBalance: 0,
          currency: 'PKR',
          isActive: true,
          institution: 'Savings Account',
          accountNumber: '',
          icon: '🐷',
          color: 'purple',
          notes: 'Savings reserve fund',
          createdAt: now,
          updatedAt: now
        }
      ];
      await db.finance_accounts.bulkAdd(defaultAccounts);
    }

    // 5. Finance Categories (Standard master categories)
    const categoriesCount = await db.finance_categories.count();
    if (categoriesCount === 0) {
      const defaultCategories: FinanceCategory[] = [
        // Expense Categories
        { id: 'cat_food', name: 'Food & Dining', type: 'expense', icon: '🍔', isDefault: true, isActive: true, color: '#f97316', createdAt: now, updatedAt: now },
        { id: 'cat_groceries', name: 'Groceries', type: 'expense', icon: '🛒', isDefault: true, isActive: true, color: '#10b981', createdAt: now, updatedAt: now },
        { id: 'cat_transport', name: 'Transportation', type: 'expense', icon: '🚗', isDefault: true, isActive: true, color: '#3b82f6', createdAt: now, updatedAt: now },
        { id: 'cat_home', name: 'Home & Housing', type: 'expense', icon: '🏠', isDefault: true, isActive: true, color: '#8b5cf6', createdAt: now, updatedAt: now },
        { id: 'cat_utilities', name: 'Bills & Utilities', type: 'expense', icon: '💡', isDefault: true, isActive: true, color: '#eab308', createdAt: now, updatedAt: now },
        { id: 'cat_shopping', name: 'Shopping', type: 'expense', icon: '🛍️', isDefault: true, isActive: true, color: '#ec4899', createdAt: now, updatedAt: now },
        { id: 'cat_entertainment', name: 'Entertainment', type: 'expense', icon: '🎬', isDefault: true, isActive: true, color: '#6366f1', createdAt: now, updatedAt: now },
        { id: 'cat_health', name: 'Health & Fitness', type: 'expense', icon: '🏥', isDefault: true, isActive: true, color: '#ef4444', createdAt: now, updatedAt: now },
        { id: 'cat_family', name: 'Family & Gifts', type: 'expense', icon: '🎁', isDefault: true, isActive: true, color: '#f43f5e', createdAt: now, updatedAt: now },
        { id: 'cat_travel', name: 'Travel', type: 'expense', icon: '✈️', isDefault: true, isActive: true, color: '#06b6d4', createdAt: now, updatedAt: now },
        { id: 'cat_business_exp', name: 'Business Expense', type: 'expense', icon: '💼', isDefault: true, isActive: true, color: '#64748b', createdAt: now, updatedAt: now },
        { id: 'cat_education', name: 'Education', type: 'expense', icon: '📚', isDefault: true, isActive: true, color: '#14b8a6', createdAt: now, updatedAt: now },
        { id: 'cat_other_exp', name: 'Other Expense', type: 'expense', icon: '📦', isDefault: true, isActive: true, color: '#94a3b8', createdAt: now, updatedAt: now },

        // Income Categories
        { id: 'cat_salary', name: 'Salary', type: 'income', icon: '💵', isDefault: true, isActive: true, color: '#10b981', createdAt: now, updatedAt: now },
        { id: 'cat_business_inc', name: 'Business Income', type: 'income', icon: '💼', isDefault: true, isActive: true, color: '#059669', createdAt: now, updatedAt: now },
        { id: 'cat_client_pay', name: 'Client Payment', type: 'income', icon: '💳', isDefault: true, isActive: true, color: '#0284c7', createdAt: now, updatedAt: now },
        { id: 'cat_freelance', name: 'Freelancing', type: 'income', icon: '💻', isDefault: true, isActive: true, color: '#7c3aed', createdAt: now, updatedAt: now },
        { id: 'cat_investment', name: 'Investment Return', type: 'income', icon: '📈', isDefault: true, isActive: true, color: '#16a34a', createdAt: now, updatedAt: now },
        { id: 'cat_rental_inc', name: 'Rental Income', type: 'income', icon: '🏠', isDefault: true, isActive: true, color: '#d97706', createdAt: now, updatedAt: now },
        { id: 'cat_gift_inc', name: 'Gift Received', type: 'income', icon: '🎁', isDefault: true, isActive: true, color: '#db2777', createdAt: now, updatedAt: now },
        { id: 'cat_other_inc', name: 'Other Income', type: 'income', icon: '🪙', isDefault: true, isActive: true, color: '#475569', createdAt: now, updatedAt: now },
      ];
      await db.finance_categories.bulkAdd(defaultCategories);
    }

    // 6. Purge any legacy dummy records from existing IndexedDB storage
    await cleanupLegacyDummyData();

  } catch (err) {
    console.error('Failed to initialize default data:', err);
  }
}

// Full DB JSON Export (Supports Household + Finance)
export async function exportDatabaseToJson(): Promise<string> {
  const data = {
    loans: await db.loans.toArray(),
    milk_consumers: await db.milk_consumers.toArray(),
    milk_logs: await db.milk_logs.toArray(),
    petrol_refills: await db.petrol_refills.toArray(),
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
    finance_voice_entries: await db.finance_voice_entries.toArray(),
    exportedAt: new Date().toISOString(),
    version: 3
  };
  return JSON.stringify(data, null, 2);
}

// Full DB JSON Import
export async function importDatabaseFromJson(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') throw new Error('Invalid JSON');

    await db.transaction('rw', [
      db.loans,
      db.milk_consumers,
      db.milk_logs,
      db.petrol_refills,
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
      db.finance_voice_entries
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
      if (Array.isArray(data.petrol_refills)) {
        await db.petrol_refills.clear();
        await db.petrol_refills.bulkAdd(data.petrol_refills);
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
    });
    return true;
  } catch (err) {
    console.error('Import failed:', err);
    throw err;
  }
}

// Reset Database to Defaults
export async function resetDatabaseToDefaults(): Promise<void> {
  await db.loans.clear();
  await db.milk_consumers.clear();
  await db.milk_logs.clear();
  await db.petrol_refills.clear();
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
  await initializeDefaultData();
}
