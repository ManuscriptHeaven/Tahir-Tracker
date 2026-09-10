import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMoney,
  toPaisa,
  fromPaisa,
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  formatPKR,
  isValidMoneyAmount
} from '../src/utils/money.ts';

describe('money.ts - Financial Precision Utilities', () => {
  describe('normalizeMoney', () => {
    it('should return 0 for undefined, null, or NaN', () => {
      assert.strictEqual(normalizeMoney(undefined), 0);
      assert.strictEqual(normalizeMoney(null), 0);
      assert.strictEqual(normalizeMoney(NaN), 0);
      assert.strictEqual(normalizeMoney('invalid'), 0);
    });

    it('should parse valid string amounts', () => {
      assert.strictEqual(normalizeMoney('1250.50'), 1250.5);
      assert.strictEqual(normalizeMoney('  500  '), 500);
    });

    it('should round to 2 decimal places properly', () => {
      assert.strictEqual(normalizeMoney(10.555), 10.56);
      assert.strictEqual(normalizeMoney(10.554), 10.55);
    });
  });

  describe('toPaisa and fromPaisa', () => {
    it('should convert rupees to paisas correctly without floating point errors', () => {
      assert.strictEqual(toPaisa(19.99), 1999);
      assert.strictEqual(toPaisa(0.01), 1);
      assert.strictEqual(toPaisa(100), 10000);
      assert.strictEqual(toPaisa(0), 0);
    });

    it('should convert paisas back to rupees', () => {
      assert.strictEqual(fromPaisa(1999), 19.99);
      assert.strictEqual(fromPaisa(1), 0.01);
      assert.strictEqual(fromPaisa(10000), 100);
    });
  });

  describe('addMoney and subtractMoney', () => {
    it('should eliminate 0.1 + 0.2 precision drift', () => {
      assert.strictEqual(addMoney(0.1, 0.2), 0.3);
      assert.strictEqual(addMoney(100.15, 200.25), 300.4);
    });

    it('should handle multiple operands in addMoney', () => {
      assert.strictEqual(addMoney(10, 20, 30, 40), 100);
      assert.strictEqual(addMoney(10.05, 20.05, 30.05), 60.15);
    });

    it('should subtract money accurately', () => {
      assert.strictEqual(subtractMoney(100, 30.25), 69.75);
      assert.strictEqual(subtractMoney(50, 60), -10);
    });
  });

  describe('multiplyMoney and divideMoney', () => {
    it('should multiply rates and quantities safely', () => {
      assert.strictEqual(multiplyMoney(1.5, 260), 390);
      assert.strictEqual(multiplyMoney(2.25, 260), 585);
    });

    it('should divide money without zero division crashes', () => {
      assert.strictEqual(divideMoney(100, 2), 50);
      assert.strictEqual(divideMoney(100, 3), 33.33);
      assert.strictEqual(divideMoney(100, 0), 0);
    });
  });

  describe('formatPKR', () => {
    it('should format PKR currency with comma separators', () => {
      assert.strictEqual(formatPKR(25000), '25,000 PKR');
      assert.strictEqual(formatPKR(1500250), '1,500,250 PKR');
      assert.strictEqual(formatPKR(0), '0 PKR');
    });

    it('should format decimals when showDecimals is true', () => {
      assert.strictEqual(formatPKR(1250.75, true), '1,250.75 PKR');
    });

    it('should format negative amounts correctly', () => {
      assert.strictEqual(formatPKR(-5000), '-5,000 PKR');
    });
  });

  describe('isValidMoneyAmount', () => {
    it('should validate positive amounts and reject invalid amounts', () => {
      assert.strictEqual(isValidMoneyAmount(500), true);
      assert.strictEqual(isValidMoneyAmount(0, true), true);
      assert.strictEqual(isValidMoneyAmount(0, false), false);
      assert.strictEqual(isValidMoneyAmount('500'), true);
      assert.strictEqual(isValidMoneyAmount(-100), false);
      assert.strictEqual(isValidMoneyAmount(NaN), false);
      assert.strictEqual(isValidMoneyAmount(Infinity), false);
      assert.strictEqual(isValidMoneyAmount('abc'), false);
    });
  });
});
