import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateChronologicalRentArrears,
  getPortionFinancialSummary
} from '../src/utils/rentCalculations.ts';
import {
  calculateGasWaterShare,
  calculateSaleemTotalBill,
  getMonthlyBalanceDetail,
  getUtilityPaymentStatus,
  calculateUtilityNetBalance
} from '../src/utils/utilityCalculations.ts';
import { addMoney, subtractMoney, multiplyMoney, divideMoney } from '../src/utils/money.ts';
import { calculatePetrolIntervals } from '../src/utils/petrolCalculations.ts';
import type { PetrolRefill } from '../src/types/index.ts';

describe('financialCalculations.test.ts - Domain Financial Accuracy', () => {
  describe('Rent Calculations & Multi-Month Arrears Reconciliation', () => {
    const portion = {
      id: 'p1',
      name: 'Ground Floor',
      expectedRent: 25000,
      initialArrears: 5000,
      dueDay: 5,
      createdAt: '2026-01-01'
    };

    it('should accumulate initial arrears plus unpaid months', () => {
      // No payments made for Jan
      const records: any[] = [];
      const janArrears = calculateChronologicalRentArrears(portion, records, '2026-01');
      assert.strictEqual(janArrears, 5000); // 5000 initial arrears before Jan

      const febArrears = calculateChronologicalRentArrears(portion, records, '2026-02');
      assert.strictEqual(febArrears, 30000); // 5000 initial + 25000 Jan unpaid

      const marArrears = calculateChronologicalRentArrears(portion, records, '2026-03');
      assert.strictEqual(marArrears, 55000); // 5000 initial + 25000 Jan + 25000 Feb unpaid
    });

    it('should reduce arrears with partial payments across months', () => {
      const records = [
        { portionId: 'p1', monthYear: '2026-01', expectedAmount: 25000, paidAmount: 20000 },
        { portionId: 'p1', monthYear: '2026-02', expectedAmount: 25000, paidAmount: 35000 }
      ];
      // Before Feb: 5000 initial + 25000 due - 20000 paid = 10000
      const febArrears = calculateChronologicalRentArrears(portion, records, '2026-02');
      assert.strictEqual(febArrears, 10000);

      // Before Mar: 10000 prior + 25000 due - 35000 paid = 0
      const marArrears = calculateChronologicalRentArrears(portion, records, '2026-03');
      assert.strictEqual(marArrears, 0);
    });

    it('should clamp advance overpayment to 0 in arrears balance', () => {
      const records = [
        { portionId: 'p1', monthYear: '2026-01', expectedAmount: 25000, paidAmount: 40000 }
      ];
      // 5000 initial + 25000 due - 40000 paid = -10000 -> clamped to 0
      const febArrears = calculateChronologicalRentArrears(portion, records, '2026-02');
      assert.strictEqual(febArrears, 0);
    });

    it('getPortionFinancialSummary should compute totals accurately', () => {
      const records = [
        { portionId: 'p1', monthYear: '2026-01', expectedAmount: 25000, paidAmount: 25000 },
        { portionId: 'p1', monthYear: '2026-02', expectedAmount: 25000, paidAmount: 15000 }
      ];
      const febRec = records[1];
      const summary = getPortionFinancialSummary(portion, febRec, records, '2026-02', '2026-02', 15);
      assert.strictEqual(summary.currentExpected, 25000);
      assert.strictEqual(summary.previousArrears, 5000); // 5000 initial arrears from creation
      assert.strictEqual(summary.totalDue, 30000); // 25000 + 5000
      assert.strictEqual(summary.paid, 15000);
      assert.strictEqual(summary.netRemaining, 15000);
      assert.strictEqual(summary.status, 'partially_paid');
    });
  });

  describe('Shared Utility Bill Calculations (3-Way Split Formula)', () => {
    it('calculateGasWaterShare should compute 1/3 of gas + water without floating errors', () => {
      // Gas = 3000, Water = 1500 -> total 4500 -> 1/3 = 1500
      assert.strictEqual(calculateGasWaterShare(3000, 1500), 1500);

      // Gas = 1000, Water = 0 -> 1000/3 = 333.33
      assert.strictEqual(calculateGasWaterShare(1000, 0), 333.33);
    });

    it('calculateSaleemTotalBill should compute electricity + (gas + water) / 3', () => {
      // Electricity = 12000, Gas = 3000, Water = 1500 -> 12000 + 1500 = 13500
      assert.strictEqual(calculateSaleemTotalBill(12000, 3000, 1500), 13500);
    });

    it('getMonthlyBalanceDetail and calculateUtilityNetBalance should compute net status', () => {
      const balance = getMonthlyBalanceDetail(11500, 9500);
      assert.strictEqual(balance.difference, 2000);
      assert.strictEqual(balance.owesType, 'saleem_owes_tahir');

      assert.strictEqual(getUtilityPaymentStatus(10000, 10000), 'paid');
      assert.strictEqual(getUtilityPaymentStatus(10000, 5000), 'partially_paid');
      assert.strictEqual(getUtilityPaymentStatus(10000, 0), 'pending');

      const bills: any[] = [{
        id: 'b1',
        personId: 'saleem',
        month: 1,
        year: 2026,
        monthYear: '2026-01',
        electricity: 10000,
        gas: 3000,
        water: 1500,
        saleemWaterGasShare: 1500,
        totalBill: 11500,
        expectedContribution: 9500
      }];
      const payments: any[] = [{
        id: 'pay1',
        personId: 'saleem',
        utilityBillId: 'b1',
        paymentDate: '2026-01-10',
        amount: 11500
      }];
      const net = calculateUtilityNetBalance(bills, payments);
      assert.strictEqual(net.netStatus, 'settled');
      assert.strictEqual(net.netDifference, 0);
    });
  });

  describe('Milk Tracking Calculations', () => {
    it('should accurately calculate total bill and arrears carryover', () => {
      // Month 1: 30 days @ 1.5kg = 45kg @ 260 PKR/kg = 11700 PKR
      const month1Kg = 45;
      const rate = 260;
      const month1Bill = multiplyMoney(month1Kg, rate);
      assert.strictEqual(month1Bill, 11700);

      // Customer pays 10000, remaining is 1700
      const month1Paid = 10000;
      const month1Remaining = subtractMoney(month1Bill, month1Paid);
      assert.strictEqual(month1Remaining, 1700);

      // Month 2: 31 days @ 1.5kg = 46.5kg @ 260 PKR/kg = 12090 PKR
      const month2Kg = 46.5;
      const month2Bill = multiplyMoney(month2Kg, rate);
      assert.strictEqual(month2Bill, 12090);

      // Month 2 Total Payable = Month 2 Bill + Month 1 Remaining = 12090 + 1700 = 13790
      const month2Payable = addMoney(month2Bill, month1Remaining);
      assert.strictEqual(month2Payable, 13790);

      // Customer pays 13790 in full -> remaining is 0
      const month2Remaining = subtractMoney(month2Payable, 13790);
      assert.strictEqual(month2Remaining, 0);
    });
  });

  describe('Petrol Mileage Calculations', () => {
    it('should compute distance, km/L economy, and cost per km accurately between full tank checkpoints', () => {
      const prevOdometer = 12450;
      const currOdometer = 12950; // 500 km
      const litres = 35.5;
      const totalCost = 9585; // PKR

      const distance = currOdometer - prevOdometer;
      assert.strictEqual(distance, 500);

      // Mileage (km / L)
      const mileage = divideMoney(distance, litres);
      assert.strictEqual(mileage, 14.08);

      // Cost per km (PKR / km)
      const costPerKm = divideMoney(totalCost, distance);
      assert.strictEqual(costPerKm, 19.17);

      // Verify full-tank intervals calculation engine
      const refills: PetrolRefill[] = [
        {
          id: 'ref1',
          date: '2026-09-01',
          odometerReading: prevOdometer,
          litres: 10,
          pricePerLitre: 270,
          totalCost: 2700,
          isFullTank: true,
          distanceTravelled: 0,
          mileageKmpl: 0,
          costPerKm: 0,
          createdAt: '2026-09-01T00:00:00Z'
        },
        {
          id: 'ref2',
          date: '2026-09-10',
          odometerReading: currOdometer,
          litres: litres,
          pricePerLitre: 270,
          totalCost: totalCost,
          isFullTank: true,
          distanceTravelled: 0,
          mileageKmpl: 0,
          costPerKm: 0,
          createdAt: '2026-09-10T00:00:00Z'
        }
      ];

      const processed = calculatePetrolIntervals(refills);
      assert.strictEqual(processed[0].calculationType, 'baseline');
      assert.strictEqual(processed[1].calculationType, 'completed');
      assert.strictEqual(processed[1].intervalDistance, 500);
      assert.strictEqual(processed[1].intervalFuel, 35.5);
      assert.strictEqual(processed[1].mileageKmpl, 14.08);
      assert.strictEqual(processed[1].costPerKm, 19.17);
    });
  });

  describe('Personal Finance Account Invariant (Double-Entry Net Worth)', () => {
    it('should preserve net worth invariant during internal transfers', () => {
      let bankBalance = 150000;
      let cashBalance = 25000;
      const initialNetWorth = addMoney(bankBalance, cashBalance);
      assert.strictEqual(initialNetWorth, 175000);

      // Transfer 20000 from Bank to Cash
      const transferAmount = 20000;
      bankBalance = subtractMoney(bankBalance, transferAmount);
      cashBalance = addMoney(cashBalance, transferAmount);

      assert.strictEqual(bankBalance, 130000);
      assert.strictEqual(cashBalance, 45000);
      const postTransferNetWorth = addMoney(bankBalance, cashBalance);
      assert.strictEqual(postTransferNetWorth, initialNetWorth);
    });
  });
});
