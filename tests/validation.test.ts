import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTransactionAmount,
  validatePhoneNumber,
  validateOdometer,
  validateMilkKg,
  validateMilkRate,
  validateDueDay,
  validateDate
} from '../src/utils/validation.ts';

describe('validation.ts - Centralized Validation Suite', () => {
  describe('validateTransactionAmount', () => {
    it('should pass positive non-zero amounts', () => {
      assert.strictEqual(validateTransactionAmount(1500).isValid, true);
      assert.strictEqual(validateTransactionAmount('250.50').isValid, true);
    });

    it('should reject zero, negative, NaN, or out of range amounts', () => {
      assert.strictEqual(validateTransactionAmount(0).isValid, false);
      assert.strictEqual(validateTransactionAmount(-50).isValid, false);
      assert.strictEqual(validateTransactionAmount(NaN).isValid, false);
      assert.strictEqual(validateTransactionAmount('invalid').isValid, false);
      assert.strictEqual(validateTransactionAmount(150_000_000).isValid, false);
    });
  });

  describe('validatePhoneNumber', () => {
    it('should pass empty / optional phone numbers', () => {
      assert.strictEqual(validatePhoneNumber('').isValid, true);
      assert.strictEqual(validatePhoneNumber(null).isValid, true);
      assert.strictEqual(validatePhoneNumber(undefined).isValid, true);
    });

    it('should pass valid Pakistani phone numbers in various formats', () => {
      assert.strictEqual(validatePhoneNumber('03001234567').isValid, true);
      assert.strictEqual(validatePhoneNumber('0300-1234567').isValid, true);
      assert.strictEqual(validatePhoneNumber('+923001234567').isValid, true);
      assert.strictEqual(validatePhoneNumber('923001234567').isValid, true);
    });

    it('should reject invalid phone numbers', () => {
      assert.strictEqual(validatePhoneNumber('12345').isValid, false);
      assert.strictEqual(validatePhoneNumber('04231234567').isValid, false); // Landline prefix
      assert.strictEqual(validatePhoneNumber('abcdefghijk').isValid, false);
    });
  });

  describe('validateOdometer', () => {
    it('should pass valid increasing odometer readings', () => {
      assert.strictEqual(validateOdometer(15000, 14500).isValid, true);
      assert.strictEqual(validateOdometer(100, 0).isValid, true);
    });

    it('should reject decreasing odometer readings', () => {
      const res = validateOdometer(14000, 15000);
      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes('cannot be less'));
    });

    it('should reject negative or NaN odometer readings', () => {
      assert.strictEqual(validateOdometer(-10).isValid, false);
      assert.strictEqual(validateOdometer('abc').isValid, false);
    });
  });

  describe('validateMilkKg and validateMilkRate', () => {
    it('should validate milk quantities', () => {
      assert.strictEqual(validateMilkKg(1.5).isValid, true);
      assert.strictEqual(validateMilkKg(0).isValid, true);
      assert.strictEqual(validateMilkKg(55).isValid, false); // Exceeds 50kg
      assert.strictEqual(validateMilkKg(-1).isValid, false);
    });

    it('should validate milk rates', () => {
      assert.strictEqual(validateMilkRate(260).isValid, true);
      assert.strictEqual(validateMilkRate(300).isValid, true);
      assert.strictEqual(validateMilkRate(20).isValid, false); // Below 50 PKR
      assert.strictEqual(validateMilkRate(1500).isValid, false); // Above 1000 PKR
    });
  });

  describe('validateDueDay and validateDate', () => {
    it('should validate due day of month (1-31)', () => {
      assert.strictEqual(validateDueDay(1).isValid, true);
      assert.strictEqual(validateDueDay(31).isValid, true);
      assert.strictEqual(validateDueDay(0).isValid, false);
      assert.strictEqual(validateDueDay(32).isValid, false);
    });

    it('should validate date strings', () => {
      assert.strictEqual(validateDate('2026-03-15').isValid, true);
      assert.strictEqual(validateDate('2026-13-01').isValid, false);
      assert.strictEqual(validateDate('').isValid, false);
    });
  });
});
