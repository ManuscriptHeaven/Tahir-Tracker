import type { RentPortion, RentProperty } from '../types/index.ts';

/**
 * Resolve the property for a portion.
 * New records always carry propertyId. Legacy local backups may not, so they
 * temporarily fall back to the first active property until cloud sync/backfill
 * supplies the authoritative property_id.
 */
export function resolvePortionPropertyId(
  portion: Pick<RentPortion, 'propertyId'>,
  properties: RentProperty[]
): string | undefined {
  if (portion.propertyId) return portion.propertyId;
  return properties.find(p => p.status === 'active')?.id || properties[0]?.id;
}

export function filterPortionsByProperty<T extends Pick<RentPortion, 'propertyId'>>(
  portions: T[],
  properties: RentProperty[],
  propertyId: string
): T[] {
  if (!propertyId || propertyId === 'all') return portions;
  return portions.filter(p => resolvePortionPropertyId(p, properties) === propertyId);
}

export function getRentPropertyName(
  propertyId: string | undefined,
  properties: RentProperty[]
): string {
  if (!propertyId) return 'Unassigned';
  return properties.find(p => p.id === propertyId)?.name || 'Unknown House';
}
