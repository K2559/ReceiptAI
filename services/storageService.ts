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
  const current = getReceipts();
  const updated = [receipt, ...current];
  saveReceipts(updated);
  return updated;
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
