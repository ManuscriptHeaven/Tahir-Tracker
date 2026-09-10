/**
 * Rent Calculation Utilities for Tahir Tracker
 * 
 * Computes monthly dues, cumulative chronological arrears,
 * collection status, and tenant balances.
 */

import { addMoney, subtractMoney, normalizeMoney } from './money.ts';

export interface RentPortionLike {
  id?: string;
  expectedRent: number;
  initialArrears?: number;
  dueDay?: number;
  createdAt?: string;
}

export interface RentRecordLike {
  portionId?: string;
  monthYear: string;
  expectedAmount: number;
  paidAmount: number;
  arrearsAmount?: number;
}

/**
 * Calculates cumulative arrears for a portion up to the target month.
 * Reconciles every calendar month between creation and targetMonthYear.
 * Supports partial payments, full payments, and advance credits.
 */
export function calculateChronologicalRentArrears(
  portion: RentPortionLike,
  previousRecords: RentRecordLike[],
  targetMonthYear: string
): number {
  let runningBalance = normalizeMoney(portion.initialArrears || 0);

  // Map of existing recorded months prior to targetMonthYear
  const recordMap = new Map<string, RentRecordLike>();
  previousRecords
    .filter(r => r.monthYear < targetMonthYear)
    .forEach(r => recordMap.set(r.monthYear, r));

  // Determine starting point
  let curY: number;
  let curM: number;

  if (portion.createdAt) {
    try {
      const createdDate = new Date(portion.createdAt);
      curY = createdDate.getFullYear();
      curM = createdDate.getMonth() + 1;
    } catch {
      curY = 2026;
      curM = 1;
    }
  } else if (previousRecords.length > 0) {
    const sorted = [...previousRecords].sort((a, b) => a.monthYear.localeCompare(b.monthYear));
    const [ey, em] = sorted[0].monthYear.split('-').map(Number);
    curY = ey;
    curM = em;
  } else {
    return Math.max(0, runningBalance);
  }

  const [targetY, targetM] = targetMonthYear.split('-').map(Number);
  if (isNaN(targetY) || isNaN(targetM)) return Math.max(0, runningBalance);

  while (curY < targetY || (curY === targetY && curM < targetM)) {
    const mStr = `${curY}-${String(curM).padStart(2, '0')}`;
    const rec = recordMap.get(mStr);
    const expected = rec ? rec.expectedAmount : portion.expectedRent;
    const paid = rec ? rec.paidAmount : 0;

    // Total due in that month was runningBalance + expected
    // After payment, new running balance is runningBalance + expected - paid
    runningBalance = addMoney(runningBalance, subtractMoney(expected, paid));

    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }

  return Math.max(0, normalizeMoney(runningBalance));
}

/**
 * Computes financial snapshot for a portion in a specific month
 */
export function getPortionFinancialSummary(
  portion: RentPortionLike,
  rec: RentRecordLike | undefined,
  previousRecords: RentRecordLike[],
  selectedMonth: string,
  currentYearMonth: string,
  currentDayOfMonth: number
) {
  const previousArrears = rec?.arrearsAmount !== undefined
    ? normalizeMoney(rec.arrearsAmount)
    : calculateChronologicalRentArrears(portion, previousRecords, selectedMonth);

  const currentExpected = rec ? normalizeMoney(rec.expectedAmount) : normalizeMoney(portion.expectedRent);
  const totalDue = addMoney(currentExpected, previousArrears);
  const paid = rec ? normalizeMoney(rec.paidAmount) : 0;
  const netRemaining = Math.max(0, subtractMoney(totalDue, paid));

  let status: 'paid' | 'pending' | 'partially_paid' | 'overdue' = 'pending';

  if (paid >= totalDue && totalDue > 0) {
    status = 'paid';
  } else if (paid > 0) {
    status = 'partially_paid';
  } else {
    const dueDay = portion.dueDay || 10;
    const isPastMonth = selectedMonth < currentYearMonth;
    const isCurrentMonthPastDue = selectedMonth === currentYearMonth && currentDayOfMonth > dueDay;
    if (isPastMonth || isCurrentMonthPastDue || previousArrears > 0) {
      status = 'overdue';
    } else {
      status = 'pending';
    }
  }

  return {
    status,
    paid,
    currentExpected,
    previousArrears,
    totalDue,
    netRemaining
  };
}
