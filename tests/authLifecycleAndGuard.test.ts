import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mock Sync State Model
type SyncState = 'idle' | 'syncing' | 'synced' | 'realtime_active' | 'error' | 'offline' | 'unconfigured' | 'auth_required';

interface MockAuthSession {
  userId: string;
  email: string;
  expiresAt: number; // unix timestamp seconds
}

interface MockRecord {
  id: string;
  user_id: string;
  amount: number;
  description: string;
}

class MockSyncEngine {
  private currentSession: MockAuthSession | null = null;
  private isOnline = true;
  private isConfigured = true;
  public status: SyncState = 'unconfigured';
  public remoteDatabase: MockRecord[] = [];
  public localDexie: MockRecord[] = [];
  public realtimeActive = false;

  constructor(configured: boolean = true) {
    this.isConfigured = configured;
    this.evaluateStatus();
  }

  public setOnline(online: boolean) {
    this.isOnline = online;
    if (!online) {
      this.status = 'offline';
      this.realtimeActive = false;
    } else {
      this.evaluateStatus();
    }
  }

  public setSession(session: MockAuthSession | null) {
    this.currentSession = session;
    this.evaluateStatus();
    if (this.status === 'idle' && this.isOnline && this.isConfigured) {
      this.realtimeActive = true;
    } else {
      this.realtimeActive = false;
    }
  }

  private evaluateStatus() {
    if (!this.isConfigured) {
      this.status = 'unconfigured';
    } else if (!this.currentSession || Date.now() / 1000 > this.currentSession.expiresAt) {
      this.status = 'auth_required';
      this.realtimeActive = false;
    } else if (!this.isOnline) {
      this.status = 'offline';
    } else {
      this.status = 'idle';
    }
  }

  public async syncWithCloud(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) {
      this.status = 'unconfigured';
      return { success: false, error: 'Supabase credentials not configured' };
    }

    if (!this.currentSession || Date.now() / 1000 > this.currentSession.expiresAt) {
      this.status = 'auth_required';
      this.realtimeActive = false;
      return { success: false, error: 'Sign in required for cloud synchronization' };
    }

    if (!this.isOnline) {
      this.status = 'offline';
      return { success: false, error: 'Device is offline' };
    }

    this.status = 'syncing';

    // 1. Push local records scoped to current user_id
    const currentUserId = this.currentSession.userId;
    for (const localRec of this.localDexie) {
      const existingIdx = this.remoteDatabase.findIndex(r => r.id === localRec.id);
      const scopedRecord: MockRecord = {
        ...localRec,
        user_id: currentUserId // Stamped with authenticated user
      };

      if (existingIdx >= 0) {
        // Enforce ownership check before mutation
        if (this.remoteDatabase[existingIdx].user_id !== currentUserId) {
          throw new Error('RLS Violation: cannot overwrite another user record');
        }
        this.remoteDatabase[existingIdx] = scopedRecord;
      } else {
        this.remoteDatabase.push(scopedRecord);
      }
    }

    // 2. Pull remote records scoped to current user_id
    const userRemotes = this.remoteDatabase.filter(r => r.user_id === currentUserId);
    for (const rem of userRemotes) {
      const locIdx = this.localDexie.findIndex(l => l.id === rem.id);
      if (locIdx >= 0) {
        this.localDexie[locIdx] = rem;
      } else {
        this.localDexie.push(rem);
      }
    }

    this.status = 'synced';
    return { success: true };
  }

  public updateRecordOwnershipAttempt(recordId: string, forgedUserId: string): { success: boolean; error?: string } {
    if (!this.currentSession) return { success: false, error: 'Unauthenticated' };
    const currentUserId = this.currentSession.userId;

    const row = this.remoteDatabase.find(r => r.id === recordId);
    if (!row) return { success: false, error: 'Not found' };
    if (row.user_id !== currentUserId) return { success: false, error: 'RLS: forbidden' };

    // PostgreSQL RLS WITH CHECK (auth.uid() = user_id) on UPDATE
    if (forgedUserId !== currentUserId) {
      return { success: false, error: 'RLS Violation: WITH CHECK (auth.uid() = user_id) failed: cannot transfer ownership' };
    }

    row.user_id = forgedUserId;
    return { success: true };
  }
}

describe('authLifecycleAndGuard.test.ts - Supabase Auth Guard & Ownership Lifecycle', () => {
  const tahirSession: MockAuthSession = {
    userId: 'usr_tahir_999',
    email: 'tahir@tracker.internal',
    expiresAt: Math.floor(Date.now() / 1000) + 3600 // 1 hour valid
  };

  const attackerSession: MockAuthSession = {
    userId: 'usr_attacker_666',
    email: 'attacker@evil.com',
    expiresAt: Math.floor(Date.now() / 1000) + 3600
  };

  it('No session: cloud sync is disabled and enters auth_required without making cloud calls', async () => {
    const engine = new MockSyncEngine(true);
    assert.strictEqual(engine.status, 'auth_required');

    const res = await engine.syncWithCloud();
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Sign in required for cloud synchronization');
    assert.strictEqual(engine.status, 'auth_required');
    assert.strictEqual(engine.realtimeActive, false);
  });

  it('Valid session: sync allowed and user_id is strictly attached to cloud mutations', async () => {
    const engine = new MockSyncEngine(true);
    engine.setSession(tahirSession);
    assert.strictEqual(engine.status, 'idle');
    assert.strictEqual(engine.realtimeActive, true);

    // Add record to local Dexie
    engine.localDexie.push({
      id: 'tx_milk_1',
      user_id: '', // unassigned locally
      amount: 520,
      description: '2kg milk purchase'
    });

    const res = await engine.syncWithCloud();
    assert.strictEqual(res.success, true);
    assert.strictEqual(engine.status, 'synced');

    // Cloud record must have Tahir's authenticated user_id stamped
    assert.strictEqual(engine.remoteDatabase.length, 1);
    assert.strictEqual(engine.remoteDatabase[0].id, 'tx_milk_1');
    assert.strictEqual(engine.remoteDatabase[0].user_id, tahirSession.userId);
  });

  it('Session expires: local Dexie data remains intact, cloud sync pauses gracefully', async () => {
    const engine = new MockSyncEngine(true);
    const expiredSession: MockAuthSession = {
      ...tahirSession,
      expiresAt: Math.floor(Date.now() / 1000) - 100 // expired
    };

    engine.localDexie.push({
      id: 'local_salary',
      user_id: tahirSession.userId,
      amount: 250000,
      description: 'Monthly Salary'
    });

    engine.setSession(expiredSession);
    assert.strictEqual(engine.status, 'auth_required');
    assert.strictEqual(engine.realtimeActive, false);

    // Local data must NEVER be cleared or hidden
    assert.strictEqual(engine.localDexie.length, 1);
    assert.strictEqual(engine.localDexie[0].amount, 250000);

    // Attempting sync fails safely
    const res = await engine.syncWithCloud();
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Sign in required for cloud synchronization');
  });

  it('Session restored: sync resumes and pushes pending offline changes', async () => {
    const engine = new MockSyncEngine(true);
    engine.localDexie.push({
      id: 'local_offline_petrol',
      user_id: '',
      amount: 3500,
      description: 'Petrol Refill 12L'
    });

    // Currently unauthenticated
    let res = await engine.syncWithCloud();
    assert.strictEqual(res.success, false);

    // User signs in
    engine.setSession(tahirSession);
    assert.strictEqual(engine.status, 'idle');

    res = await engine.syncWithCloud();
    assert.strictEqual(res.success, true);
    assert.strictEqual(engine.remoteDatabase.length, 1);
    assert.strictEqual(engine.remoteDatabase[0].id, 'local_offline_petrol');
    assert.strictEqual(engine.remoteDatabase[0].user_id, tahirSession.userId);
  });

  it('Tenant Isolation: User A cannot read or modify User B data', async () => {
    const engine = new MockSyncEngine(true);

    // Seed User B record in cloud
    engine.remoteDatabase.push({
      id: 'attacker_loan',
      user_id: attackerSession.userId,
      amount: 50000,
      description: 'Attacker Loan'
    });

    // Tahir logs in and syncs
    engine.setSession(tahirSession);
    await engine.syncWithCloud();

    // Tahir's local database must NOT contain Attacker's record
    const foundAttackerRecord = engine.localDexie.find(r => r.id === 'attacker_loan');
    assert.strictEqual(foundAttackerRecord, undefined);

    // Tahir tries to overwrite attacker_loan
    engine.localDexie.push({
      id: 'attacker_loan',
      user_id: tahirSession.userId,
      amount: 0,
      description: 'Wipe attacker loan'
    });

    await assert.rejects(
      async () => {
        await engine.syncWithCloud();
      },
      /RLS Violation: cannot overwrite another user record/
    );
  });

  it('Ownership Hijacking Prevention: UPDATE cannot change user_id', () => {
    const engine = new MockSyncEngine(true);
    engine.setSession(tahirSession);

    engine.remoteDatabase.push({
      id: 'tahir_rent_record',
      user_id: tahirSession.userId,
      amount: 65000,
      description: 'Ground floor rent'
    });

    // User attempts to transfer ownership of tahir_rent_record to attacker
    const result = engine.updateRecordOwnershipAttempt('tahir_rent_record', attackerSession.userId);
    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('WITH CHECK (auth.uid() = user_id) failed'));
    assert.strictEqual(engine.remoteDatabase[0].user_id, tahirSession.userId);
  });

  it('Sign Out: pauses sync and disconnects realtime without data loss', () => {
    const engine = new MockSyncEngine(true);
    engine.setSession(tahirSession);
    assert.strictEqual(engine.realtimeActive, true);

    engine.localDexie.push({
      id: 'offline_expense',
      user_id: tahirSession.userId,
      amount: 1500,
      description: 'Groceries'
    });

    // User clicks Sign Out
    engine.setSession(null);
    assert.strictEqual(engine.status, 'auth_required');
    assert.strictEqual(engine.realtimeActive, false);

    // Local data persists
    assert.strictEqual(engine.localDexie.length, 1);
    assert.strictEqual(engine.localDexie[0].id, 'offline_expense');
  });
});
