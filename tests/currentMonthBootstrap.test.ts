import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

describe('app month bootstrap', () => {
  it('initializes the global selected month from the current local month helper', () => {
    assert.match(appSource, /useState<string>\(\(\) => getCurrentMonthYearStr\(\)\)/);
    assert.doesNotMatch(appSource, /useState<string>\(['"]2026-09['"]\)/);
  });
});
