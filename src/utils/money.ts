/**
 * Centralized Safe Money Utility for Tahir Tracker
 * 
 * Prevents floating-point arithmetic errors (e.g., 0.1 + 0.2 = 0.30000000000000004)
 * by normalizing decimal precision and supporting exact integer paisa arithmetic.
 */

// 1 PKR = 100 Paisas
const PAISA_FACTOR = 100;

/**
 * Normalizes any numeric amount to safe 2-decimal financial precision.
 * Eliminates JavaScript floating-point artifacts.
 */
export function normalizeMoney(amount: number | string | undefined | null): number {
  if (amount === undefined || amount === null || amount === '') return 0;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || !isFinite(num)) return 0;
  // Round to nearest paisa (2 decimal places) using epsilon to prevent floating-point inaccuracies
  return Math.round((num + Number.EPSILON) * PAISA_FACTOR) / PAISA_FACTOR;
}

/**
 * Converts PKR to integer Paisas
 */
export function toPaisa(amount: number | string): number {
  const norm = normalizeMoney(amount);
  return Math.round(norm * PAISA_FACTOR);
}

/**
 * Converts integer Paisas back to PKR
 */
export function fromPaisa(paisa: number): number {
  if (!isFinite(paisa)) return 0;
  return Math.round(paisa) / PAISA_FACTOR;
}

/**
 * Adds multiple monetary amounts safely using integer arithmetic
 */
export function addMoney(...amounts: (number | string | undefined | null)[]): number {
  const totalPaisa = amounts.reduce((sum: number, amt) => sum + toPaisa(amt || 0), 0);
  return fromPaisa(totalPaisa);
}

/**
 * Subtracts b from a safely using integer arithmetic (a - b)
 */
export function subtractMoney(
  a: number | string | undefined | null,
  b: number | string | undefined | null
): number {
  return fromPaisa(toPaisa(a || 0) - toPaisa(b || 0));
}

/**
 * Multiplies money by a multiplier (e.g., quantity, percentage, rate)
 */
export function multiplyMoney(amount: number | string, factor: number | string): number {
  const normAmt = normalizeMoney(amount);
  const normFactor = typeof factor === 'string' ? parseFloat(factor) : factor;
  if (isNaN(normFactor) || !isFinite(normFactor)) return 0;
  return normalizeMoney(normAmt * normFactor);
}

/**
 * Divides money by a divisor (e.g. utility split between 3 people)
 */
export function divideMoney(amount: number | string, divisor: number | string): number {
  const normAmt = normalizeMoney(amount);
  const normDiv = typeof divisor === 'string' ? parseFloat(divisor) : divisor;
  if (!normDiv || isNaN(normDiv) || !isFinite(normDiv)) return 0;
  return normalizeMoney(normAmt / normDiv);
}

/**
 * Formats a monetary amount into standard Pakistani Rupee representation
 */
export function formatPKR(amount: number | string | undefined | null, showDecimals: boolean = false): string {
  const norm = normalizeMoney(amount);
  const formatter = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
  return `${formatter.format(norm)} PKR`;
}

/**
 * Validates whether a value is a legitimate financial amount (positive, non-NaN, finite)
 */
export function isValidMoneyAmount(val: any, allowZero: boolean = true): boolean {
  if (val === undefined || val === null || val === '') return false;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) return false;
  return allowZero ? num >= 0 : num > 0;
}
