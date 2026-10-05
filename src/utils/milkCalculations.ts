import type { MilkConsumer, MilkDailyLog, MilkMonthlyRecord } from '../types/index.ts';
import { multiplyMoney, normalizeMoney } from './money.ts';

export function getMilkStartDate(consumer: MilkConsumer, month: string): string {
  const saved = consumer.monthlyStartDates?.[month];
  return saved && isValidMilkStartDate(saved, month) ? saved : `${month}-01`;
}

export function isValidMilkStartDate(date: string, month: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(0, 7) !== month) return false;
  const [year, monthNumber, day] = date.split('-').map(Number);
  return monthNumber >= 1 && monthNumber <= 12 && day >= 1 &&
    day <= new Date(year, monthNumber, 0).getDate();
}

export function isMilkDayActive(consumer: MilkConsumer, date: string): boolean {
  return date >= getMilkStartDate(consumer, date.slice(0, 7));
}

export function calculateMilkMonth(consumers: MilkConsumer[], logs: MilkDailyLog[], month: string, rate: number) {
  const logMap = new Map(logs.map(log => [`${log.date}_${log.consumerId}`, log]));
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  let totalSuppliedKg = 0;
  let totalMissedKg = 0;
  let totalMissedDays = 0;
  const consumerStats: Record<string, {
    name: string; quota: number; startDate: string; eligibleDays: number;
    suppliedKg: number; missedDays: number; missedKg: number; cost: number;
  }> = {};
  for (const consumer of consumers) {
    const stat = consumerStats[consumer.id] = {
      name: consumer.name, quota: Number(consumer.defaultDailyKg),
      startDate: getMilkStartDate(consumer, month), eligibleDays: 0,
      suppliedKg: 0, missedDays: 0, missedKg: 0, cost: 0
    };
    for (let day = 1; day <= days; day++) {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      if (!isMilkDayActive(consumer, date)) continue;
      stat.eligibleDays++;
      const log = logMap.get(`${date}_${consumer.id}`);
      const kg = Number(log ? log.actualKg : consumer.defaultDailyKg);
      if (log?.status === 'missed' || (log?.status !== 'custom' && kg === 0)) {
        stat.missedDays++;
        stat.missedKg += Number(consumer.defaultDailyKg);
      } else {
        stat.suppliedKg += kg;
        if (log?.status === 'custom') stat.missedKg += Math.max(0, Number(consumer.defaultDailyKg) - kg);
      }
    }
    stat.suppliedKg = normalizeMoney(stat.suppliedKg);
    stat.missedKg = normalizeMoney(stat.missedKg);
    stat.cost = multiplyMoney(stat.suppliedKg, rate);
    totalSuppliedKg += stat.suppliedKg;
    totalMissedKg += stat.missedKg;
    totalMissedDays += stat.missedDays;
  }
  return {
    consumerStats, totalSuppliedKg: normalizeMoney(totalSuppliedKg),
    totalMissedKg: normalizeMoney(totalMissedKg), totalMissedDays,
    totalMonthlyAmount: multiplyMoney(totalSuppliedKg, rate)
  };
}

// Retain any explicit balance adjustment while reflecting changes to the month's bill.
export function getMilkRemainingAmount(record: MilkMonthlyRecord | undefined, bill: number, previous: number): number {
  const adjustment = record?.remainingAmount !== undefined
    ? Number(record.remainingAmount) - Math.max(0, Number(record.totalBill) + Number(record.previousRemaining) - Number(record.paidAmount))
    : 0;
  return Math.max(0, normalizeMoney(bill + previous - Number(record?.paidAmount || 0) + adjustment));
}
