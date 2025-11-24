import * as XLSX from 'xlsx';
import { ReceiptData } from '../types';

export const exportToExcel = (data: ReceiptData[]) => {
  if (!data || data.length === 0) return;

  // 1. Main Sheet
  // Exclude internal fields and nested objects (like items) from the main view
  const rows = data.map(receipt => {
    const row: any = {};
    Object.keys(receipt).forEach(key => {
        const val = receipt[key];
        // Skip internal fields and complex objects for the flat view
        if (key !== 'rawImage' && key !== 'items' && typeof val !== 'object') {
            row[key] = val;
        }
        // If there are items, add a count
        if (key === 'items' && Array.isArray(val)) {
            row['ItemsCount'] = val.length;
        }
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Receipts");

  // 2. Line Items Sheet (if 'items' exists in the data structure)
  const itemRows: any[] = [];
  data.forEach(receipt => {
    if (Array.isArray(receipt.items)) {
        receipt.items.forEach((item: any) => {
            const itemRow: any = {
                ReceiptID: receipt.id,
                // Try to grab common parent fields for context if they exist
                ParentMerchant: receipt.merchantName || receipt.merchant || '',
                ParentDate: receipt.transactionDate || receipt.date || '',
            };
            
            // Spread item properties
            Object.keys(item).forEach(k => {
                if (typeof item[k] !== 'object') {
                    itemRow[k] = item[k];
                }
            });
            
            itemRows.push(itemRow);
        });
    }
  });

  if (itemRows.length > 0) {
    const itemsSheet = XLSX.utils.json_to_sheet(itemRows);
    XLSX.utils.book_append_sheet(workbook, itemsSheet, "Line Items");
  }

  XLSX.writeFile(workbook, `receipt_export_${new Date().toISOString().split('T')[0]}.xlsx`);
};
