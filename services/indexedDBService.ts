import { ReceiptData } from '../types';

const DB_NAME = 'receiptai_db';
const DB_VERSION = 1;
const STORE_NAME = 'receipts';

let dbInstance: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
};

export const getAllReceipts = async (): Promise<ReceiptData[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by createdAt descending (newest first)
      const receipts = request.result.sort((a, b) => b.createdAt - a.createdAt);
      resolve(receipts);
    };
    request.onerror = () => reject(request.error);
  });
};

export const addReceiptIDB = async (receipt: ReceiptData): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(receipt);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const updateReceiptIDB = async (id: string, updates: Partial<ReceiptData>): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (existing) {
        const updated = { ...existing, ...updates };
        store.put(updated);
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

export const deleteReceiptIDB = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearAllReceiptsIDB = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Migration helper: move data from localStorage to IndexedDB
export const migrateFromLocalStorage = async (): Promise<number> => {
  const STORAGE_KEY = 'receiptai_db_v1';
  const data = localStorage.getItem(STORAGE_KEY);
  
  if (!data) return 0;
  
  try {
    const receipts: ReceiptData[] = JSON.parse(data);
    for (const receipt of receipts) {
      await addReceiptIDB(receipt);
    }
    // Clear localStorage after successful migration
    localStorage.removeItem(STORAGE_KEY);
    console.log(`Migrated ${receipts.length} receipts to IndexedDB`);
    return receipts.length;
  } catch (e) {
    console.error('Migration failed:', e);
    return 0;
  }
};

// Check storage estimate
export const getStorageEstimate = async (): Promise<{ used: number; quota: number } | null> => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0
    };
  }
  return null;
};
