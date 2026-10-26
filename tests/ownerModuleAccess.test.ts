import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261026233500_owner_approval_and_modules.sql');

describe('owner-controlled Tahir Tracker', () => {
  it('creates owner-approved profiles for existing users, pending profiles for new registrations', () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.platform_profiles/);
    assert.match(migration, /AFTER INSERT ON auth\.users/);
    assert.match(migration, /'member','pending'/);
    assert.match(migration, /'approved'/);
    assert.match(migration, /role\s*=\s*'owner'/);
  });
  it('does not allow authenticated clients to edit their own approval state', () => {
    assert.match(migration, /REVOKE INSERT,UPDATE,DELETE ON public\.platform_profiles FROM authenticated/);
    assert.match(migration, /public\.is_tahir_owner/);
    assert.match(migration, /tahir_manage_member/);
    assert.match(migration, /Owner permission required/);
  });
  it('gates all household and finance tables behind approved membership and permissions', () => {
    const tables = [
      'utility_persons','utility_bills','utility_payments','milk_consumers','milk_logs',
      'milk_monthly_records','petrol_refills','rent_properties','rent_portions','rent_records',
      'loans','settings','finance_accounts','finance_categories','finance_transactions',
      'finance_budgets','finance_recurring_transactions','finance_goals','finance_voice_entries'
    ];
    for (const table of tables) assert.match(migration, new RegExp('Approved module access" ON public\\.' + table));
    assert.match(migration, /tahir_has_module_access/);
  });
  it('uses real approval and tracker preference gating on the app screen', () => {
    assert.match(read('src/App.tsx'), /PlatformAccessGate/);
    assert.match(read('src/components/auth/PlatformAccessGate.tsx'), /profile\.status !== 'approved'/);
    assert.match(read('src/components/settings/OwnerUserManagement.tsx'), /managePlatformMember/);
    assert.match(read('src/components/settings/TrackerPicker.tsx'), /onSave\(selection\)/);
  });
});
