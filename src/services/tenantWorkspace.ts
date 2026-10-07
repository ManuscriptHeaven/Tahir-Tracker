/**
 * Derive a stable 52-bit numeric key from a Supabase UUID.
 *
 * The settings table historically used a global integer primary key and every
 * local Dexie database started at id=1. A deterministic per-user key prevents
 * settings collisions while preserving the numeric key expected by existing
 * clients and backups. 52 bits remain exactly representable by JavaScript and
 * fit safely in PostgreSQL BIGINT.
 */
export function getWorkspaceSettingsId(userId: string): number {
  const hex = userId.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (hex.length < 13) {
    throw new Error('A valid Supabase user UUID is required to initialize a workspace.');
  }

  const value = Number.parseInt(hex.slice(0, 13), 16);
  if (!Number.isSafeInteger(value) || value <= 1) {
    throw new Error('Could not derive a safe workspace settings key.');
  }

  return value;
}
