import { ReceiptData } from "../types";

const STORAGE_KEY = 'receiptai_db_v1';

export const getReceipts = (): ReceiptData[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveReceipts = (receipts: ReceiptData[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
};

export const addReceipt = (receipt: ReceiptData) => {
  try {
    const current = getReceipts();
    const updated = [receipt, ...current];
    saveReceipts(updated);
    return updated;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      // Try to free up space by removing base64 images from older receipts
      console.warn('Storage quota exceeded, attempting to optimize...');
      const current = getReceipts();
      
      // Remove rawImage from older receipts to free space
      const optimized = current.map(r => {
        if (r.rawImage && r.rawImage.startsWith('data:')) {
          return { ...r, rawImage: undefined };
        }
        return r;
      });
      
      saveReceipts(optimized);
      
      // Now try to add the new receipt
      const updated = [receipt, ...optimized];
      saveReceipts(updated);
      return updated;
    }
    throw error;
  }
};

export const updateReceipt = (id: string, updates: Partial<ReceiptData>) => {
  const current = getReceipts();
  const updated = current.map(r => r.id === id ? { ...r, ...updates } : r);
  saveReceipts(updated);
  return updated;
};

export const deleteReceipt = (id: string) => {
  const current = getReceipts();
  const updated = current.filter(r => r.id !== id);
  saveReceipts(updated);
  return updated;
};

export const clearDatabase = () => {
  localStorage.removeItem(STORAGE_KEY);
  return [];
};

export const exportDatabaseJSON = () => {
  const receipts = getReceipts();
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

export const importDatabaseJSON = (file: File): Promise<ReceiptData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const receipts = JSON.parse(content) as ReceiptData[];
        
        // Validate the data structure
        if (!Array.isArray(receipts)) {
          throw new Error('Invalid data format: expected an array of receipts');
        }
        
        // Basic validation for each receipt
        receipts.forEach((receipt, index) => {
          if (!receipt.id || !receipt.createdAt || !receipt.status) {
            throw new Error(`Invalid receipt at index ${index}: missing required fields`);
          }
        });
        
        // Merge with existing data (avoid duplicates by ID)
        const existing = getReceipts();
        const existingIds = new Set(existing.map(r => r.id));
        const newReceipts = receipts.filter(r => !existingIds.has(r.id));
        const merged = [...newReceipts, ...existing];
        
        saveReceipts(merged);
        resolve(merged);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
