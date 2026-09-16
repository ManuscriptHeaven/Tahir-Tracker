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
});
