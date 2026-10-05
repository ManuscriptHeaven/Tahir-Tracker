import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMilkMonth, getMilkStartDate, getMilkRemainingAmount, isMilkDayActive, isValidMilkStartDate } from '../src/utils/milkCalculations.ts';
import type { MilkConsumer, MilkDailyLog, MilkMonthlyRecord } from '../src/types/index.ts';

const person = (id: string, start?: string, quota = 1): MilkConsumer => ({
  id, name: id, active: true, defaultDailyKg: quota, createdAt: '2026-01-01',
  monthlyStartDates: start ? { '2026-10': start } : undefined
});
const log = (date: string, status: MilkDailyLog['status'], actualKg: number): MilkDailyLog => ({
  id: `${date}_Tayyab`, consumerId: 'Tayyab', consumerName: 'Tayyab', date,
  status, actualKg, ratePerKg: 260
});

test('three people are billed independently, including their start day', () => {
  const people = [person('Saleem', '2026-10-01', 3), person('Tayyab', '2026-10-10', 2), person('Chand', '2026-10-20')];
  const result = calculateMilkMonth(people, [], '2026-10', 260);
  assert.deepEqual(people.map(p => result.consumerStats[p.id].eligibleDays), [31, 22, 12]);
  assert.deepEqual(people.map(p => result.consumerStats[p.id].cost), [24180, 11440, 3120]);
  assert.equal(result.totalSuppliedKg, 149);
  assert.equal(result.totalMonthlyAmount, 38740);
  assert.equal(result.totalMissedDays, 0);
});

test('prior saved logs are excluded without counting them as missed or modifying them', () => {
  const logs = [log('2026-10-01', 'supplied', 2), log('2026-10-02', 'missed', 0)];
  const original = structuredClone(logs);
  const result = calculateMilkMonth([person('Tayyab', '2026-10-10', 2)], logs, '2026-10', 260);
  assert.equal(result.totalSuppliedKg, 44);
  assert.equal(result.totalMissedDays, 0);
  assert.equal(result.totalMissedKg, 0);
  assert.deepEqual(logs, original);
});

test('missed, partial and custom zero deliveries after the start adjust the bill', () => {
  const result = calculateMilkMonth([person('Tayyab', '2026-10-10', 2)], [
    log('2026-10-10', 'missed', 0), log('2026-10-11', 'custom', 0.5), log('2026-10-12', 'custom', 0)
  ], '2026-10', 260);
  assert.equal(result.totalSuppliedKg, 38.5);
  assert.equal(result.totalMonthlyAmount, 10010);
  assert.equal(result.totalMissedDays, 1);
  assert.equal(result.totalMissedKg, 5.5);
});

test('start dates stay scoped to their month and legacy people default to the 1st', () => {
  const consumer = person('Tayyab', '2026-10-10');
  consumer.monthlyStartDates!['2026-09'] = '2026-09-15';
  assert.equal(getMilkStartDate(consumer, '2026-09'), '2026-09-15');
  assert.equal(getMilkStartDate(consumer, '2026-11'), '2026-11-01');
  assert.equal(calculateMilkMonth([person('Saleem')], [], '2026-10', 260).totalMonthlyAmount, 8060);
  assert.equal(isMilkDayActive(consumer, '2026-10-09'), false);
  assert.equal(isMilkDayActive(consumer, '2026-10-10'), true);
});

test('calendar length handles leap February, short months and last-day starts', () => {
  const consumer = person('Tayyab');
  consumer.monthlyStartDates = { '2024-02': '2024-02-29', '2026-02': '2026-02-28', '2026-04': '2026-04-30' };
  for (const month of ['2024-02', '2026-02', '2026-04']) {
    assert.equal(calculateMilkMonth([consumer], [], month, 260).totalMonthlyAmount, 260);
  }
});

test('invalid dates and dates outside the selected month are rejected', () => {
  assert.equal(isValidMilkStartDate('2026-02-29', '2026-02'), false);
  assert.equal(isValidMilkStartDate('2024-02-29', '2024-02'), true);
  for (const date of ['2026-10-00', '2026-10-32', '2026-11-10', '10/10/2026']) {
    assert.equal(isValidMilkStartDate(date, '2026-10'), false);
  }
});

test('changed bill recalculates remaining balance and preserves manual adjustment', () => {
  const record: MilkMonthlyRecord = {
    id: 'record', monthYear: '2026-10', totalKg: 31, ratePerKg: 260,
    totalBill: 8060, previousRemaining: 1000, totalPayable: 9060,
    paidAmount: 4000, remainingAmount: 5060, status: 'partial', updatedAt: '2026-10-01'
  };
  assert.equal(getMilkRemainingAmount(record, 5720, 1000), 2720);
  assert.equal(getMilkRemainingAmount({ ...record, remainingAmount: 5000 }, 5720, 1000), 2660);
  assert.equal(getMilkRemainingAmount(record, 260, 1000), 0);
  assert.equal(getMilkRemainingAmount(undefined, 5720, 1000), 6720);
});

test('monthly start dates survive the sync JSON payload without renaming month keys', () => {
  const consumer = person('Tayyab', '2026-10-10');
  const payload = JSON.parse(JSON.stringify({ monthly_start_dates: consumer.monthlyStartDates }));
  const restored = { ...consumer, monthlyStartDates: payload.monthly_start_dates };
  assert.equal(calculateMilkMonth([restored], [], '2026-10', 260).totalMonthlyAmount, 5720);
});
