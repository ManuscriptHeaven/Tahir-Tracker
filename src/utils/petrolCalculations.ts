/**
 * Petrol & Fuel Mileage Calculation Engine for Tahir Tracker
 * 
 * Implements two complementary views:
 * 1) Full-Tank-to-Full-Tank methodology for verified fuel economy (KM/L).
 * 2) Refill-to-refill practical tracking for every refill: cost -> KM until next refill -> PKR/KM.
 * Partial refills never pretend to be verified KM/L, but they remain useful for real-world cost tracking.
 */

import type { PetrolRefill } from '../types/index.ts';
import { addMoney } from './money.ts';

// Map camelCase to snake_case for Supabase serialization
export function toSnakeCase(obj: any): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = obj[key];
  }
  return result;
}

// Map snake_case to camelCase from Supabase serialization
export function toCamelCase(obj: any): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

export type RefillCalculationType = 'baseline' | 'completed' | 'partial';

export type RefillCycleStatus = 'completed' | 'in_progress';

export interface ProcessedRefill extends PetrolRefill {
  // Full-Tank Engine Fields (Accurate Fuel Economy)
  calculationType: RefillCalculationType;
  stepDistance: number; // Distance from immediately previous refill (backward looking)
  intervalDistance: number; // Distance since previous full tank (completed only)
  intervalFuel: number; // Total litres consumed across interval (completed only)
  intervalCost: number; // Total PKR spent across interval (completed only)
  displayMileage: string; // Formatted string for UI display (Verified KM/L)
  displayCostPerKm: string; // Formatted string for UI display (Verified interval cost/km)

  // Refill-to-Refill Fields (Primary Daily Tracking)
  distanceUntilNextRefill: number | null; // Distance until subsequent refill; null if latest (in progress)
  refillCostPerKm: number | null; // currentRefill.totalCost / distanceUntilNextRefill; null if in progress
  isRefillSegmentComplete: boolean; // false for latest refill, true when subsequent refill exists
  refillCycleStatus: RefillCycleStatus;
  displayDistanceUntilNext: string; // "+80 km" or "In Progress"
  displayRefillCostPerKm: string; // "6.25 PKR/KM" or "—"
}

export interface MonthlyPetrolStats {
  // Existing Full-Tank metrics
  completedIntervalsCount: number;
  avgMileage: number; // Verified weighted full-tank mileage: total interval distance / total interval fuel
  totalIntervalDistance: number;
  totalIntervalFuel: number;
  totalIntervalCost: number;
  verifiedCostPerKm: number; // Full-tank interval cost / full-tank interval distance

  // Calendar month purchases & travel
  monthlyLitres: number; // Total fuel litres purchased in this month
  monthlyCost: number; // Total PKR spent on fuel in this month
  loggedTravelKm: number; // Sum of step distances logged in this month
  costPerKm: number; // Monthly interval cost / interval distance (or monthlyCost / loggedTravelKm)

  // Refill-to-Refill daily aggregated metrics
  completedRefillsCount: number;
  totalCompletedRefillDistance: number;
  totalCompletedRefillCost: number;
  avgRefillCostPerKm: number; // Weighted: totalCompletedRefillCost / totalCompletedRefillDistance

  // Backward-compatible aliases for refill cycles
  completedRefillCyclesCount: number;
  refillCycleDistanceKm: number;
  refillCycleCost: number;

  // Quick access pointers
  latestRefill: ProcessedRefill | null;
  previousCompletedRefill: ProcessedRefill | null;
}

export interface RefillValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validates a new or edited refill record against existing history
 */
export function validateRefillInput(
  odometer: number | string,
  litres: number | string,
  pricePerLitre: number | string,
  previousOdometer: number = 0
): RefillValidationResult {
  const odo = typeof odometer === 'string' ? parseFloat(odometer) : odometer;
  const qty = typeof litres === 'string' ? parseFloat(litres) : litres;
  const price = typeof pricePerLitre === 'string' ? parseFloat(pricePerLitre) : pricePerLitre;

  if (isNaN(odo) || odo <= 0) {
    return { isValid: false, error: 'Odometer reading must be a positive number greater than 0.' };
  }

  if (isNaN(qty) || qty <= 0) {
    return { isValid: false, error: 'Petrol litres must be a positive number greater than 0.' };
  }

  if (isNaN(price) || price < 0) {
    return { isValid: false, error: 'Price per litre must be greater than or equal to 0.' };
  }

  if (previousOdometer > 0 && odo < previousOdometer) {
    return {
      isValid: false,
      error: `Odometer reading (${odo} km) cannot be less than previous record (${previousOdometer} km). Decreasing odometer reading is impossible.`
    };
  }

  if (previousOdometer > 0 && odo === previousOdometer) {
    return {
      isValid: false,
      error: `Odometer reading (${odo} km) is identical to previous record. No distance travelled.`
    };
  }

  return { isValid: true };
}

/**
 * Deterministically sorts refills chronologically:
 * Primary: odometerReading ascending
 * Secondary: date ascending, createdAt ascending
 */
export function sortRefillsChronologically<T extends { odometerReading: number; date: string; createdAt?: string }>(
  refills: T[]
): T[] {
  return [...refills].sort((a, b) => {
    if (a.odometerReading !== b.odometerReading) {
      return a.odometerReading - b.odometerReading;
    }
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}

/**
 * Recalculates all refills using the Full-Tank-to-Full-Tank methodology.
 * 
 * Rules:
 * 1. Partial refills do NOT generate a KM/L mileage value.
 * 2. The first Full Tank record establishes the baseline (no mileage calculated).
 * 3. Starting full-tank litres are strictly EXCLUDED from the interval fuel.
 * 4. Ending full-tank litres and all intervening partial refill litres are INCLUDED.
 * 5. intervalDistance = currentFullTank.odometer - previousFullTank.odometer.
 * 6. intervalFuel = sum of all refill litres after previousFullTank through currentFullTank.
 * 7. intervalCost = sum of all refill totalCost after previousFullTank through currentFullTank.
 * 8. mileage = intervalDistance / intervalFuel.
 * 9. costPerKm = intervalCost / intervalDistance.
 */
export function calculatePetrolIntervals(refills: PetrolRefill[]): ProcessedRefill[] {
  if (!refills || refills.length === 0) return [];

  const sorted = sortRefillsChronologically(refills);
  const result: ProcessedRefill[] = [];

  let lastFullTankIndex = -1;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    const stepDistance = prev ? Math.max(0, current.odometerReading - prev.odometerReading) : 0;
    const isFullTank = Boolean(current.isFullTank);

    if (!isFullTank) {
      // Partial refill: does not generate independent mileage
      result.push({
        ...current,
        isFullTank: false,
        calculationType: 'partial',
        stepDistance,
        intervalDistance: 0,
        intervalFuel: 0,
        intervalCost: 0,
        refillCycleStatus: 'in_progress',
        distanceTravelled: stepDistance,
        mileageKmpl: 0,
        costPerKm: 0,
        displayMileage: '—',
        displayCostPerKm: '—',
        distanceUntilNextRefill: null,
        refillCostPerKm: null,
        isRefillSegmentComplete: false,
        displayDistanceUntilNext: '—',
        displayRefillCostPerKm: '—'
      });
      continue;
    }

    // It is a Full Tank
    if (lastFullTankIndex === -1) {
      // First Full Tank: establishes baseline
      lastFullTankIndex = i;
      result.push({
        ...current,
        isFullTank: true,
        calculationType: 'baseline',
        stepDistance,
        intervalDistance: 0,
        intervalFuel: 0,
        intervalCost: 0,
        refillCycleStatus: 'in_progress',
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        displayMileage: 'Baseline',
        displayCostPerKm: '—',
        distanceUntilNextRefill: null,
        refillCostPerKm: null,
        isRefillSegmentComplete: false,
        displayDistanceUntilNext: '—',
        displayRefillCostPerKm: '—'
      });
    } else {
      // Subsequent Full Tank: completes an interval from sorted[lastFullTankIndex]
      const prevFullTank = sorted[lastFullTankIndex];
      const intervalDistance = Math.max(0, current.odometerReading - prevFullTank.odometerReading);

      // Sum litres and costs of all refills strictly AFTER prevFullTank through and including current
      let intervalFuel = 0;
      let intervalCost = 0;

      for (let j = lastFullTankIndex + 1; j <= i; j++) {
        intervalFuel += sorted[j].litres || 0;
        intervalCost = addMoney(intervalCost, sorted[j].totalCost || 0);
      }

      const mileage = intervalFuel > 0 && intervalDistance > 0
        ? parseFloat((intervalDistance / intervalFuel).toFixed(2))
        : 0;

      const costKm = intervalDistance > 0
        ? parseFloat((intervalCost / intervalDistance).toFixed(2))
        : 0;

      result.push({
        ...current,
        isFullTank: true,
        calculationType: 'completed',
        stepDistance,
        intervalDistance,
        intervalFuel: parseFloat(intervalFuel.toFixed(2)),
        intervalCost,
        refillCycleStatus: 'in_progress',
        distanceTravelled: intervalDistance,
        mileageKmpl: mileage,
        costPerKm: costKm,
        displayMileage: mileage > 0 ? `${mileage.toFixed(2)} km/L` : '—',
        displayCostPerKm: costKm > 0 ? `${costKm.toFixed(2)} PKR` : '—',
        distanceUntilNextRefill: null,
        refillCostPerKm: null,
        isRefillSegmentComplete: false,
        displayDistanceUntilNext: '—',
        displayRefillCostPerKm: '—'
      });

      // Update pointer to this full tank checkpoint
      lastFullTankIndex = i;
    }
  }

  // Forward Pass: Refill-to-Refill (Daily Tracking)
  // Associate the completed distance and cost/KM with the CURRENT refill
  for (let i = 0; i < result.length; i++) {
    if (i < result.length - 1) {
      const next = result[i + 1];
      const distUntilNext = Math.max(0, next.odometerReading - result[i].odometerReading);
      const costKm = distUntilNext > 0
        ? parseFloat((result[i].totalCost / distUntilNext).toFixed(2))
        : null;

      result[i].distanceUntilNextRefill = distUntilNext;
      result[i].refillCostPerKm = costKm;
      result[i].isRefillSegmentComplete = true;
      result[i].refillCycleStatus = distUntilNext > 0 ? 'completed' : 'in_progress';
      result[i].displayDistanceUntilNext = `+${distUntilNext} km`;
      result[i].displayRefillCostPerKm = costKm !== null ? `${costKm.toFixed(2)} PKR/KM` : '—';
    } else {
      // Latest recorded refill has no following refill yet
      result[i].distanceUntilNextRefill = null;
      result[i].refillCostPerKm = null;
      result[i].isRefillSegmentComplete = false;
      result[i].refillCycleStatus = 'in_progress';
      result[i].displayDistanceUntilNext = 'In Progress';
      result[i].displayRefillCostPerKm = '—';
    }
  }

  return result;
}

/**
 * Calculates monthly aggregated petrol statistics.
 * 
 * Rules:
 * 1. Completed intervals are assigned to the month of their ENDING Full Tank refill date.
 * 2. Average mileage is a WEIGHTED aggregate of completed full-tank intervals:
 *    total distance across completed intervals / total fuel across completed intervals
 *    (NOT an arithmetic average of KM/L numbers).
 * 3. If no intervals were completed in the month, avgMileage is 0.
 * 4. Monthly litres & cost are the actual fuel purchases made in that calendar month.
 * 5. Logged travel is the sum of step distances of refills recorded in that month.
 * 6. Refill-to-refill completed metrics are attributed to the month of the starting refill purchase.
 * 7. avgRefillCostPerKm is a WEIGHTED aggregate of completed refill-to-refill legs:
 *    total completed refill cost / total completed refill distance.
 */
export function calculateMonthlyPetrolStats(
  allRefills: PetrolRefill[],
  selectedMonth: string // YYYY-MM
): MonthlyPetrolStats {
  const processed = calculatePetrolIntervals(allRefills);

  // Filter completed full-tank intervals belonging to this month by ending full tank date
  const completedInMonth = processed.filter(
    r => r.calculationType === 'completed' && r.date.startsWith(selectedMonth)
  );

  let totalIntervalDistance = 0;
  let totalIntervalFuel = 0;
  let totalIntervalCost = 0;

  for (const interval of completedInMonth) {
    totalIntervalDistance += interval.intervalDistance;
    totalIntervalFuel += interval.intervalFuel;
    totalIntervalCost = addMoney(totalIntervalCost, interval.intervalCost);
  }

  // Weighted fuel economy: total distance / total fuel
  const avgMileage = totalIntervalFuel > 0 && totalIntervalDistance > 0
    ? parseFloat((totalIntervalDistance / totalIntervalFuel).toFixed(2))
    : 0;

  // Calendar month purchases and logged checkpoints
  const monthlyRefills = processed.filter(r => r.date.startsWith(selectedMonth));
  const monthlyLitres = monthlyRefills.reduce((sum, r) => sum + (r.litres || 0), 0);
  const monthlyCost = monthlyRefills.reduce((sum, r) => addMoney(sum, r.totalCost || 0), 0);
  const loggedTravelKm = monthlyRefills.reduce((sum, r) => sum + (r.stepDistance || 0), 0);

  const verifiedCostPerKm = totalIntervalDistance > 0
    ? parseFloat((totalIntervalCost / totalIntervalDistance).toFixed(2))
    : 0;

  // Refill-to-Refill completed segments in this calendar month
  // Attributed to the month of the starting refill purchase date
  const completedRefillsInMonth = monthlyRefills.filter(
    r => r.isRefillSegmentComplete && r.distanceUntilNextRefill !== null && r.distanceUntilNextRefill > 0
  );
  let totalCompletedRefillDistance = 0;
  let totalCompletedRefillCost = 0;

  for (const r of completedRefillsInMonth) {
    totalCompletedRefillDistance += r.distanceUntilNextRefill!;
    totalCompletedRefillCost = addMoney(totalCompletedRefillCost, r.totalCost || 0);
  }

  const avgRefillCostPerKm = totalCompletedRefillDistance > 0
    ? parseFloat((totalCompletedRefillCost / totalCompletedRefillDistance).toFixed(2))
    : 0;

  // Pointers to latest refill overall and last completed leg
  const latestRefill = processed.length > 0 ? processed[processed.length - 1] : null;
  const previousCompletedRefill = processed.length > 1 ? processed[processed.length - 2] : null;

  return {
    completedIntervalsCount: completedInMonth.length,
    avgMileage,
    totalIntervalDistance,
    totalIntervalFuel: parseFloat(totalIntervalFuel.toFixed(2)),
    totalIntervalCost,
    verifiedCostPerKm,
    monthlyLitres: parseFloat(monthlyLitres.toFixed(2)),
    monthlyCost,
    loggedTravelKm,
    costPerKm: avgRefillCostPerKm,
    completedRefillsCount: completedRefillsInMonth.length,
    totalCompletedRefillDistance,
    totalCompletedRefillCost,
    avgRefillCostPerKm,
    completedRefillCyclesCount: completedRefillsInMonth.length,
    refillCycleDistanceKm: totalCompletedRefillDistance,
    refillCycleCost: totalCompletedRefillCost,
    latestRefill,
    previousCompletedRefill
  };
}
