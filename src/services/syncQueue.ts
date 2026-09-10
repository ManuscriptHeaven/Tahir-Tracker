/**
 * Offline Sync Queue Manager for Tahir Tracker
 * 
 * Persists pending mutations and deletions in Dexie (`sync_queue`).
 * Ensures offline actions survive app reloads and process reliably with retries.
 */

import { db } from '../db/db';
import { SyncQueueItem } from '../types';

/**
 * Enqueue a mutation (upsert or delete)
 */
export async function enqueueSyncOperation(
  tableName: string,
  action: 'upsert' | 'delete',
  recordId: string,
  payload?: any
): Promise<void> {
  try {
    const queueId = `${tableName}_${recordId}`;
    const item: SyncQueueItem = {
      id: queueId,
      tableName,
      action,
      recordId,
      payload: action === 'delete' ? undefined : payload,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    await db.sync_queue.put(item);
  } catch (err) {
    console.error('Failed to enqueue sync operation:', err);
  }
}

/**
 * Retrieves all pending mutations from the queue sorted by timestamp
 */
export async function getPendingSyncOperations(): Promise<SyncQueueItem[]> {
  try {
    return await db.sync_queue.orderBy('timestamp').toArray();
  } catch (err) {
    console.error('Failed to get pending sync operations:', err);
    return [];
  }
}

/**
 * Remove a successfully processed item from the queue
 */
export async function dequeueSyncOperation(id: string): Promise<void> {
  try {
    await db.sync_queue.delete(id);
  } catch (err) {
    console.error(`Failed to dequeue sync operation ${id}:`, err);
  }
}

/**
 * Increment retry count on failure
 */
export async function incrementRetryCount(id: string): Promise<void> {
  try {
    const item = await db.sync_queue.get(id);
    if (item) {
      await db.sync_queue.update(id, {
        retryCount: (item.retryCount || 0) + 1
      });
    }
  } catch (err) {
    console.error(`Failed to increment retry count for ${id}:`, err);
  }
}

/**
 * Clears entire queue (used during complete reset)
 */
export async function clearSyncQueue(): Promise<void> {
  try {
    await db.sync_queue.clear();
  } catch (err) {
    console.error('Failed to clear sync queue:', err);
  }
}
