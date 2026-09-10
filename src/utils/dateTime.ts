/**
 * Centralized Date & Time Utilities for Tahir Tracker
 * 
 * Standardizes calendar date handling for Pakistan timezone (UTC+5, PKT).
 * Prevents midnight UTC shifts where local dates could rollover to the previous day.
 */

/**
 * Returns today's local date as YYYY-MM-DD
 */
export function getTodayLocalDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns current month-year as YYYY-MM
 */
export function getCurrentMonthYearStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Parses YYYY-MM-DD into numeric year, month (1-12), and day (1-31)
 */
export function parseLocalDateStr(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('-');
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Parses YYYY-MM into numeric year and month (1-12)
 */
export function parseMonthYearStr(monthYear: string): { year: number; month: number } | null {
  if (!monthYear || typeof monthYear !== 'string') return null;
  const parts = monthYear.trim().split('-');
  if (parts.length < 2) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Formats a local date string (YYYY-MM-DD) for display
 */
export function formatLocalDate(
  dateStr?: string | null,
  style: 'short' | 'medium' | 'long' = 'medium'
): string {
  if (!dateStr) return '-';
  const parsed = parseLocalDateStr(dateStr);
  if (!parsed) return dateStr;

  // Construct local date without UTC offset shifting
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  if (isNaN(date.getTime())) return dateStr;

  if (style === 'short') {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  if (style === 'long') {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Safely adds days to a YYYY-MM-DD date string without timezone skew
 */
export function addDaysLocalDate(dateStr: string, days: number): string {
  const parsed = parseLocalDateStr(dateStr);
  if (!parsed) return dateStr;
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Safely adds/subtracts months to a YYYY-MM or YYYY-MM-DD string
 */
export function addMonthsLocalDate(dateOrMonthYear: string, monthsToAdd: number): string {
  if (dateOrMonthYear.length === 7) {
    // YYYY-MM
    const parsed = parseMonthYearStr(dateOrMonthYear);
    if (!parsed) return dateOrMonthYear;
    let newYear = parsed.year;
    let newMonth = parsed.month + monthsToAdd;
    while (newMonth > 12) {
      newMonth -= 12;
      newYear += 1;
    }
    while (newMonth < 1) {
      newMonth += 12;
      newYear -= 1;
    }
    return `${newYear}-${String(newMonth).padStart(2, '0')}`;
  } else {
    // YYYY-MM-DD
    const parsed = parseLocalDateStr(dateOrMonthYear);
    if (!parsed) return dateOrMonthYear;
    const date = new Date(parsed.year, parsed.month - 1 + monthsToAdd, 1);
    const maxDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const clampedDay = Math.min(parsed.day, maxDays);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(clampedDay).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Compares two date strings (YYYY-MM-DD or YYYY-MM).
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
export function compareLocalDate(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Validates whether string is a valid YYYY-MM-DD date
 */
export function isValidDateStr(dateStr: string): boolean {
  return parseLocalDateStr(dateStr) !== null;
}
