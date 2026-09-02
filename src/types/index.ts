export type NavTab = 'dashboard' | 'finance' | 'utility' | 'loans' | 'milk' | 'petrol' | 'rent' | 'reports' | 'settings';

export * from './finance';

export interface UtilityPerson {
  id: string;
  name: string;
  monthlyExpectedContribution: number; // Default e.g. 9500 PKR
  currency: string; // Default 'PKR'
  createdAt: string;
  updatedAt: string;
}

export interface UtilityBill {
  id: string;
  personId: string;
  month: number; // 1-12
  year: number; // e.g. 2025, 2026
  monthYear: string; // YYYY-MM
  electricity: number;
  gas: number;
  water: number;
  saleemWaterGasShare: number;
  totalBill: number; // Saleem's total bill payable
  expectedContribution: number; // Snapshot of person's monthly expected contribution
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UtilityPayment {
  id: string;
  utilityBillId: string;
  personId: string;
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanPayment {
  id: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: string;
}

export interface LoanTransaction {
  id: string;
  personName: string;
  personPhone?: string;
  type: 'given' | 'taken'; // 'given' = You gave money to them (They owe you), 'taken' = You took money (You owe them)
  principalAmount: number;
  date: string;
  dueDate?: string;
  notes?: string;
  status: 'active' | 'completed';
  payments: LoanPayment[];
  createdAt: string;
}

export interface PersonLoanGroup {
  personName: string;
  personPhone?: string;
  totalGiven: number;
  totalGivenReceived: number;
  totalGivenRemaining: number;
  totalTaken: number;
  totalTakenRepaid: number;
  totalTakenRemaining: number;
  netBalance: number; // Positive = Person owes user, Negative = User owes Person
  transactions: LoanTransaction[];
}

export interface MilkConsumer {
  id: string;
  name: string;
  defaultDailyKg: number;
  active: boolean;
  createdAt: string;
}

export interface MilkDailyLog {
  id: string; // e.g. `${date}_${consumerId}`
  date: string; // YYYY-MM-DD
  consumerId: string;
  consumerName: string;
  status: 'supplied' | 'missed' | 'custom';
  actualKg: number;
  ratePerKg: number;
  notes?: string;
}

export interface PetrolRefill {
  id: string;
  date: string; // YYYY-MM-DD
  odometerReading: number; // KM
  litres: number; // Litres
  pricePerLitre: number; // PKR
  totalCost: number; // PKR
  distanceTravelled: number; // KM calculated
  mileageKmpl: number; // KM/L calculated
  costPerKm: number; // PKR/KM calculated
  notes?: string;
  createdAt: string;
}

export interface RentPortion {
  id: string;
  portionName: string; // e.g. "Portion 1"
  tenantName: string;
  tenantPhone?: string;
  expectedRent: number; // e.g. 10000 PKR
  dueDay: number; // e.g. 10
  initialArrears?: number; // Opening / past arrears for this portion
  active: boolean;
  createdAt: string;
}

export interface RentMonthlyRecord {
  id: string; // e.g. `${monthYear}_${portionId}`
  portionId: string;
  portionName: string;
  tenantName: string;
  monthYear: string; // YYYY-MM
  expectedAmount: number;
  arrearsAmount?: number; // Specific or adjusted arrears for this month
  paidAmount: number;
  status: 'paid' | 'pending' | 'partially_paid' | 'overdue';
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
  updatedAt: string;
}

export interface AppSettings {
  id?: number;
  currency: string; // Default 'PKR'
  milkDefaultRate: number; // Default 260
  rentDueDayDefault: number; // Default 10
  theme: 'light' | 'dark' | 'system';
  lastBackupDate?: string;
}
