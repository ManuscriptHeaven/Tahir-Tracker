import { db } from '../db/db';
import { AIProposal } from '../types/ai';
import { UtilityBill, UtilityPayment, MilkDailyLog, LoanTransaction, PetrolRefill, RentMonthlyRecord } from '../types';
import { calculateGasWaterShare, calculateSaleemTotalBill } from '../utils/utilityCalculations';

export interface ExecutionResult {
  success: boolean;
  message: string;
  data?: any;
}

export async function executeAIProposal(proposal: AIProposal): Promise<ExecutionResult> {
  const { actionType, payload } = proposal;
  const now = new Date().toISOString();

  try {
    switch (actionType) {
      // -------------------------------------------------------------
      // 1. ADD UTILITY PAYMENT
      // -------------------------------------------------------------
      case 'add_utility_payment': {
        const { personId, personName, month, year, monthYear, amount, paymentDate, note } = payload;
        
        // Find existing utility bill record or create one
        let existingBill = await db.utility_bills
          .filter(b => b.personId === personId && b.monthYear === monthYear)
          .first();

        if (!existingBill) {
          // Fetch person's default expected contribution
          const person = await db.utility_persons.get(personId);
          const expectedContribution = person?.monthlyExpectedContribution || 9500;
          
          existingBill = {
            id: `ub_${monthYear}_${personId}`,
            personId,
            month: month || parseInt(monthYear.split('-')[1], 10),
            year: year || parseInt(monthYear.split('-')[0], 10),
            monthYear,
            electricity: 0,
            gas: 0,
            water: 1550,
            saleemWaterGasShare: Math.round((0 + 1550) / 3),
            totalBill: Math.round(0 + (1550 / 3)),
            expectedContribution,
            notes: 'Created via AI Payment entry',
            createdAt: now,
            updatedAt: now
          };
          await db.utility_bills.add(existingBill);
        }

        const newPayment: UtilityPayment = {
          id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          utilityBillId: existingBill.id,
          personId,
          paymentDate: paymentDate || new Date().toISOString().split('T')[0],
          amount: Number(amount),
          note: note || 'Recorded via AI Voice Assistant',
          createdAt: now,
          updatedAt: now
        };

        await db.utility_payments.add(newPayment);

        return {
          success: true,
          message: `✅ ${personName || 'Saleem'} bhai k ${monthYear} k bill me ${Number(amount).toLocaleString()} PKR payment kamyabi se record ho gayi hai!`,
          data: newPayment
        };
      }

      // -------------------------------------------------------------
      // 2. UPDATE UTILITY BILL AMOUNT (Electricity / Gas / Water)
      // -------------------------------------------------------------
      case 'update_utility_bill': {
        const { personId, personName, monthYear, field, amount } = payload;
        
        let existingBill = await db.utility_bills
          .filter(b => b.personId === personId && b.monthYear === monthYear)
          .first();

        const person = await db.utility_persons.get(personId);
        const expectedContribution = person?.monthlyExpectedContribution || 9500;

        let electricity = existingBill?.electricity || 0;
        let gas = existingBill?.gas || 0;
        let water = existingBill?.water || 1550;

        if (field === 'electricity') electricity = Number(amount);
        if (field === 'gas') gas = Number(amount);
        if (field === 'water') water = Number(amount);

        const saleemWaterGasShare = calculateGasWaterShare(gas, water);
        const totalBill = calculateSaleemTotalBill(electricity, gas, water);

        if (existingBill) {
          await db.utility_bills.update(existingBill.id, {
            electricity,
            gas,
            water,
            saleemWaterGasShare,
            totalBill,
            updatedAt: now
          });
        } else {
          const newBill: UtilityBill = {
            id: `ub_${monthYear}_${personId}`,
            personId,
            month: parseInt(monthYear.split('-')[1], 10),
            year: parseInt(monthYear.split('-')[0], 10),
            monthYear,
            electricity,
            gas,
            water,
            saleemWaterGasShare,
            totalBill,
            expectedContribution,
            createdAt: now,
            updatedAt: now
          };
          await db.utility_bills.add(newBill);
        }

        return {
          success: true,
          message: `✅ ${personName || 'Saleem'} ka ${monthYear} ka ${field} bill ${Number(amount).toLocaleString()} PKR update ho gaya hai (Total: ${Math.round(totalBill).toLocaleString()} PKR).`
        };
      }

      // -------------------------------------------------------------
      // 3. ADD MILK DAILY LOG
      // -------------------------------------------------------------
      case 'add_milk_log': {
        const { consumerId, consumerName, date, actualKg, status, ratePerKg } = payload;
        const logId = `${date}_${consumerId}`;

        const existing = await db.milk_logs.get(logId);
        const milkLog: MilkDailyLog = {
          id: logId,
          consumerId,
          consumerName,
          date,
          actualKg: Number(actualKg),
          status,
          ratePerKg: ratePerKg || 260,
          notes: 'Updated via AI Assistant'
        };

        if (existing) {
          await db.milk_logs.update(logId, milkLog);
        } else {
          await db.milk_logs.add(milkLog);
        }

        return {
          success: true,
          message: `✅ ${consumerName} ka ${date} ka doodh (${status === 'missed' ? 'Missed' : `${actualKg} KG`}) save ho gaya hai!`
        };
      }

      // -------------------------------------------------------------
      // 4. ADD LOAN (Given / Taken)
      // -------------------------------------------------------------
      case 'add_loan': {
        const { personName, type, principalAmount, date, notes } = payload;
        const newLoan: LoanTransaction = {
          id: `loan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          personName,
          type,
          principalAmount: Number(principalAmount),
          date: date || new Date().toISOString().split('T')[0],
          status: 'active',
          payments: [],
          notes: notes || 'Voice Entry',
          createdAt: now
        };

        await db.loans.add(newLoan);
        return {
          success: true,
          message: `✅ ${personName} ka ${Number(principalAmount).toLocaleString()} PKR ka loan (${type === 'given' ? 'Given / Udhar Diya' : 'Taken / Udhar Liya'}) save ho gaya!`
        };
      }

      // -------------------------------------------------------------
      // 5. ADD LOAN PAYMENT (Repayment)
      // -------------------------------------------------------------
      case 'add_loan_payment': {
        const { personName, amount, date, note } = payload;
        const activeLoan = await db.loans
          .filter(l => l.personName.toLowerCase().includes(personName.toLowerCase()) && l.status === 'active')
          .first();

        if (activeLoan) {
          const updatedPayments = [
            ...activeLoan.payments,
            {
              id: `pay_${Date.now()}`,
              amount: Number(amount),
              date: date || new Date().toISOString().split('T')[0],
              note: note || 'Repayment via AI',
              createdAt: now
            }
          ];

          const totalPaid = updatedPayments.reduce((s, p) => s + p.amount, 0);
          const isCompleted = totalPaid >= activeLoan.principalAmount;

          await db.loans.update(activeLoan.id, {
            payments: updatedPayments,
            status: isCompleted ? 'completed' : 'active'
          });

          return {
            success: true,
            message: `✅ ${personName} se ${Number(amount).toLocaleString()} PKR repayment record ho gayi hai!`
          };
        } else {
          // If no active loan exists, create a new completed or given loan
          const newLoan: LoanTransaction = {
            id: `loan_${Date.now()}`,
            personName,
            type: 'given',
            principalAmount: Number(amount),
            date: date || new Date().toISOString().split('T')[0],
            status: 'completed',
            payments: [
              {
                id: `pay_${Date.now()}`,
                amount: Number(amount),
                date: date || new Date().toISOString().split('T')[0],
                note: note || 'Direct payment',
                createdAt: now
              }
            ],
            notes: 'Repayment record via AI',
            createdAt: now
          };
          await db.loans.add(newLoan);

          return {
            success: true,
            message: `✅ ${personName} se ${Number(amount).toLocaleString()} PKR repayment entry record ho gayi hai!`
          };
        }
      }

      // -------------------------------------------------------------
      // 6. ADD PETROL REFILL
      // -------------------------------------------------------------
      case 'add_petrol_refill': {
        const { date, totalCost, odometerReading, litres, pricePerLitre, notes } = payload;
        
        // Calculate mileage from last refill
        const lastRefill = await db.petrol_refills.orderBy('odometerReading').last();
        let distanceTravelled = 0;
        let mileageKmpl = 0;
        let costPerKm = 0;

        if (lastRefill && Number(odometerReading) > lastRefill.odometerReading) {
          distanceTravelled = Number(odometerReading) - lastRefill.odometerReading;
          if (Number(litres) > 0) {
            mileageKmpl = parseFloat((distanceTravelled / Number(litres)).toFixed(2));
          }
          if (distanceTravelled > 0) {
            costPerKm = parseFloat((Number(totalCost) / distanceTravelled).toFixed(2));
          }
        }

        const newRefill: PetrolRefill = {
          id: `pet_${Date.now()}`,
          date: date || new Date().toISOString().split('T')[0],
          odometerReading: Number(odometerReading),
          litres: Number(litres),
          pricePerLitre: Number(pricePerLitre) || 270,
          totalCost: Number(totalCost),
          distanceTravelled,
          mileageKmpl,
          costPerKm,
          notes: notes || 'AI Voice Refill Entry',
          createdAt: now
        };

        await db.petrol_refills.add(newRefill);
        return {
          success: true,
          message: `✅ ${Number(totalCost).toLocaleString()} PKR petrol refill (${odometerReading} KM) save ho gaya hai!`
        };
      }

      // -------------------------------------------------------------
      // 7. UPDATE RENT RECORD
      // -------------------------------------------------------------
      case 'update_rent_record': {
        const { portionId, portionName, tenantName, monthYear, expectedAmount, paidAmount, status, paymentDate, notes } = payload;
        const recordId = `${monthYear}_${portionId}`;
        const existing = await db.rent_records.get(recordId);

        const rentRecord: RentMonthlyRecord = {
          id: recordId,
          portionId,
          portionName,
          tenantName,
          monthYear,
          expectedAmount: Number(expectedAmount) || 10000,
          paidAmount: Number(paidAmount),
          status: status || 'paid',
          paymentDate: paymentDate || new Date().toISOString().split('T')[0],
          paymentMethod: 'Cash',
          notes: notes || 'Recorded via AI Voice Assistant',
          updatedAt: now
        };

        if (existing) {
          await db.rent_records.update(recordId, rentRecord);
        } else {
          await db.rent_records.add(rentRecord);
        }

        return {
          success: true,
          message: `✅ ${portionName} (${tenantName}) ka ${monthYear} ka ${Number(paidAmount).toLocaleString()} PKR rent record ho gaya hai!`
        };
      }

      case 'navigate': {
        return {
          success: true,
          message: `Navigating to ${payload.targetTab}`
        };
      }

      default:
        return {
          success: false,
          message: 'Unknown action type'
        };
    }
  } catch (err: any) {
    console.error('Failed to execute AI proposal:', err);
    return {
      success: false,
      message: `Execution failed: ${err.message || 'Unknown database error'}`
    };
  }
}
