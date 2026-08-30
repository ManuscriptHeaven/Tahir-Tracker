import Dexie, { Table } from 'dexie';
import {
  LoanTransaction,
  MilkConsumer,
  MilkDailyLog,
  PetrolRefill,
  RentPortion,
  RentMonthlyRecord,
  AppSettings,
  UtilityPerson,
  UtilityBill,
  UtilityPayment
} from '../types';

export class TahirTrackerDB extends Dexie {
  loans!: Table<LoanTransaction, string>;
  milk_consumers!: Table<MilkConsumer, string>;
  milk_logs!: Table<MilkDailyLog, string>;
  petrol_refills!: Table<PetrolRefill, string>;
  rent_portions!: Table<RentPortion, string>;
  rent_records!: Table<RentMonthlyRecord, string>;
  settings!: Table<AppSettings, number>;
  utility_persons!: Table<UtilityPerson, string>;
  utility_bills!: Table<UtilityBill, string>;
  utility_payments!: Table<UtilityPayment, string>;

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
  }
}

export const db = new TahirTrackerDB();

// Default seed data initialization
export async function initializeDefaultData() {
  try {
    const consumersCount = await db.milk_consumers.count();
    if (consumersCount === 0) {
      const now = new Date().toISOString();
      const defaultConsumers: MilkConsumer[] = [
        { id: 'c1', name: 'Saleem', defaultDailyKg: 1, active: true, createdAt: now },
        { id: 'c2', name: 'Tayyab', defaultDailyKg: 3, active: true, createdAt: now },
        { id: 'c3', name: 'Chand', defaultDailyKg: 3, active: true, createdAt: now },
      ];
      await db.milk_consumers.bulkAdd(defaultConsumers);

      // Seed sample milk logs for August 2026
      const sampleMilkLogs: MilkDailyLog[] = [
        // 1 Aug
        { id: '2026-08-01_c1', date: '2026-08-01', consumerId: 'c1', consumerName: 'Saleem', status: 'supplied', actualKg: 1, ratePerKg: 260 },
        { id: '2026-08-01_c2', date: '2026-08-01', consumerId: 'c2', consumerName: 'Tayyab', status: 'supplied', actualKg: 3, ratePerKg: 260 },
        { id: '2026-08-01_c3', date: '2026-08-01', consumerId: 'c3', consumerName: 'Chand', status: 'supplied', actualKg: 3, ratePerKg: 260 },
        // 2 Aug
        { id: '2026-08-02_c1', date: '2026-08-02', consumerId: 'c1', consumerName: 'Saleem', status: 'missed', actualKg: 0, ratePerKg: 260 },
        { id: '2026-08-02_c2', date: '2026-08-02', consumerId: 'c2', consumerName: 'Tayyab', status: 'supplied', actualKg: 3, ratePerKg: 260 },
        { id: '2026-08-02_c3', date: '2026-08-02', consumerId: 'c3', consumerName: 'Chand', status: 'supplied', actualKg: 3, ratePerKg: 260 },
        // 3 Aug
        { id: '2026-08-03_c1', date: '2026-08-03', consumerId: 'c1', consumerName: 'Saleem', status: 'supplied', actualKg: 1, ratePerKg: 260 },
        { id: '2026-08-03_c2', date: '2026-08-03', consumerId: 'c2', consumerName: 'Tayyab', status: 'missed', actualKg: 0, ratePerKg: 260 },
        { id: '2026-08-03_c3', date: '2026-08-03', consumerId: 'c3', consumerName: 'Chand', status: 'supplied', actualKg: 3, ratePerKg: 260 },
      ];
      await db.milk_logs.bulkAdd(sampleMilkLogs);
    }

    const portionsCount = await db.rent_portions.count();
    if (portionsCount === 0) {
      const now = new Date().toISOString();
      const defaultPortions: RentPortion[] = [
        { id: 'p1', portionName: 'Portion 1', tenantName: 'Tenant 1', tenantPhone: '0300-1111111', expectedRent: 10000, dueDay: 10, active: true, createdAt: now },
        { id: 'p2', portionName: 'Portion 2', tenantName: 'Tenant 2', tenantPhone: '0300-2222222', expectedRent: 10000, dueDay: 10, active: true, createdAt: now },
        { id: 'p3', portionName: 'Portion 3', tenantName: 'Tenant 3', tenantPhone: '0300-3333333', expectedRent: 10000, dueDay: 10, active: true, createdAt: now },
        { id: 'p4', portionName: 'Portion 4', tenantName: 'Tenant 4', tenantPhone: '0300-4444444', expectedRent: 10000, dueDay: 10, active: true, createdAt: now },
      ];
      await db.rent_portions.bulkAdd(defaultPortions);

      // Seed rent records for August 2026 matching specs (Portion 1, 2, 3 Paid, Portion 4 Pending)
      const sampleRentRecords: RentMonthlyRecord[] = [
        {
          id: '2026-08_p1',
          portionId: 'p1',
          portionName: 'Portion 1',
          tenantName: 'Tenant 1',
          monthYear: '2026-08',
          expectedAmount: 10000,
          paidAmount: 10000,
          status: 'paid',
          paymentDate: '2026-08-05',
          paymentMethod: 'Cash',
          notes: 'Full payment received',
          updatedAt: now
        },
        {
          id: '2026-08_p2',
          portionId: 'p2',
          portionName: 'Portion 2',
          tenantName: 'Tenant 2',
          monthYear: '2026-08',
          expectedAmount: 10000,
          paidAmount: 10000,
          status: 'paid',
          paymentDate: '2026-08-08',
          paymentMethod: 'Bank Transfer',
          notes: 'Received via JazzCash',
          updatedAt: now
        },
        {
          id: '2026-08_p3',
          portionId: 'p3',
          portionName: 'Portion 3',
          tenantName: 'Tenant 3',
          monthYear: '2026-08',
          expectedAmount: 10000,
          paidAmount: 10000,
          status: 'paid',
          paymentDate: '2026-08-10',
          paymentMethod: 'Cash',
          notes: 'Paid on due date',
          updatedAt: now
        },
        {
          id: '2026-08_p4',
          portionId: 'p4',
          portionName: 'Portion 4',
          tenantName: 'Tenant 4',
          monthYear: '2026-08',
          expectedAmount: 10000,
          paidAmount: 0,
          status: 'pending',
          paymentDate: undefined,
          notes: 'Due by 10th August',
          updatedAt: now
        }
      ];
      await db.rent_records.bulkAdd(sampleRentRecords);
    }

    const loansCount = await db.loans.count();
    if (loansCount === 0) {
      const now = new Date().toISOString();
      const sampleLoans: LoanTransaction[] = [
        {
          id: 'loan_1',
          personName: 'Ali',
          personPhone: '0312-3456789',
          type: 'given',
          principalAmount: 30000,
          date: '2026-08-01',
          dueDate: '2026-09-01',
          notes: 'Personal loan for home renovation',
          status: 'active',
          payments: [
            {
              id: 'pay_1',
              amount: 10000,
              date: '2026-08-15',
              note: 'First installment received',
              createdAt: now
            }
          ],
          createdAt: now
        },
        {
          id: 'loan_2',
          personName: 'Ahmed',
          personPhone: '0321-9876543',
          type: 'given',
          principalAmount: 20000,
          date: '2026-08-05',
          dueDate: '2026-08-30',
          notes: 'Short term loan',
          status: 'active',
          payments: [
            {
              id: 'pay_2',
              amount: 10000,
              date: '2026-08-20',
              note: 'Partial payment',
              createdAt: now
            }
          ],
          createdAt: now
        }
      ];
      await db.loans.bulkAdd(sampleLoans);
    }

    const petrolCount = await db.petrol_refills.count();
    if (petrolCount === 0) {
      const now = new Date().toISOString();
      const samplePetrol: PetrolRefill[] = [
        {
          id: 'pet_1',
          date: '2026-08-01',
          odometerReading: 12000,
          litres: 10,
          pricePerLitre: 270,
          totalCost: 2700,
          distanceTravelled: 0,
          mileageKmpl: 0,
          costPerKm: 0,
          notes: 'Base fill-up',
          createdAt: now
        },
        {
          id: 'pet_2',
          date: '2026-08-10',
          odometerReading: 12410,
          litres: 14,
          pricePerLitre: 270,
          totalCost: 3780,
          distanceTravelled: 410,
          mileageKmpl: 29.28,
          costPerKm: 9.22,
          notes: 'City ride',
          createdAt: now
        },
        {
          id: 'pet_3',
          date: '2026-08-18',
          odometerReading: 12830,
          litres: 14,
          pricePerLitre: 270,
          totalCost: 3780,
          distanceTravelled: 420,
          mileageKmpl: 30.00,
          costPerKm: 9.00,
          notes: 'Office commute',
          createdAt: now
        },
        {
          id: 'pet_4',
          date: '2026-08-24',
          odometerReading: 13240,
          litres: 14,
          pricePerLitre: 270,
          totalCost: 3780,
          distanceTravelled: 410,
          mileageKmpl: 29.28,
          costPerKm: 9.22,
          notes: 'Highway & City',
          createdAt: now
        }
      ];
      await db.petrol_refills.bulkAdd(samplePetrol);
    }

    const settingsCount = await db.settings.count();
    if (settingsCount === 0) {
      await db.settings.add({
        currency: 'PKR',
        milkDefaultRate: 260,
        rentDueDayDefault: 10,
        theme: 'light'
      });
    }

    // Seed Utility Persons and Bills
    const utilityPersonsCount = await db.utility_persons.count();
    if (utilityPersonsCount === 0) {
      const now = new Date().toISOString();
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

    const utilityBillsCount = await db.utility_bills.count();
    if (utilityBillsCount === 0) {
      const now = new Date().toISOString();
      // Reference sample records from Oct 2025 - Mar 2026 + August 2026 current month
      const sampleUtilityBills: UtilityBill[] = [
        {
          id: 'ub_2026_08_saleem',
          personId: 'p_saleem',
          month: 8,
          year: 2026,
          monthYear: '2026-08',
          electricity: 7500,
          gas: 5200,
          water: 1550,
          saleemWaterGasShare: 2250,
          totalBill: 9750,
          expectedContribution: 9500,
          notes: 'August 2026 utility bill statement',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'ub_2025_10_saleem',
          personId: 'p_saleem',
          month: 10,
          year: 2025,
          monthYear: '2025-10',
          electricity: 16092,
          gas: 5220,
          water: 1550,
          saleemWaterGasShare: 2257,
          totalBill: 18349,
          expectedContribution: 9500,
          notes: 'Reference bill sample Oct 2025',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'ub_2025_11_saleem',
          personId: 'p_saleem',
          month: 11,
          year: 2025,
          monthYear: '2025-11',
          electricity: 5069,
          gas: 5470,
          water: 1550,
          saleemWaterGasShare: 2340,
          totalBill: 7409,
          expectedContribution: 9500,
          notes: 'Reference bill sample Nov 2025',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'ub_2025_12_saleem',
          personId: 'p_saleem',
          month: 12,
          year: 2025,
          monthYear: '2025-12',
          electricity: 2369,
          gas: 6000,
          water: 1550,
          saleemWaterGasShare: 2517,
          totalBill: 4886,
          expectedContribution: 9500,
          notes: 'Reference bill sample Dec 2025',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'ub_2026_01_saleem',
          personId: 'p_saleem',
          month: 1,
          year: 2026,
          monthYear: '2026-01',
          electricity: 2425,
          gas: 15800,
          water: 1550,
          saleemWaterGasShare: 5783,
          totalBill: 8208,
          expectedContribution: 9500,
          notes: 'Reference bill sample Jan 2026',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'ub_2026_02_saleem',
          personId: 'p_saleem',
          month: 2,
          year: 2026,
          monthYear: '2026-02',
          electricity: 2231,
          gas: 4250,
          water: 1550,
          saleemWaterGasShare: 1933,
          totalBill: 4164,
          expectedContribution: 9500,
          notes: 'Reference bill sample Feb 2026',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'ub_2026_03_saleem',
          personId: 'p_saleem',
          month: 3,
          year: 2026,
          monthYear: '2026-03',
          electricity: 7043,
          gas: 5360,
          water: 1550,
          saleemWaterGasShare: 2303,
          totalBill: 9346,
          expectedContribution: 9500,
          notes: 'Reference bill sample Mar 2026',
          createdAt: now,
          updatedAt: now
        }
      ];
      await db.utility_bills.bulkAdd(sampleUtilityBills);

      const utilityPaymentsCount = await db.utility_payments.count();
      if (utilityPaymentsCount === 0) {
        const samplePayments: UtilityPayment[] = [
          // Default 9,500 PKR monthly contributions for each month
          {
            id: 'pay_2025_10_def',
            utilityBillId: 'ub_2025_10_saleem',
            personId: 'p_saleem',
            paymentDate: '2025-10-10',
            amount: 9500,
            note: 'Default Monthly Contribution',
            createdAt: now,
            updatedAt: now
          },
          {
            id: 'pay_2025_11_def',
            utilityBillId: 'ub_2025_11_saleem',
            personId: 'p_saleem',
            paymentDate: '2025-11-10',
            amount: 9500,
            note: 'Default Monthly Contribution',
            createdAt: now,
            updatedAt: now
          },
          {
            id: 'pay_2025_12_def',
            utilityBillId: 'ub_2025_12_saleem',
            personId: 'p_saleem',
            paymentDate: '2025-12-10',
            amount: 9500,
            note: 'Default Monthly Contribution',
            createdAt: now,
            updatedAt: now
          },
          {
            id: 'pay_2026_01_def',
            utilityBillId: 'ub_2026_01_saleem',
            personId: 'p_saleem',
            paymentDate: '2026-01-10',
            amount: 9500,
            note: 'Default Monthly Contribution',
            createdAt: now,
            updatedAt: now
          },
          {
            id: 'pay_2026_02_def',
            utilityBillId: 'ub_2026_02_saleem',
            personId: 'p_saleem',
            paymentDate: '2026-02-10',
            amount: 9500,
            note: 'Default Monthly Contribution',
            createdAt: now,
            updatedAt: now
          },
          {
            id: 'pay_2026_03_def',
            utilityBillId: 'ub_2026_03_saleem',
            personId: 'p_saleem',
            paymentDate: '2026-03-10',
            amount: 9500,
            note: 'Default Monthly Contribution',
            createdAt: now,
            updatedAt: now
          },
          {
            id: 'pay_2026_08_def',
            utilityBillId: 'ub_2026_08_saleem',
            personId: 'p_saleem',
            paymentDate: '2026-08-10',
            amount: 9500,
            note: 'Default Monthly Contribution',
            createdAt: now,
            updatedAt: now
          }
        ];
        await db.utility_payments.bulkAdd(samplePayments);
      }
    }

    // Auto-ensure: Every utility bill in database has at least the default 9,500 PKR base contribution
    const allBills = await db.utility_bills.toArray();
    const currentTimestamp = new Date().toISOString();
    for (const bill of allBills) {
      const existingPayments = await db.utility_payments
        .filter(p => p.utilityBillId === bill.id)
        .toArray();
      if (existingPayments.length === 0) {
        await db.utility_payments.add({
          id: `pay_${bill.id}_base_${Date.now()}`,
          utilityBillId: bill.id,
          personId: bill.personId,
          paymentDate: `${bill.monthYear}-10`,
          amount: 9500,
          note: 'Default Monthly Contribution',
          createdAt: currentTimestamp,
          updatedAt: currentTimestamp
        });
      }
    }
  } catch (err) {
    console.error('Failed to initialize default data:', err);
  }
}

// Full DB JSON Export
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
    exportedAt: new Date().toISOString(),
    version: 2
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
      db.utility_payments
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
    });
    return true;
  } catch (err) {
    console.error('Import failed:', err);
    throw err;
  }
}

// Reset Database to Demo state
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
  await initializeDefaultData();
}
