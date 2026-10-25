import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveAuthEntryMode } from '../src/utils/authEntryMode.ts';

describe('direct signup invitation links', () => {
  it('opens signup at the shareable /signup URL', () => {
    assert.equal(resolveAuthEntryMode('/signup', ''), 'signup');
    assert.equal(resolveAuthEntryMode('/signup/', ''), 'signup');
  });

  it('keeps compatibility with signup query links', () => {
    assert.equal(resolveAuthEntryMode('/', '?signup=1'), 'signup');
    assert.equal(resolveAuthEntryMode('/somewhere', '?signup=1'), 'signup');
  });

  it('keeps ordinary visitors on the normal sign in screen', () => {
    assert.equal(resolveAuthEntryMode('/', ''), 'welcome');
    assert.equal(resolveAuthEntryMode('/dashboard', ''), 'welcome');
    assert.equal(resolveAuthEntryMode('/', '?signup=0'), 'welcome');
  });

  it('wires the resolved mode into the actual auth screen', () => {
    const screen = readFileSync(new URL('../src/components/auth/AuthWelcomeScreen.tsx', import.meta.url), 'utf8');
    const redirects = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
    assert.match(screen, /resolveAuthEntryMode\(window\.location\.pathname, window\.location\.search\)/);
    assert.match(screen, /mode === 'signup'/);
    assert.match(screen, /Create Account/);
    assert.match(redirects, /\/\* \/index\.html 200/);
  });
});
