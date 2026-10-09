export interface QueuedMutation {
  id: string;
  method:
    | 'addProductionLogs'
    | 'saveSalesOrder'
    | 'addDeliveryOrders'
    | 'addInvoices'
    | 'addLedgerEntry'
    | 'addExpense'
    | 'addExpenses'
    | 'addSalaries'
    | 'addTradingPurchase'
    | 'addStockDisposal'
    | 'addMasterData';
  args: any[];
  label: string;
  createdAt: string;
  username: string;
}

const DB_NAME = 'rpa_master_offline_db';
const DB_VERSION = 1;
const CACHE_STORE = 'table_groups';
const QUEUE_KEY = 'rpa_offline_mutation_queue_v1';
const LAST_SYNC_KEY = 'rpa_last_cache_timestamp';

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCachedGroupData(groupKey: string, data: any): Promise<void> {
  try {
    const db = await openOfflineDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      store.put({ data, updatedAt: new Date().toISOString() }, groupKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch (e) {
    // Fallback to localStorage for small groups (like master)
    try {
      localStorage.setItem(`rpa_cache_${groupKey}`, JSON.stringify(data));
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    } catch {
      // Ignore quota errors on fallback
    }
  }
}

export async function getCachedGroupData(groupKey: string): Promise<any | null> {
  try {
    const db = await openOfflineDB();
    const res = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const store = tx.objectStore(CACHE_STORE);
      const req = store.get(groupKey);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (res && res.data !== undefined) {
      return res.data;
    }
  } catch {
    // Fallback to localStorage
  }
  try {
    const raw = localStorage.getItem(`rpa_cache_${groupKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getLastCacheTimestamp(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export function getOfflineQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: QueuedMutation[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rpa-offline-queue-updated', { detail: { count: queue.length } }));
    }
  } catch (e) {
    console.warn('Failed to save offline queue:', e);
  }
}

export function enqueueOfflineMutation(
  method: QueuedMutation['method'],
  args: any[],
  label: string,
  username: string
): QueuedMutation {
  const item: QueuedMutation = {
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    method,
    args,
    label,
    createdAt: new Date().toISOString(),
    username
  };
  const queue = getOfflineQueue();
  queue.push(item);
  saveOfflineQueue(queue);
  return item;
}

export function removeOfflineMutation(id: string): void {
  const queue = getOfflineQueue().filter(item => item.id !== id);
  saveOfflineQueue(queue);
}

export function isNetworkError(err: any): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (!err) return false;
  const msg = String(err.message || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('offline') ||
    msg.includes('fetch error') ||
    msg.includes('timeout')
  );
}
