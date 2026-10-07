import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getWorkspaceSettingsId } from '../src/services/tenantWorkspace.ts';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const TENANT_TABLES = [
  'utility_persons', 'utility_bills', 'utility_payments',
  'milk_consumers', 'milk_logs', 'milk_monthly_records', 'petrol_refills',
  'rent_properties', 'rent_portions', 'rent_records', 'loans', 'settings',
  'finance_accounts', 'finance_categories', 'finance_transactions',
  'finance_budgets', 'finance_recurring_transactions',
  'finance_goals', 'finance_voice_entries'
];

describe('self-service multi-user platform', () => {
  it('provides real email/password registration with confirmation redirect', () => {
    const auth = read('src/services/authService.ts');
    const context = read('src/context/AuthContext.tsx');
    const welcome = read('src/components/auth/AuthWelcomeScreen.tsx');

    assert.match(auth, /client\.auth\.signUp\(/);
    assert.match(auth, /emailRedirectTo:\s*getAuthRedirectUrl\(\)/);
    assert.match(context, /signUp:\s*authSignUp/);
    assert.match(welcome, /mode === 'signup'/);
    assert.match(welcome, /Create Account/);
  });

  it('creates a private workspace automatically after first verified login', () => {
    const app = read('src/App.tsx');
    assert.match(app, /initializeUserWorkspace\(user\.id\)/);
    assert.match(app, /Self-service SaaS path/);
  });

  it('uses stable distinct settings keys for different accounts', () => {
    const a = getWorkspaceSettingsId('11111111-1111-4111-8111-111111111111');
    const b = getWorkspaceSettingsId('22222222-2222-4222-8222-222222222222');
    assert.notEqual(a, b);
    assert.equal(Number.isSafeInteger(a), true);
    assert.equal(a, getWorkspaceSettingsId('11111111-1111-4111-8111-111111111111'));
  });

  it('keeps cloud reads, writes, deletes and realtime scoped to the authenticated user', () => {
    const sync = read('src/services/syncService.ts');
    assert.match(sync, /payload\.user_id = currentUserId/);
    assert.match(sync, /\.eq\('user_id', currentUserId\)/);
    assert.match(sync, /filter: `user_id=eq\.\$\{currentUserId\}`/);
    assert.match(sync, /eventUserId !== currentUserId/);
  });

  it('keeps all 19 cloud tables under the tenant RLS source of truth', () => {
    const schema = read('supabase_schema.sql');
    for (const table of TENANT_TABLES) {
      assert.equal(schema.includes("'" + table + "'"), true, 'missing tenant table ' + table);
    }
    assert.match(schema, /auth\.uid\(\) = user_id/);
    assert.match(schema, /ALTER COLUMN user_id SET NOT NULL/i);
    assert.match(schema, /ALTER COLUMN id TYPE BIGINT/i);
  });
});
