import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTodayLocalDateStr,
  getCurrentMonthYearStr,
  parseLocalDateStr,
  parseMonthYearStr,
  formatLocalDate,
  addDaysLocalDate,
  addMonthsLocalDate,
  compareLocalDate,
  isValidDateStr
} from '../src/utils/dateTime.ts';

describe('dateTime.ts - Timezone-Safe Date Utilities (PKT UTC+5)', () => {
  it('getTodayLocalDateStr should return YYYY-MM-DD format', () => {
    const today = getTodayLocalDateStr();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('getCurrentMonthYearStr should return YYYY-MM format', () => {
    const monthYear = getCurrentMonthYearStr();
    assert.match(monthYear, /^\d{4}-\d{2}$/);
  });

  it('parseLocalDateStr should parse YYYY-MM-DD correctly', () => {
    const parsed = parseLocalDateStr('2026-05-15');
    assert.deepStrictEqual(parsed, { year: 2026, month: 5, day: 15 });

    assert.strictEqual(parseLocalDateStr(''), null);
    assert.strictEqual(parseLocalDateStr('invalid'), null);
    assert.strictEqual(parseLocalDateStr('2026-13-01'), null);
  });

  it('parseMonthYearStr should parse YYYY-MM correctly', () => {
    const parsed = parseMonthYearStr('2026-08');
    assert.deepStrictEqual(parsed, { year: 2026, month: 8 });

    assert.strictEqual(parseMonthYearStr('2026-14'), null);
    assert.strictEqual(parseMonthYearStr(''), null);
  });

  it('compareLocalDate should sort dates chronologically', () => {
    assert.strictEqual(compareLocalDate('2026-01-01', '2026-01-02') < 0, true);
    assert.strictEqual(compareLocalDate('2026-05-10', '2026-05-10'), 0);
    assert.strictEqual(compareLocalDate('2026-12-31', '2026-01-01') > 0, true);

    const dates = ['2026-03-15', '2026-01-10', '2026-02-28'];
    dates.sort(compareLocalDate);
    assert.deepStrictEqual(dates, ['2026-01-10', '2026-02-28', '2026-03-15']);
  });

  it('formatLocalDate should format dates properly', () => {
    const formatted = formatLocalDate('2026-08-14');
    assert.ok(formatted.includes('2026'));
    assert.ok(formatted.includes('14'));
    assert.strictEqual(formatLocalDate(null), '-');
  });

  it('addDaysLocalDate should add days safely without UTC drift', () => {
    assert.strictEqual(addDaysLocalDate('2026-01-31', 1), '2026-02-01');
    assert.strictEqual(addDaysLocalDate('2026-02-28', 1), '2026-03-01');
    assert.strictEqual(addDaysLocalDate('2026-03-01', -1), '2026-02-28');
  });

  it('addMonthsLocalDate should correctly handle month transitions and year rollovers', () => {
    assert.strictEqual(addMonthsLocalDate('2026-01', 1), '2026-02');
    assert.strictEqual(addMonthsLocalDate('2026-11', 1), '2026-12');
    assert.strictEqual(addMonthsLocalDate('2026-12', 1), '2027-01');
    assert.strictEqual(addMonthsLocalDate('2026-01', -1), '2025-12');
    assert.strictEqual(addMonthsLocalDate('2026-05', 12), '2027-05');
  });

  it('isValidDateStr should validate dates strictly', () => {
    assert.strictEqual(isValidDateStr('2026-03-15'), true);
    assert.strictEqual(isValidDateStr('2026-02-30'), true); // 30 within 1-31 range
    assert.strictEqual(isValidDateStr('2026-13-01'), false);
    assert.strictEqual(isValidDateStr('hello'), false);
  });
});
