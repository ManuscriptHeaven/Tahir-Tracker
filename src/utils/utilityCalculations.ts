import { UtilityBill, UtilityPayment } from '../types';

/**
 * UTILITY BILL CALCULATION — EXACT FORMULA
 * 
 * 1. Electricity: 100% (Electricity Share = Electricity Amount)
 * 2. Gas + Water: (Gas Amount + Water Amount) / 3
 * 3. Saleem Total Bill: Electricity Amount + ((Gas Amount + Water Amount) / 3)
 */

/**
 * Calculates Gas + Water share for a person (1/3 of total Gas + Water)
 */
export function calculateGasWaterShare(gas: number, water: number): number {
  const g = Math.max(0, gas || 0);
  const w = Math.max(0, water || 0);
  return (g + w) / 3;
}

/**
 * Calculates Saleem's total monthly payable utility bill:
 * Electricity + ((Gas + Water) / 3)
 */
export function calculateSaleemTotalBill(electricity: number, gas: number, water: number): number {
  const e = Math.max(0, electricity || 0);
  const share = calculateGasWaterShare(gas, water);
  return e + share;
}

/**
 * Helper to determine who owes whom for a single monthly record:
 * - If Total Bill > Total Paid: Saleem owes Tahir (Saleem ne Tahir ko dene hain)
 * - If Total Paid > Total Bill: Tahir owes Saleem (Tahir ne Saleem ko wapis dene hain / Advance)
 * - If Total Paid == Total Bill: Settled (0 PKR)
 */
export interface MonthlyBalanceDetail {
  difference: number;
  owesType: 'saleem_owes_tahir' | 'tahir_owes_saleem' | 'settled';
  label: string;
}

export function getMonthlyBalanceDetail(totalBill: number, totalPaid: number, personName: string = 'Saleem'): MonthlyBalanceDetail {
  const bill = Math.round(totalBill);
  const paid = Math.round(totalPaid);
  const diff = bill - paid;

  if (diff > 0) {
    return {
      difference: diff,
      owesType: 'saleem_owes_tahir',
      label: `${personName} owes Tahir`
    };
  } else if (diff < 0) {
    return {
      difference: Math.abs(diff),
      owesType: 'tahir_owes_saleem',
      label: `Tahir owes ${personName}`
    };
  } else {
    return {
      difference: 0,
      owesType: 'settled',
      label: 'Fully Settled'
    };
  }
}

/**
 * Returns payment status based on total bill and total paid
 */
export function getUtilityPaymentStatus(
  totalBill: number,
  totalPaid: number
): 'paid' | 'partially_paid' | 'pending' | 'overpaid' {
  const bill = Math.round(totalBill);
  const paid = Math.round(totalPaid);

  if (paid === 0) return 'pending';
  if (paid > bill) return 'overpaid';
  if (paid === bill) return 'paid';
  return 'partially_paid';
}

/**
 * CENTRALIZED UTILITY NET BALANCE CALCULATION
 * 
 * Logic requested by user:
 * - Saleem Total Bills = Sum of (Electricity + (Gas + Water) / 3)
 * - Total Received = Sum of all payments received (Default 9,500 + Extra payments)
 * - If Total Bills > Total Received: Saleem owes Tahir the difference
 * - If Total Received > Total Bills: Tahir owes Saleem the difference
 */
export interface UtilityNetBalanceSummary {
  totalSaleemTotalBills: number; // Sum of Saleem's total bills payable (Electricity + (Gas+Water)/3)
  totalSaleemShare: number; // Sum of Water + Gas shares (1/3 of Gas+Water)
  totalExpectedContribution: number; // Sum of monthly expected contributions (e.g. 9,500 * months)
  totalReceivedAmount: number; // Sum of all recorded payments
  totalSaleemOwesTahir: number; // Sum of outstanding unpaid amounts where Bill > Paid
  totalTahirOwesSaleem: number; // Sum of excess amounts where Paid > Bill
  netDifference: number; // Absolute difference
  netStatus: 'saleem_owes_tahir' | 'tahir_owes_saleem' | 'settled';
}

export function calculateUtilityNetBalance(
  bills: UtilityBill[],
  payments: UtilityPayment[]
): UtilityNetBalanceSummary {
  let totalSaleemShare = 0;
  let totalSaleemTotalBills = 0;
  let totalExpectedContribution = 0;
  let totalReceivedAmount = 0;
  let totalSaleemOwesTahir = 0;
  let totalTahirOwesSaleem = 0;

  // Map payments by bill ID
  const paymentsByBillMap = new Map<string, number>();
  payments.forEach(p => {
    const current = paymentsByBillMap.get(p.utilityBillId) || 0;
    paymentsByBillMap.set(p.utilityBillId, current + p.amount);
    totalReceivedAmount += p.amount;
  });

  bills.forEach(bill => {
    const waterGasShare = bill.saleemWaterGasShare ?? calculateGasWaterShare(bill.gas, bill.water);
    const saleemBill = bill.totalBill ?? calculateSaleemTotalBill(bill.electricity, bill.gas, bill.water);
    const expected = bill.expectedContribution ?? 9500;
    const paidForBill = paymentsByBillMap.get(bill.id) || 0;
    const roundedSaleemBill = Math.round(saleemBill);
    const diff = roundedSaleemBill - paidForBill;

    totalSaleemShare += waterGasShare;
    totalSaleemTotalBills += roundedSaleemBill;
    totalExpectedContribution += expected;

    if (diff > 0) {
      totalSaleemOwesTahir += diff;
    } else if (diff < 0) {
      totalTahirOwesSaleem += Math.abs(diff);
    }
  });

  // Overall Net comparison between Total Saleem Bills and Total Received
  const overallDiff = totalSaleemTotalBills - totalReceivedAmount;
  let netStatus: 'saleem_owes_tahir' | 'tahir_owes_saleem' | 'settled' = 'settled';
  if (overallDiff > 0) {
    netStatus = 'saleem_owes_tahir';
  } else if (overallDiff < 0) {
    netStatus = 'tahir_owes_saleem';
  }

  return {
    totalSaleemTotalBills,
    totalSaleemShare,
    totalExpectedContribution,
    totalReceivedAmount,
    totalSaleemOwesTahir,
    totalTahirOwesSaleem,
    netDifference: Math.abs(overallDiff),
    netStatus
  };
}
