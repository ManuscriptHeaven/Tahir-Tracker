/**
 * Centralized Input Validation Suite for Tahir Tracker
 * 
 * Validates financial amounts, dates, phone numbers, odometer, rates, and entities
 * before writing to Dexie or Supabase.
 */

import { isValidMoneyAmount, normalizeMoney } from './money.ts';
import { isValidDateStr } from './dateTime.ts';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates transaction amounts
 */
export function validateTransactionAmount(amount: any): ValidationResult {
  if (!isValidMoneyAmount(amount, false)) {
    return { isValid: false, error: 'Amount must be a positive number greater than 0.' };
  }
  const norm = normalizeMoney(amount);
  if (norm > 100_000_000) {
    return { isValid: false, error: 'Amount exceeds maximum allowable threshold (100 Million PKR).' };
  }
  return { isValid: true };
}

/**
 * Validates Pakistani phone numbers (e.g., 03001234567, 0300-1234567, +923001234567)
 */
export function validatePhoneNumber(phone?: string | null): ValidationResult {
  if (!phone || !phone.trim()) {
    return { isValid: true }; // Optional
  }
  const clean = phone.replace(/[\s\-\(\)\+]/g, '');
  const pkRegex = /^(03\d{9}|923\d{9})$/;
  if (!pkRegex.test(clean)) {
    return { isValid: false, error: 'Invalid Pakistani mobile number format (e.g. 0300-1234567).' };
  }
  return { isValid: true };
}

/**
 * Validates odometer readings for petrol refuels
 */
export function validateOdometer(odometer: any, previousOdometer: number = 0): ValidationResult {
  const num = typeof odometer === 'string' ? parseFloat(odometer) : odometer;
  if (typeof num !== 'number' || isNaN(num) || num <= 0) {
    return { isValid: false, error: 'Odometer reading must be a positive number.' };
  }
  if (previousOdometer > 0 && num < previousOdometer) {
    return {
      isValid: false,
      error: `Odometer reading (${num} km) cannot be less than previous record (${previousOdometer} km).`
    };
  }
  return { isValid: true };
}

/**
 * Validates milk daily supply in KG
 */
export function validateMilkKg(kg: any): ValidationResult {
  const num = typeof kg === 'string' ? parseFloat(kg) : kg;
  if (typeof num !== 'number' || isNaN(num) || num < 0 || num > 50) {
    return { isValid: false, error: 'Milk quantity must be between 0 and 50 KG.' };
  }
  return { isValid: true };
}

/**
 * Validates milk rate per KG
 */
export function validateMilkRate(rate: any): ValidationResult {
  const num = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (typeof num !== 'number' || isNaN(num) || num <= 50 || num > 1000) {
    return { isValid: false, error: 'Milk rate must be between 50 and 1,000 PKR/KG.' };
  }
  return { isValid: true };
}

/**
 * Validates rent portion due day (1-31)
 */
export function validateDueDay(day: any): ValidationResult {
  const num = typeof day === 'string' ? parseInt(day, 10) : day;
  if (typeof num !== 'number' || isNaN(num) || num < 1 || num > 31) {
    return { isValid: false, error: 'Due day must be between 1 and 31.' };
  }
  return { isValid: true };
}

/**
 * Validates a transaction date string (YYYY-MM-DD)
 */
export function validateDate(dateStr: string): ValidationResult {
  if (!isValidDateStr(dateStr)) {
    return { isValid: false, error: 'Date must be a valid date in YYYY-MM-DD format.' };
  }
  return { isValid: true };
}
