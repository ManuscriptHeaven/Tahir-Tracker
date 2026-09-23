import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNC_TABLE_KEYS,
  getRetryDelayMs,
  isBootstrapSync,
  isRetryTimestampReady
} from '../src/services/syncPolicy.ts';

describe('syncPolicy.test.ts - production sync safety policy', () => {
  it('keeps every cloud-backed table in the full sync set', () => {
    assert.strictEqual(SYNC_TABLE_KEYS.length, 19);
    assert.strictEqual(new Set(SYNC_TABLE_KEYS).size, SYNC_TABLE_KEYS.length);
    assert.ok(SYNC_TABLE_KEYS.includes('milk_monthly_records'));
    assert.ok(SYNC_TABLE_KEYS.includes('rent_properties'));
  });

  it('treats a device with no prior successful sync as bootstrap', () => {
    assert.strictEqual(isBootstrapSync(null), true);
    assert.strictEqual(isBootstrapSync(undefined), true);
    assert.strictEqual(isBootstrapSync(''), true);
    assert.strictEqual(isBootstrapSync('2026-09-23T12:00:00.000Z'), false);
  });

  it('backs off retries and caps the delay at one hour', () => {
    assert.strictEqual(getRetryDelayMs(1), 5_000);
    assert.strictEqual(getRetryDelayMs(2), 15_000);
    assert.strictEqual(getRetryDelayMs(3), 60_000);
    assert.strictEqual(getRetryDelayMs(4), 5 * 60_000);
    assert.strictEqual(getRetryDelayMs(5), 30 * 60_000);
    assert.strictEqual(getRetryDelayMs(6), 60 * 60_000);
    assert.strictEqual(getRetryDelayMs(99), 60 * 60_000);
  });

  it('only retries queue items once their retry timestamp is due', () => {
    const now = Date.parse('2026-09-23T12:00:00.000Z');
    assert.strictEqual(isRetryTimestampReady(undefined, now), true);
    assert.strictEqual(isRetryTimestampReady('2026-09-23T11:59:59.000Z', now), true);
    assert.strictEqual(isRetryTimestampReady('2026-09-23T12:00:01.000Z', now), false);
  });
});
