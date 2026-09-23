import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePetrolIntervals,
  calculateMonthlyPetrolStats,
  validateRefillInput,
  sortRefillsChronologically,
  toSnakeCase,
  toCamelCase
} from '../src/utils/petrolCalculations.ts';
import type { PetrolRefill } from '../src/types/index.ts';

describe('petrolMileage.test.ts - Full-Tank Fuel Economy Methodology', () => {
  // A. First full tank creates baseline, no mileage.
  it('A. First full tank creates baseline, no mileage calculated', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'ref1',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed.length, 1);
    assert.strictEqual(processed[0].calculationType, 'baseline');
    assert.strictEqual(processed[0].mileageKmpl, 0);
    assert.strictEqual(processed[0].displayMileage, 'Baseline');
    assert.strictEqual(processed[0].intervalDistance, 0);
  });

  // B. Two consecutive full tanks: 10000 Full -> 10300 Full, 10 L => 30 KM/L
  it('B. Two consecutive full tanks: 10000 Full -> 10300 Full, 10 L => 30 KM/L', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'ref1',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 8, // starting litres must be excluded
        pricePerLitre: 270,
        totalCost: 2160,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'ref2',
        date: '2026-09-05',
        odometerReading: 10300,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-05T10:00:00Z'
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[0].calculationType, 'baseline');
    assert.strictEqual(processed[1].calculationType, 'completed');
    assert.strictEqual(processed[1].intervalDistance, 300);
    assert.strictEqual(processed[1].intervalFuel, 10);
    assert.strictEqual(processed[1].mileageKmpl, 30);
    assert.strictEqual(processed[1].costPerKm, 9); // 2700 / 300 = 9 PKR/KM
  });

  // C. Partial refills between full tanks:
  // 10000 Full
  // 10100 partial 3 L
  // 10200 partial 3 L
  // 10400 full 7 L
  // => 400 / 13 = 30.769... -> 30.77 KM/L
  it('C. Partial refills between full tanks correctly aggregated (400 KM / 13 L = 30.77 KM/L)', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'refA',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 5, // baseline litres excluded
        pricePerLitre: 270,
        totalCost: 1350,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'refB',
        date: '2026-09-03',
        odometerReading: 10100,
        litres: 3,
        pricePerLitre: 270,
        totalCost: 810,
        isFullTank: false, // partial
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-03T10:00:00Z'
      },
      {
        id: 'refC',
        date: '2026-09-06',
        odometerReading: 10200,
        litres: 3,
        pricePerLitre: 270,
        totalCost: 810,
        isFullTank: false, // partial
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-06T10:00:00Z'
      },
      {
        id: 'refD',
        date: '2026-09-10',
        odometerReading: 10400,
        litres: 7,
        pricePerLitre: 270,
        totalCost: 1890,
        isFullTank: true, // full tank completes interval
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-10T10:00:00Z'
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[0].calculationType, 'baseline');
    assert.strictEqual(processed[1].calculationType, 'partial');
    assert.strictEqual(processed[2].calculationType, 'partial');
    assert.strictEqual(processed[3].calculationType, 'completed');

    // Distance = 10400 - 10000 = 400 KM
    assert.strictEqual(processed[3].intervalDistance, 400);
    // Fuel = 3 + 3 + 7 = 13 L
    assert.strictEqual(processed[3].intervalFuel, 13);
    // Mileage = 400 / 13 = 30.77 KM/L
    assert.strictEqual(processed[3].mileageKmpl, 30.77);
    // Interval Cost = 810 + 810 + 1890 = 3510 PKR -> 3510 / 400 = 8.78 PKR/KM
    assert.strictEqual(processed[3].intervalCost, 3510);
    assert.strictEqual(processed[3].costPerKm, 8.78);
  });

  // D. Starting full-tank litres are excluded.
  it('D. Starting full-tank litres are strictly excluded from interval fuel', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'ref1',
        date: '2026-09-01',
        odometerReading: 5000,
        litres: 25, // Must NOT be in the interval
        pricePerLitre: 270,
        totalCost: 6750,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'ref2',
        date: '2026-09-05',
        odometerReading: 5300,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-05T10:00:00Z'
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[1].intervalFuel, 10);
    assert.notStrictEqual(processed[1].intervalFuel, 35);
  });

  // E. Ending full-tank litres are included.
  it('E. Ending full-tank litres are strictly included in interval fuel', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'ref1',
        date: '2026-09-01',
        odometerReading: 5000,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'ref2',
        date: '2026-09-05',
        odometerReading: 5400,
        litres: 12.5,
        pricePerLitre: 270,
        totalCost: 3375,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-05T10:00:00Z'
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[1].intervalFuel, 12.5);
    assert.strictEqual(processed[1].mileageKmpl, 32); // 400 / 12.5 = 32
  });

  // F. Partial refill does not receive independent mileage.
  it('F. Partial refill does not receive independent mileage', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'ref1',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'ref2',
        date: '2026-09-03',
        odometerReading: 10150,
        litres: 2,
        pricePerLitre: 270,
        totalCost: 540,
        isFullTank: false, // partial refill
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-03T10:00:00Z'
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[1].calculationType, 'partial');
    assert.strictEqual(processed[1].mileageKmpl, 0);
    assert.strictEqual(processed[1].displayMileage, '—');
    assert.strictEqual(processed[1].stepDistance, 150); // step distance preserved
  });

  // G. Historical edit recalculates interval.
  it('G. Historical edit recalculates affected interval accurately', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'ref1',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'ref2',
        date: '2026-09-05',
        odometerReading: 10300,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-05T10:00:00Z'
      }
    ];

    let processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[1].mileageKmpl, 30); // 300 / 10

    // Edit historical odometer of ref1 from 10000 to 10100
    refills[0].odometerReading = 10100;
    processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[1].intervalDistance, 200); // 10300 - 10100 = 200
    assert.strictEqual(processed[1].mileageKmpl, 20); // 200 / 10 = 20
  });

  // H. Historical delete recalculates interval.
  it('H. Historical delete merges surrounding partials/interval', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'ref1',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'ref2',
        date: '2026-09-04',
        odometerReading: 10150,
        litres: 5,
        pricePerLitre: 270,
        totalCost: 1350,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-04T10:00:00Z'
      },
      {
        id: 'ref3',
        date: '2026-09-08',
        odometerReading: 10300,
        litres: 5,
        pricePerLitre: 270,
        totalCost: 1350,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-08T10:00:00Z'
      }
    ];

    let processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[2].intervalFuel, 10); // 5 + 5
    assert.strictEqual(processed[2].mileageKmpl, 30); // 300 / 10

    // Delete ref2 (the partial refill)
    const afterDelete = refills.filter(r => r.id !== 'ref2');
    processed = calculatePetrolIntervals(afterDelete);
    assert.strictEqual(processed[1].intervalFuel, 5); // only ref3 litres now
    assert.strictEqual(processed[1].mileageKmpl, 60); // 300 / 5
  });

  // I. Changing partial -> full changes interval boundaries correctly.
  it('I. Changing partial -> full splits one large interval into two intervals', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'ref1',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'ref2',
        date: '2026-09-05',
        odometerReading: 10200,
        litres: 5,
        pricePerLitre: 270,
        totalCost: 1350,
        isFullTank: false, // Initially partial
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-05T10:00:00Z'
      },
      {
        id: 'ref3',
        date: '2026-09-10',
        odometerReading: 10500,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-10T10:00:00Z'
      }
    ];

    let processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[2].intervalDistance, 500); // 10500 - 10000
    assert.strictEqual(processed[2].intervalFuel, 15); // 5 + 10 = 15

    // Change ref2 from Partial to Full Tank
    refills[1].isFullTank = true;
    processed = calculatePetrolIntervals(refills);

    // Interval 1: ref1 -> ref2 (200 KM / 5 L = 40 KM/L)
    assert.strictEqual(processed[1].calculationType, 'completed');
    assert.strictEqual(processed[1].intervalDistance, 200);
    assert.strictEqual(processed[1].intervalFuel, 5);
    assert.strictEqual(processed[1].mileageKmpl, 40);

    // Interval 2: ref2 -> ref3 (300 KM / 10 L = 30 KM/L)
    assert.strictEqual(processed[2].calculationType, 'completed');
    assert.strictEqual(processed[2].intervalDistance, 300);
    assert.strictEqual(processed[2].intervalFuel, 10);
    assert.strictEqual(processed[2].mileageKmpl, 30);
  });

  // J. Changing full -> partial merges/recalculates intervals correctly.
  it('J. Changing full -> partial merges two intervals into one continuous interval', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'ref1',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'ref2',
        date: '2026-09-05',
        odometerReading: 10200,
        litres: 5,
        pricePerLitre: 270,
        totalCost: 1350,
        isFullTank: true, // Full Tank
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-05T10:00:00Z'
      },
      {
        id: 'ref3',
        date: '2026-09-10',
        odometerReading: 10500,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-10T10:00:00Z'
      }
    ];

    // Change ref2 from Full Tank to Partial
    refills[1].isFullTank = false;
    const processed = calculatePetrolIntervals(refills);

    assert.strictEqual(processed[1].calculationType, 'partial');
    assert.strictEqual(processed[1].mileageKmpl, 0);

    assert.strictEqual(processed[2].calculationType, 'completed');
    assert.strictEqual(processed[2].intervalDistance, 500); // 10500 - 10000
    assert.strictEqual(processed[2].intervalFuel, 15); // 5 + 10
    assert.strictEqual(processed[2].mileageKmpl, 33.33); // 500 / 15
  });

  // K. Month-boundary interval is assigned consistently to ending full-tank month.
  it('K. Month-boundary interval assigned consistently to ending full-tank month', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'ref1',
        date: '2026-08-28', // August
        odometerReading: 10000,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-08-28T10:00:00Z'
      },
      {
        id: 'ref2',
        date: '2026-08-30', // August partial
        odometerReading: 10100,
        litres: 3,
        pricePerLitre: 270,
        totalCost: 810,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-08-30T10:00:00Z'
      },
      {
        id: 'ref3',
        date: '2026-09-04', // September ending full tank
        odometerReading: 10400,
        litres: 7,
        pricePerLitre: 270,
        totalCost: 1890,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-04T10:00:00Z'
      }
    ];

    // August stats: no completed interval ends in August
    const augStats = calculateMonthlyPetrolStats(refills, '2026-08');
    assert.strictEqual(augStats.completedIntervalsCount, 0);
    assert.strictEqual(augStats.avgMileage, 0);

    // September stats: interval ends in September, so assigned to September
    const sepStats = calculateMonthlyPetrolStats(refills, '2026-09');
    assert.strictEqual(sepStats.completedIntervalsCount, 1);
    assert.strictEqual(sepStats.totalIntervalDistance, 400); // 10400 - 10000
    assert.strictEqual(sepStats.totalIntervalFuel, 10); // 3 + 7 = 10
    assert.strictEqual(sepStats.avgMileage, 40); // 400 / 10 = 40 KM/L
  });

  // L. Weighted aggregate mileage calculation is correct.
  it('L. Weighted aggregate monthly mileage calculation is correct (800 KM / 30 L = 26.67 KM/L, NOT (30+25)/2=27.5)', () => {
    // Interval A: 300 KM on 10 L = 30 KM/L
    // Interval B: 500 KM on 20 L = 25 KM/L
    // Weighted total: 800 KM / 30 L = 26.67 KM/L
    const refills: PetrolRefill[] = [
      {
        id: 'r1',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'r2',
        date: '2026-09-05',
        odometerReading: 10300,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true, // Interval A completes: 300 km / 10 L = 30
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-05T10:00:00Z'
      },
      {
        id: 'r3',
        date: '2026-09-12',
        odometerReading: 10800,
        litres: 20,
        pricePerLitre: 270,
        totalCost: 5400,
        isFullTank: true, // Interval B completes: 500 km / 20 L = 25
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-12T10:00:00Z'
      }
    ];

    const stats = calculateMonthlyPetrolStats(refills, '2026-09');
    assert.strictEqual(stats.completedIntervalsCount, 2);
    assert.strictEqual(stats.totalIntervalDistance, 800);
    assert.strictEqual(stats.totalIntervalFuel, 30);
    // 800 / 30 = 26.67, NOT 27.5!
    assert.strictEqual(stats.avgMileage, 26.67);
    assert.notStrictEqual(stats.avgMileage, 27.5);
  });

  // M. Invalid decreasing odometer is rejected/flagged.
  it('M. Invalid decreasing odometer is rejected with validation error', () => {
    const validResult = validateRefillInput(15000, 10, 270, 14500);
    assert.strictEqual(validResult.isValid, true);

    const invalidDecreasing = validateRefillInput(14000, 10, 270, 14500);
    assert.strictEqual(invalidDecreasing.isValid, false);
    assert.ok(invalidDecreasing.error?.includes('cannot be less'));

    const invalidIdentical = validateRefillInput(14500, 10, 270, 14500);
    assert.strictEqual(invalidIdentical.isValid, false);
    assert.ok(invalidIdentical.error?.includes('identical'));

    const invalidLitres = validateRefillInput(15000, 0, 270, 14500);
    assert.strictEqual(invalidLitres.isValid, false);
    assert.ok(invalidLitres.error?.includes('positive number'));
  });

  // N. Existing legacy record without isFullTank remains safe.
  it('N. Existing legacy record without isFullTank defaults safely to false / partial refill', () => {
    const legacyRefills: any[] = [
      {
        id: 'legacy_1',
        date: '2026-09-01',
        odometerReading: 12000,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700
        // isFullTank is omitted / undefined
      },
      {
        id: 'legacy_2',
        date: '2026-09-08',
        odometerReading: 12300,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700
        // isFullTank is omitted / undefined
      }
    ];

    const processed = calculatePetrolIntervals(legacyRefills);
    assert.strictEqual(processed.length, 2);
    assert.strictEqual(processed[0].isFullTank, false);
    assert.strictEqual(processed[0].calculationType, 'partial');
    assert.strictEqual(processed[1].isFullTank, false);
    assert.strictEqual(processed[1].calculationType, 'partial');
    assert.strictEqual(processed[0].mileageKmpl, 0);
    assert.strictEqual(processed[1].mileageKmpl, 0);
  });

  // O. Supabase serializer maps: isFullTank <-> is_full_tank
  it('O. Supabase serializer maps: isFullTank <-> is_full_tank bidirectionally', () => {
    const clientRecord: Partial<PetrolRefill> = {
      id: 'pet_1',
      date: '2026-09-01',
      odometerReading: 10000,
      litres: 10.5,
      pricePerLitre: 270,
      totalCost: 2835,
      isFullTank: true,
      distanceTravelled: 300,
      mileageKmpl: 28.57,
      costPerKm: 9.45
    };

    // Client -> Supabase (toSnakeCase)
    const dbRecord = toSnakeCase(clientRecord);
    assert.strictEqual(dbRecord.is_full_tank, true);
    assert.strictEqual(dbRecord.odometer_reading, 10000);
    assert.strictEqual(dbRecord.price_per_litre, 270);
    assert.strictEqual(dbRecord.total_cost, 2835);
    assert.strictEqual(dbRecord.distance_travelled, 300);
    assert.strictEqual(dbRecord.mileage_kmpl, 28.57);
    assert.strictEqual(dbRecord.cost_per_km, 9.45);

    // Supabase -> Client (toCamelCase)
    const reconstituted = toCamelCase(dbRecord);
    assert.strictEqual(reconstituted.isFullTank, true);
    assert.strictEqual(reconstituted.odometerReading, 10000);
    assert.strictEqual(reconstituted.pricePerLitre, 270);
    assert.strictEqual(reconstituted.totalCost, 2835);
    assert.strictEqual(reconstituted.distanceTravelled, 300);
    assert.strictEqual(reconstituted.mileageKmpl, 28.57);
    assert.strictEqual(reconstituted.costPerKm, 9.45);
  });

  // P. Non-regression of sorting stability
  it('P. Preserves chronological ordering with tie-breaking on date and createdAt', () => {
    const unsorted: PetrolRefill[] = [
      {
        id: 'r3',
        date: '2026-09-05',
        odometerReading: 10500,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-05T10:00:00Z'
      },
      {
        id: 'r1',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'r2',
        date: '2026-09-03',
        odometerReading: 10200,
        litres: 5,
        pricePerLitre: 270,
        totalCost: 1350,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-03T10:00:00Z'
      }
    ];

    const sorted = sortRefillsChronologically(unsorted);
    assert.strictEqual(sorted[0].id, 'r1');
    assert.strictEqual(sorted[1].id, 'r2');
    assert.strictEqual(sorted[2].id, 'r3');
  });
  // Q. Every refill gets a practical distance/cost cycle when the next refill exists.
  it('Q. Refill-to-refill: Rs 500 at 10000 -> next refill 10080 = 80 KM and 6.25 PKR/KM', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'cycle_1',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 2,
        pricePerLitre: 250,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'cycle_2',
        date: '2026-09-03',
        odometerReading: 10080,
        litres: 3,
        pricePerLitre: 250,
        totalCost: 750,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-03T10:00:00Z'
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[0].distanceUntilNextRefill, 80);
    assert.strictEqual(processed[0].refillCostPerKm, 6.25);
    assert.strictEqual(processed[0].refillCycleStatus, 'completed');
    assert.strictEqual(processed[1].refillCycleStatus, 'in_progress');
    assert.strictEqual(processed[1].distanceUntilNextRefill, null);
    assert.strictEqual(processed[1].refillCostPerKm, null);
    // Practical tracking must not invent verified KM/L for partial refills.
    assert.strictEqual(processed[0].mileageKmpl, 0);
    assert.strictEqual(processed[1].mileageKmpl, 0);
  });

  // R. Practical cycle works regardless of Full/Partial flag.
  it('R. Full and partial refills both receive refill-to-refill practical cost tracking', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'r1',
        date: '2026-09-01',
        odometerReading: 20000,
        litres: 4,
        pricePerLitre: 250,
        totalCost: 1000,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'r2',
        date: '2026-09-04',
        odometerReading: 20100,
        litres: 2,
        pricePerLitre: 250,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-04T10:00:00Z'
      },
      {
        id: 'r3',
        date: '2026-09-07',
        odometerReading: 20150,
        litres: 3,
        pricePerLitre: 250,
        totalCost: 750,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-07T10:00:00Z'
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[0].distanceUntilNextRefill, 100);
    assert.strictEqual(processed[0].refillCostPerKm, 10);
    assert.strictEqual(processed[1].distanceUntilNextRefill, 50);
    assert.strictEqual(processed[1].refillCostPerKm, 10);
    assert.strictEqual(processed[2].refillCycleStatus, 'in_progress');

    // Verified full-tank mileage remains independent and intact.
    assert.strictEqual(processed[2].calculationType, 'completed');
    assert.strictEqual(processed[2].intervalDistance, 150);
    assert.strictEqual(processed[2].intervalFuel, 5);
    assert.strictEqual(processed[2].mileageKmpl, 30);
  });

  // S. Monthly refill cost/km is weighted by completed refill-cycle distance.
  it('S. Monthly Avg Refill Cost/KM uses weighted refill cost divided by completed refill-cycle distance', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'm1',
        date: '2026-09-01',
        odometerReading: 30000,
        litres: 2,
        pricePerLitre: 250,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'm2',
        date: '2026-09-05',
        odometerReading: 30100,
        litres: 4,
        pricePerLitre: 250,
        totalCost: 1000,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-05T10:00:00Z'
      },
      {
        id: 'm3',
        date: '2026-09-10',
        odometerReading: 30300,
        litres: 2,
        pricePerLitre: 250,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-10T10:00:00Z'
      }
    ];

    const stats = calculateMonthlyPetrolStats(refills, '2026-09');
    assert.strictEqual(stats.completedRefillCyclesCount, 2);
    assert.strictEqual(stats.refillCycleDistanceKm, 300);
    assert.strictEqual(stats.refillCycleCost, 1500);
    assert.strictEqual(stats.avgRefillCostPerKm, 5);
    assert.strictEqual(stats.costPerKm, 5);
  });

  // T. Cross-month cycle belongs to the month when the fuel was purchased.
  it('T. Refill-cycle performance is assigned to the starting refill month', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'x1',
        date: '2026-09-30',
        odometerReading: 40000,
        litres: 2,
        pricePerLitre: 250,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-30T10:00:00Z'
      },
      {
        id: 'x2',
        date: '2026-10-03',
        odometerReading: 40100,
        litres: 2,
        pricePerLitre: 250,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-10-03T10:00:00Z'
      }
    ];

    const sep = calculateMonthlyPetrolStats(refills, '2026-09');
    const oct = calculateMonthlyPetrolStats(refills, '2026-10');
    assert.strictEqual(sep.completedRefillCyclesCount, 1);
    assert.strictEqual(sep.refillCycleDistanceKm, 100);
    assert.strictEqual(sep.avgRefillCostPerKm, 5);
    assert.strictEqual(oct.completedRefillCyclesCount, 0);
    assert.strictEqual(oct.avgRefillCostPerKm, 0);
  });

  // U. Historical insertion deterministically re-splits refill cycles.
  it('U. Historical insert deterministically recalculates refill-to-refill cycles', () => {
    const base: PetrolRefill[] = [
      {
        id: 'h1',
        date: '2026-09-01',
        odometerReading: 50000,
        litres: 2,
        pricePerLitre: 250,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'h3',
        date: '2026-09-10',
        odometerReading: 50200,
        litres: 2,
        pricePerLitre: 250,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-10T10:00:00Z'
      }
    ];

    let processed = calculatePetrolIntervals(base);
    assert.strictEqual(processed[0].distanceUntilNextRefill, 200);
    assert.strictEqual(processed[0].refillCostPerKm, 2.5);

    const withHistoricalInsert: PetrolRefill[] = [
      ...base,
      {
        id: 'h2',
        date: '2026-09-05',
        odometerReading: 50100,
        litres: 1,
        pricePerLitre: 250,
        totalCost: 250,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-05T10:00:00Z'
      }
    ];

    processed = calculatePetrolIntervals(withHistoricalInsert);
    assert.strictEqual(processed[0].id, 'h1');
    assert.strictEqual(processed[0].distanceUntilNextRefill, 100);
    assert.strictEqual(processed[0].refillCostPerKm, 5);
    assert.strictEqual(processed[1].id, 'h2');
    assert.strictEqual(processed[1].distanceUntilNextRefill, 100);
    assert.strictEqual(processed[1].refillCostPerKm, 2.5);
    assert.strictEqual(processed[2].refillCycleStatus, 'in_progress');
  });

});

describe('Hybrid Fuel Tracking Model - Refill-to-Refill & Full-Tank Integration', () => {
  // A. Refill-to-Refill: 10000 (Rs 500) -> 10080 (Rs 700)
  it('A. Refill A distance until next refill = 80 KM and refillCostPerKm = 500/80 = 6.25 PKR/KM', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'refA',
        date: '2026-09-10',
        odometerReading: 10000,
        litres: 1.92,
        pricePerLitre: 260.42,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-10T09:00:00Z'
      },
      {
        id: 'refB',
        date: '2026-09-14',
        odometerReading: 10080,
        litres: 2.69,
        pricePerLitre: 260.22,
        totalCost: 700,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0,
        createdAt: '2026-09-14T09:00:00Z'
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed.length, 2);

    // Refill A: completed segment
    assert.strictEqual(processed[0].distanceUntilNextRefill, 80);
    assert.strictEqual(processed[0].refillCostPerKm, 6.25);
    assert.strictEqual(processed[0].isRefillSegmentComplete, true);
    assert.strictEqual(processed[0].displayDistanceUntilNext, '+80 km');
    assert.strictEqual(processed[0].displayRefillCostPerKm, '6.25 PKR/KM');

    // Refill B: latest refill (in progress)
    assert.strictEqual(processed[1].distanceUntilNextRefill, null);
    assert.strictEqual(processed[1].refillCostPerKm, null);
    assert.strictEqual(processed[1].isRefillSegmentComplete, false);
    assert.strictEqual(processed[1].displayDistanceUntilNext, 'In Progress');
    assert.strictEqual(processed[1].displayRefillCostPerKm, '—');
  });

  // B. Refill-to-Refill 3 consecutive refills: 10000 (Rs 500) -> 10080 (Rs 700) -> 10190 (Rs 500)
  it('B. Three refills: First = 80 KM (Rs 6.25), Second = 110 KM (Rs 6.36), Third = In Progress', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'r1',
        date: '2026-09-10',
        odometerReading: 10000,
        litres: 1.92,
        pricePerLitre: 260,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      {
        id: 'r2',
        date: '2026-09-14',
        odometerReading: 10080,
        litres: 2.69,
        pricePerLitre: 260,
        totalCost: 700,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      {
        id: 'r3',
        date: '2026-09-18',
        odometerReading: 10190,
        litres: 1.92,
        pricePerLitre: 260,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed.length, 3);

    // r1: 10000 -> 10080: 80 km, 500/80 = 6.25
    assert.strictEqual(processed[0].distanceUntilNextRefill, 80);
    assert.strictEqual(processed[0].refillCostPerKm, 6.25);
    assert.strictEqual(processed[0].isRefillSegmentComplete, true);

    // r2: 10080 -> 10190: 110 km, 700/110 = 6.3636... -> 6.36
    assert.strictEqual(processed[1].distanceUntilNextRefill, 110);
    assert.strictEqual(processed[1].refillCostPerKm, 6.36);
    assert.strictEqual(processed[1].isRefillSegmentComplete, true);

    // r3: latest -> in progress
    assert.strictEqual(processed[2].distanceUntilNextRefill, null);
    assert.strictEqual(processed[2].refillCostPerKm, null);
    assert.strictEqual(processed[2].isRefillSegmentComplete, false);
    assert.strictEqual(processed[2].displayDistanceUntilNext, 'In Progress');
  });

  // C. Historical insertion splits segment
  it('C. Inserting a historical refill between two records splits the segment correctly', () => {
    const initial: PetrolRefill[] = [
      {
        id: 'r1',
        date: '2026-09-10',
        odometerReading: 10000,
        litres: 1.92,
        pricePerLitre: 260,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      {
        id: 'r3',
        date: '2026-09-18',
        odometerReading: 10080,
        litres: 2.69,
        pricePerLitre: 260,
        totalCost: 700,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      }
    ];

    const before = calculatePetrolIntervals(initial);
    assert.strictEqual(before[0].distanceUntilNextRefill, 80);

    // Now insert a refill at 10040 (Rs 300)
    const inserted: PetrolRefill[] = [
      ...initial,
      {
        id: 'r2',
        date: '2026-09-14',
        odometerReading: 10040,
        litres: 1.15,
        pricePerLitre: 260,
        totalCost: 300,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      }
    ];

    const after = calculatePetrolIntervals(inserted);
    assert.strictEqual(after.length, 3);
    // r1: 10000 -> 10040 = 40 km, 500/40 = 12.50
    assert.strictEqual(after[0].distanceUntilNextRefill, 40);
    assert.strictEqual(after[0].refillCostPerKm, 12.5);
    // r2: 10040 -> 10080 = 40 km, 300/40 = 7.50
    assert.strictEqual(after[1].distanceUntilNextRefill, 40);
    assert.strictEqual(after[1].refillCostPerKm, 7.5);
    // r3: in progress
    assert.strictEqual(after[2].distanceUntilNextRefill, null);
  });

  // D. Editing odometer recalculates neighboring segments
  it('D. Editing odometer recalculates preceding and current segment distances', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'r1',
        date: '2026-09-10',
        odometerReading: 10000,
        litres: 1.92,
        pricePerLitre: 260,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      {
        id: 'r2',
        date: '2026-09-14',
        odometerReading: 10100, // edited from 10080
        litres: 2.69,
        pricePerLitre: 260,
        totalCost: 700,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      {
        id: 'r3',
        date: '2026-09-18',
        odometerReading: 10190,
        litres: 1.92,
        pricePerLitre: 260,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    // r1 -> r2: 100 km, 500/100 = 5.00
    assert.strictEqual(processed[0].distanceUntilNextRefill, 100);
    assert.strictEqual(processed[0].refillCostPerKm, 5.0);

    // r2 -> r3: 90 km, 700/90 = 7.78
    assert.strictEqual(processed[1].distanceUntilNextRefill, 90);
    assert.strictEqual(processed[1].refillCostPerKm, 7.78);
  });

  // E. Deleting refill reconnects previous and next refill correctly
  it('E. Deleting intermediate refill reconnects surrounding refills seamlessly', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'r1',
        date: '2026-09-10',
        odometerReading: 10000,
        litres: 1.92,
        pricePerLitre: 260,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      // r2 deleted
      {
        id: 'r3',
        date: '2026-09-18',
        odometerReading: 10190,
        litres: 1.92,
        pricePerLitre: 260,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed.length, 2);
    // 10190 - 10000 = 190 km, 500 / 190 = 2.63
    assert.strictEqual(processed[0].distanceUntilNextRefill, 190);
    assert.strictEqual(processed[0].refillCostPerKm, 2.63);
  });

  // F. Latest refill never fabricates distance
  it('F. Latest refill never fabricates distance and remains In Progress', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'r1',
        date: '2026-09-10',
        odometerReading: 10000,
        litres: 5,
        pricePerLitre: 260,
        totalCost: 1300,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[0].distanceUntilNextRefill, null);
    assert.strictEqual(processed[0].refillCostPerKm, null);
    assert.strictEqual(processed[0].isRefillSegmentComplete, false);
    assert.strictEqual(processed[0].displayDistanceUntilNext, 'In Progress');
    assert.strictEqual(processed[0].displayRefillCostPerKm, '—');
  });

  // G. Partial refill never gets fake Verified KM/L
  it('G. Partial refill never receives fake Verified KM/L', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'p1',
        date: '2026-09-10',
        odometerReading: 10000,
        litres: 2,
        pricePerLitre: 260,
        totalCost: 520,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      {
        id: 'p2',
        date: '2026-09-14',
        odometerReading: 10080,
        litres: 2,
        pricePerLitre: 260,
        totalCost: 520,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[0].mileageKmpl, 0);
    assert.strictEqual(processed[0].displayMileage, '—');
    assert.strictEqual(processed[1].mileageKmpl, 0);
    assert.strictEqual(processed[1].displayMileage, '—');
  });

  // H. Full-Tank Verified Mileage continues working exactly as before
  it('H. Full-Tank Verified Mileage operates identically with verified intervals', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'f1',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 8,
        pricePerLitre: 270,
        totalCost: 2160,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      {
        id: 'f2',
        date: '2026-09-05',
        odometerReading: 10300,
        litres: 10,
        pricePerLitre: 270,
        totalCost: 2700,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    assert.strictEqual(processed[0].calculationType, 'baseline');
    assert.strictEqual(processed[1].calculationType, 'completed');
    assert.strictEqual(processed[1].intervalDistance, 300);
    assert.strictEqual(processed[1].intervalFuel, 10);
    assert.strictEqual(processed[1].mileageKmpl, 30);
    assert.strictEqual(processed[1].costPerKm, 9);
    // Simultaneously has daily refill-to-refill tracking:
    assert.strictEqual(processed[0].distanceUntilNextRefill, 300);
    assert.strictEqual(processed[0].refillCostPerKm, 7.2); // 2160 / 300 = 7.20
  });

  // I. Partial refills between two Full Tanks continue contributing litres to Full-Tank interval
  it('I. Partial refills between Full Tanks contribute litres and cost to Full-Tank interval', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'r1',
        date: '2026-09-01',
        odometerReading: 10000,
        litres: 5,
        pricePerLitre: 270,
        totalCost: 1350,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      {
        id: 'r2',
        date: '2026-09-03',
        odometerReading: 10100,
        litres: 3,
        pricePerLitre: 270,
        totalCost: 810,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      {
        id: 'r3',
        date: '2026-09-05',
        odometerReading: 10200,
        litres: 3,
        pricePerLitre: 270,
        totalCost: 810,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      {
        id: 'r4',
        date: '2026-09-08',
        odometerReading: 10400,
        litres: 7,
        pricePerLitre: 270,
        totalCost: 1890,
        isFullTank: true,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      }
    ];

    const processed = calculatePetrolIntervals(refills);
    // Ending full tank (r4): 400 KM / (3 + 3 + 7 = 13 L) = 30.77 KM/L
    assert.strictEqual(processed[3].calculationType, 'completed');
    assert.strictEqual(processed[3].intervalDistance, 400);
    assert.strictEqual(processed[3].intervalFuel, 13);
    assert.strictEqual(processed[3].mileageKmpl, 30.77);

    // Each leg has its own daily refill distance and cost/km:
    assert.strictEqual(processed[0].distanceUntilNextRefill, 100); // 10000 -> 10100
    assert.strictEqual(processed[0].refillCostPerKm, 13.5); // 1350 / 100
    assert.strictEqual(processed[1].distanceUntilNextRefill, 100); // 10100 -> 10200
    assert.strictEqual(processed[1].refillCostPerKm, 8.1); // 810 / 100
    assert.strictEqual(processed[2].distanceUntilNextRefill, 200); // 10200 -> 10400
    assert.strictEqual(processed[2].refillCostPerKm, 4.05); // 810 / 200
    assert.strictEqual(processed[3].distanceUntilNextRefill, null); // in progress
  });

  // J. Weighted monthly Cost/KM is correct
  it('J. Monthly stats calculates weighted avgRefillCostPerKm and preserves quick pointers', () => {
    const refills: PetrolRefill[] = [
      {
        id: 'r1',
        date: '2026-09-10',
        odometerReading: 10000,
        litres: 1.92,
        pricePerLitre: 260,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      {
        id: 'r2',
        date: '2026-09-14',
        odometerReading: 10080,
        litres: 2.69,
        pricePerLitre: 260,
        totalCost: 700,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      },
      {
        id: 'r3',
        date: '2026-09-18',
        odometerReading: 10190,
        litres: 1.92,
        pricePerLitre: 260,
        totalCost: 500,
        isFullTank: false,
        distanceTravelled: 0,
        mileageKmpl: 0,
        costPerKm: 0
      }
    ];

    const stats = calculateMonthlyPetrolStats(refills, '2026-09');
    // Completed legs in September:
    // r1: 500 cost, 80 km
    // r2: 700 cost, 110 km
    // Total completed cost = 1200, Total completed distance = 190 km
    // Weighted avgRefillCostPerKm = 1200 / 190 = 6.3157... -> 6.32 PKR/KM
    assert.strictEqual(stats.completedRefillsCount, 2);
    assert.strictEqual(stats.totalCompletedRefillDistance, 190);
    assert.strictEqual(stats.totalCompletedRefillCost, 1200);
    assert.strictEqual(stats.avgRefillCostPerKm, 6.32);

    // Latest and previous pointers
    assert.strictEqual(stats.latestRefill?.id, 'r3');
    assert.strictEqual(stats.latestRefill?.displayDistanceUntilNext, 'In Progress');
    assert.strictEqual(stats.previousCompletedRefill?.id, 'r2');
    assert.strictEqual(stats.previousCompletedRefill?.distanceUntilNextRefill, 110);
  });

  // K. Supabase serialization/sync remains intact
  it('K. Supabase serialization mapping handles isFullTank bidirectionally', () => {
    const refill = {
      id: 'ref1',
      isFullTank: true,
      odometerReading: 10000,
      totalCost: 500
    };
    const dbRow = toSnakeCase(refill);
    assert.strictEqual(dbRow.is_full_tank, true);
    assert.strictEqual(dbRow.odometer_reading, 10000);

    const deserialized = toCamelCase(dbRow);
    assert.strictEqual(deserialized.isFullTank, true);
    assert.strictEqual(deserialized.odometerReading, 10000);
  });

  // L. Existing validation continues to reject decreasing odometer
  it('L. Validation rejects impossible decreasing odometer reading and duplicate readings', () => {
    const res1 = validateRefillInput(10050, 5, 270, 10080);
    assert.strictEqual(res1.isValid, false);
    assert.match(res1.error || '', /Decreasing odometer/);

    const res2 = validateRefillInput(10080, 5, 270, 10080);
    assert.strictEqual(res2.isValid, false);
    assert.match(res2.error || '', /identical to previous record/);
  });
});

