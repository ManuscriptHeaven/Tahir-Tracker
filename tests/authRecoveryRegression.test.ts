import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { formatAuthError, getAuthRedirectUrl } from '../src/utils/authUtils.ts';

// Execute the actual service with a fake Supabase boundary; no network or emails.
function loadAuthService(hash: string, recoveryDuringRestore = false) {
  let listener: ((event: string, session: any) => void) | undefined;
  const session = { user: { id: 'recovery-user', email: 'test@example.com' } };
  const calls: string[] = [];
  const client = { auth: {
    onAuthStateChange(callback: typeof listener) {
      calls.push('subscribe');
      listener = callback;
    },
    async getSession() {
      calls.push('restore');
      if (recoveryDuringRestore) listener?.('PASSWORD_RECOVERY', session);
      return { data: { session: recoveryDuringRestore ? session : null }, error: null };
    }
  } };
  const exports: Record<string, any> = {};
  const source = readFileSync(new URL('../src/services/authService.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (name === '../lib/supabase') return { getSupabaseClient: () => client };
      if (name === '../utils/authUtils') return { formatAuthError, getAuthRedirectUrl };
      throw new Error(`Unexpected runtime import: ${name}`);
    },
    window: { location: { hash, search: '', pathname: '/' }, history: { replaceState() {} } },
    URLSearchParams,
    console: { log() {}, warn() {}, error() {} }
  });
  return { service: exports, calls };
}

it('captures password recovery emitted while restoring the initial session', async () => {
  const { service, calls } = loadAuthService('', true);
  await service.initAuth();
  assert.deepEqual(calls, ['subscribe', 'restore']);
  assert.equal(service.getIsRecoveryMode(), true);
  assert.equal(service.isAuthenticated(), true);
});

it('preserves expired-link errors after successful empty-session restoration', async () => {
  const { service } = loadAuthService('#error=access_denied&error_code=otp_expired');
  await service.initAuth();
  let state: any;
  service.subscribeAuth((value: any) => { state = value; });
  assert.equal(state.error, 'Your reset link has expired. Request a new one.');
  assert.equal(state.recoveryError, state.error);
});

it('does not decode callback error descriptions twice', async () => {
  const { service } = loadAuthService('#error=server_error&error_description=Failed%20at%20100%25');
  await service.initAuth();
  let state: any;
  service.subscribeAuth((value: any) => { state = value; });
  assert.equal(state.error, 'Failed at 100%');
});

