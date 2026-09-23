import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterPortionsByProperty,
  getRentPropertyName,
  resolvePortionPropertyId
} from '../src/utils/rentProperties.ts';
import type { RentPortion, RentProperty } from '../src/types/index.ts';

const properties: RentProperty[] = [
  {
    id: 'house_1',
    name: 'House 1',
    status: 'active',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'house_2',
    name: 'House 2',
    status: 'active',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  }
];

function portion(id: string, propertyId?: string): RentPortion {
  return {
    id,
    propertyId,
    portionName: id,
    tenantName: 'Tenant',
    expectedRent: 10000,
    dueDay: 10,
    active: true,
    createdAt: '2026-09-01T00:00:00Z'
  };
}

describe('Multi-House Rent property mapping', () => {
  it('keeps explicit property assignment', () => {
    assert.strictEqual(resolvePortionPropertyId(portion('p1', 'house_2'), properties), 'house_2');
  });

  it('safely maps legacy portion without propertyId to first active property', () => {
    assert.strictEqual(resolvePortionPropertyId(portion('legacy'), properties), 'house_1');
  });

  it('filters portions by selected house while All Houses preserves portfolio', () => {
    const portions = [
      portion('p1', 'house_1'),
      portion('p2', 'house_2'),
      portion('legacy')
    ];

    assert.deepStrictEqual(
      filterPortionsByProperty(portions, properties, 'house_1').map(p => p.id),
      ['p1', 'legacy']
    );
    assert.deepStrictEqual(
      filterPortionsByProperty(portions, properties, 'house_2').map(p => p.id),
      ['p2']
    );
    assert.strictEqual(filterPortionsByProperty(portions, properties, 'all').length, 3);
  });

  it('returns stable property display names', () => {
    assert.strictEqual(getRentPropertyName('house_2', properties), 'House 2');
    assert.strictEqual(getRentPropertyName('missing', properties), 'Unknown House');
    assert.strictEqual(getRentPropertyName(undefined, properties), 'Unassigned');
  });
});
