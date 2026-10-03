import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { SYNC_TABLE_KEYS } from '../src/services/syncPolicy.ts';

it('sync resolves tables from the active user database and attaches hooks for each user', () => {
  let activeUser = 'first-user';
  const users = new Map<string, Record<string, { hookCalls: string[]; hook: (name: string) => void }>>();
  const getTables = (userId: string) => {
    if (!users.has(userId)) {
      users.set(userId, Object.fromEntries(SYNC_TABLE_KEYS.map(name => [name, {
        hookCalls: [] as string[],
        hook(this: { hookCalls: string[] }, event: string) { this.hookCalls.push(event); }
      }])));
    }
    return users.get(userId)!;
  };
  const db = new Proxy({}, {
    get(_target, property) { return getTables(activeUser)[String(property)]; }
  });

  const source = readFileSync(new URL('../src/services/syncService.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (name === '../db/db') return { db, LEGACY_DUMMY_IDS: {} };
      if (name === '../lib/supabase') return { isSupabaseConfigured: () => true };
      if (name === './authService') return {
        getCurrentUserId: () => activeUser,
        isAuthenticated: () => true
      };
      if (name === './syncPolicy') return { SYNC_TABLE_KEYS, isBootstrapSync: () => true };
      if (name === './syncQueue') return {};
      throw new Error(`Unexpected runtime import: ${name}`);
    },
    window: { localStorage: { getItem: () => null } },
    localStorage: { getItem: () => null },
    console
  });

  const firstLoans = exports.TABLE_MAP.loans;
  assert.equal(firstLoans, getTables('first-user').loans);
  exports.initDexieMutationHooks();
  exports.initDexieMutationHooks();
  assert.equal(firstLoans.hookCalls.length, 3);

  activeUser = 'second-user';
  const secondLoans = exports.TABLE_MAP.loans;
  assert.equal(secondLoans, getTables('second-user').loans);
  assert.notEqual(secondLoans, firstLoans);
  exports.initDexieMutationHooks();
  assert.equal(secondLoans.hookCalls.length, 3);
  assert.equal(firstLoans.hookCalls.length, 3);
  assert.equal(Object.entries(exports.TABLE_MAP).length, SYNC_TABLE_KEYS.length);
});

