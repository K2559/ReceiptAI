import { ReceiptData } from "../types";
import {
  getAllReceipts,
  addReceiptIDB,
  updateReceiptIDB,
  deleteReceiptIDB,
  clearAllReceiptsIDB,
  migrateFromLocalStorage,
  getStorageEstimate
} from "./indexedDBService";

// Cache for receipts to avoid async calls everywhere
let receiptsCache: ReceiptData[] | null = null;
let cacheInitialized = false;

// Initialize and migrate from localStorage if needed
export const initStorage = async (): Promise<void> => {
  if (cacheInitialized) return;
  
  // Migrate any existing localStorage data
  const migrated = await migrateFromLocalStorage();
  if (migrated > 0) {
    console.log(`Migrated ${migrated} receipts from localStorage to IndexedDB`);
  }
  
  // Load initial cache
  receiptsCache = await getAllReceipts();
  cacheInitialized = true;
};

// Sync version for backward compatibility (uses cache)
export const getReceipts = (): ReceiptData[] => {
  return receiptsCache || [];
};

// Async version that ensures fresh data
export const getReceiptsAsync = async (): Promise<ReceiptData[]> => {
  await initStorage();
  receiptsCache = await getAllReceipts();
  return receiptsCache;
};

export const addReceipt = async (receipt: ReceiptData): Promise<ReceiptData[]> => {
  await initStorage();
  await addReceiptIDB(receipt);
  receiptsCache = await getAllReceipts();
  return receiptsCache;
};

export const updateReceipt = async (id: string, updates: Partial<ReceiptData>): Promise<ReceiptData[]> => {
  await initStorage();
  await updateReceiptIDB(id, updates);
  receiptsCache = await getAllReceipts();
  return receiptsCache;
};

export const deleteReceipt = async (id: string): Promise<ReceiptData[]> => {
  await initStorage();
  await deleteReceiptIDB(id);
  receiptsCache = await getAllReceipts();
  return receiptsCache;
};

export const clearDatabase = async (): Promise<ReceiptData[]> => {
  await clearAllReceiptsIDB();
  receiptsCache = [];
  return [];
};

export const exportDatabaseJSON = async (): Promise<void> => {
  const receipts = await getReceiptsAsync();
  const dataStr = JSON.stringify(receipts, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `receiptai_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const importDatabaseJSON = async (file: File): Promise<ReceiptData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const receipts = JSON.parse(content) as ReceiptData[];
        
        if (!Array.isArray(receipts)) {
          throw new Error('Invalid data format: expected an array of receipts');
        }
        
        receipts.forEach((receipt, index) => {
          if (!receipt.id || !receipt.createdAt || !receipt.status) {
            throw new Error(`Invalid receipt at index ${index}: missing required fields`);
          }
        });
        
        await initStorage();
        const existing = await getAllReceipts();
        const existingIds = new Set(existing.map(r => r.id));
        const newReceipts = receipts.filter(r => !existingIds.has(r.id));
        
        // Add new receipts to IndexedDB
        for (const receipt of newReceipts) {
          await addReceiptIDB(receipt);
        }
        
        receiptsCache = await getAllReceipts();
        resolve(receiptsCache);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// Export storage estimate for UI
export { getStorageEstimate };
