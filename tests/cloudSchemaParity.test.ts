import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const models = read('src/types/index.ts');
const schema = read('supabase_schema.sql');
const migration = read('supabase/migrations/20261026010000_cloud_schema_parity.sql');
const db = read('src/db/db.ts');

describe('cloud schema parity for first-time tenant sync', () => {
  const fields = [
    { table: 'settings', client: 'legacyCleanupDone', column: 'legacy_cleanup_done' },
    { table: 'settings', client: 'onboardingCompleted', column: 'onboarding_completed' },
    { table: 'settings', client: 'enabledModules', column: 'enabled_modules' },
    { table: 'petrol_refills', client: 'updatedAt', column: 'updated_at' }
  ];

  for (const { table, client, column } of fields) {
    it(`${table} persists ${client} as ${column}`, () => {
      assert.match(models, new RegExp(`\\b${client}\\?`));
      const tableDefinition = schema.split(`CREATE TABLE IF NOT EXISTS ${table} (`)[1]?.split(');')[0];
      assert.ok(tableDefinition, `Missing base SQL definition for ${table}`);
      assert.match(tableDefinition!, new RegExp(`\\b${column}\\b`));
      assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`));
    });
  }

  it('shows a retry/error state rather than silently accepting incomplete initial seeding', () => {
    assert.match(db, /Failed to initialize user workspace:[^;]*;\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*throw err;/);
  });
});
