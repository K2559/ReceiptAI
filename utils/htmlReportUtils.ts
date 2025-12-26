/**
 * HTML Report Generator - Generates HTML that users can save as PDF via browser print
 * This approach provides native Chinese character support
 */

import { ReceiptData } from '../types';
import { cropImageByBoundingBox, isValidBoundingBox } from './imageCropUtils';

interface ReportOptions {
  title?: string;
  includeLineItems?: boolean;
}

// Helper to format dates
const formatDate = (dateValue: any): string => {
  if (!dateValue) return '-';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(dateValue);
  }
};

const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

// Escape HTML special characters
const escapeHtml = (text: string): string => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const generateHTMLReport = async (
  receipts: ReceiptData[],
  options: ReportOptions = {}
): Promise<void> => {
  if (!receipts || receipts.length === 0) {
    alert('No receipts selected for report generation');
    return;
  }

  const { title = 'Receipt Report', includeLineItems = true } = options;

  // Calculate summary statistics by currency
  const amountsByCurrency: Record<string, number> = {};
  receipts.forEach((r) => {
    const currency = r.currency || 'HKD';
    const amount = parseFloat(String(r.totalAmount || r.total || 0));
    if (!isNaN(amount)) {
      amountsByCurrency[currency] = (amountsByCurrency[currency] || 0) + amount;
    }
  });

  const approvedCount = receipts.filter((r) => r.status === 'approved').length;
  const draftCount = receipts.filter((r) => r.status === 'draft').length;

  // Generate summary table rows
  const summaryRows = receipts.map((receipt) => {
    const currency = receipt.currency || 'HKD';
    return `
      <tr>
        <td>${escapeHtml(formatDate(receipt.transactionDate || receipt.date))}</td>
        <td>${escapeHtml(receipt.merchantName || receipt.merchant || '-')}</td>
        <td class="amount">${escapeHtml(currency)} ${parseFloat(String(receipt.totalAmount || receipt.total || 0)).toFixed(2)}</td>
        <td class="status status-${receipt.status || 'draft'}">${escapeHtml((receipt.status || 'draft').toUpperCase())}</td>
        <td>${escapeHtml(receipt.category || '-')}</td>
      </tr>
    `;
  }).join('');

  // Process images with cropping - generate individual receipt pages
  const receiptPagesPromises = receipts.map(async (receipt, index) => {
    const merchant = receipt.merchantName || receipt.merchant || 'Unknown';
    const date = formatDate(receipt.transactionDate || receipt.date);
    const amount = parseFloat(String(receipt.totalAmount || receipt.total || 0)).toFixed(2);
    const currency = receipt.currency || 'HKD';
    const status = (receipt.status || 'draft').toUpperCase();
    const category = receipt.category || '-';
    const paymentMethod = receipt.paymentMethod || '-';
    const imageData = receipt.rawImage || receipt.image || receipt.imageUrl || receipt.imageData;

    // Line items table
    let lineItemsHtml = '';
    if (includeLineItems && Array.isArray(receipt.items) && receipt.items.length > 0) {
      const itemRows = receipt.items.map((item: any) => {
        const qty = item.quantity || 1;
        const price = parseFloat(String(item.price || item.amount || 0));
        const total = qty * price;
        return `
          <tr>
            <td>${escapeHtml(item.description || item.name || '-')}</td>
            <td class="center">${qty}</td>
            <td class="amount">${currency} ${price.toFixed(2)}</td>
            <td class="amount">${currency} ${total.toFixed(2)}</td>
          </tr>
        `;
      }).join('');

      lineItemsHtml = `
        <div class="section">
          <h3>Line Items</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="center">Qty</th>
                <th class="amount">Unit Price</th>
                <th class="amount">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
        </div>
      `;
    }

    // Receipt image - apply cropping if boundingBox is available
    let imageHtml = '';
    if (imageData && imageData.startsWith('data:image/')) {
      let displayImage = imageData;
      
      // Apply cropping if boundingBox is available and valid
      if (receipt.boundingBox && isValidBoundingBox(receipt.boundingBox)) {
        try {
          displayImage = await cropImageByBoundingBox(imageData, receipt.boundingBox);
        } catch (error) {
          console.warn('Failed to crop image, using original:', error);
          // Fall back to original image
        }
      }
      
      imageHtml = `
        <div class="section">
          <h3>Original Receipt Image</h3>
          <div class="image-container">
            <img src="${displayImage}" alt="Receipt Image" />
          </div>
        </div>
      `;
    } else {
      imageHtml = `
        <div class="section">
          <p class="no-image">(No receipt image available)</p>
        </div>
      `;
    }

    // Notes
    let notesHtml = '';
    if (receipt.notes) {
      notesHtml = `
        <div class="section">
          <h3>Notes</h3>
          <p class="notes">${escapeHtml(receipt.notes)}</p>
        </div>
      `;
    }

    return `
      <div class="page">
        <div class="page-content">
          <div class="receipt-header">
            <h2>Receipt ${index + 1} of ${receipts.length}</h2>
          </div>
          
          <div class="merchant-name">${escapeHtml(merchant)}</div>
          
          <div class="receipt-details">
            <div class="detail-row">
              <span class="label">Date:</span>
              <span class="value">${escapeHtml(date)}</span>
            </div>
            <div class="detail-row highlight">
              <span class="label">Total Amount:</span>
              <span class="value amount-large">${escapeHtml(currency)} ${amount}</span>
            </div>
            <div class="detail-row">
              <span class="label">Status:</span>
              <span class="value status status-${receipt.status || 'draft'}">${status}</span>
            </div>
            <div class="detail-row">
              <span class="label">Category:</span>
              <span class="value">${escapeHtml(category)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Payment Method:</span>
              <span class="value">${escapeHtml(paymentMethod)}</span>
            </div>
          </div>

          ${lineItemsHtml}
          ${imageHtml}
          ${notesHtml}
        </div>
        <div class="page-footer">Page ${index + 2} of ${receipts.length + 1}</div>
      </div>
    `;
  });

  // Wait for all receipt pages to be processed
  const receiptPages = (await Promise.all(receiptPagesPromises)).join('');

  // Generate total amounts display
  const totalAmountsHtml = Object.entries(amountsByCurrency).map(([currency, total]) => `
    <div class="total-box">
      <span class="total-label">Total (${escapeHtml(currency)}):</span>
      <span class="total-value">${escapeHtml(currency)} ${total.toFixed(2)}</span>
    </div>
  `).join('');

  // Complete HTML document
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    /* A4 Page Setup */
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "SimHei", "PingFang SC", "Noto Sans SC", sans-serif;
      font-size: 10px;
      line-height: 1.3;
      color: #333;
      background: #e0e0e0;
    }
    
    /* A4 dimensions: 210mm x 297mm */
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 10mm;
      margin: 10px auto;
      background: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      position: relative;
      page-break-after: always;
      page-break-inside: avoid;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    /* Content area: 190mm x 277mm (with 10mm margins) */
    .page-content {
      width: 190mm;
      min-height: 260mm;
      position: relative;
    }
    
    .print-instructions {
      width: 210mm;
      margin: 10px auto;
      background: #e3f2fd;
      border: 1px solid #2196f3;
      border-radius: 8px;
      padding: 15px 20px;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .print-instructions .icon {
      font-size: 24px;
    }
    
    .print-instructions .text {
      flex: 1;
    }
    
    .print-instructions .text strong {
      display: block;
      margin-bottom: 5px;
      color: #1565c0;
    }
    
    .print-btn {
      background: #2196f3;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    
    .print-btn:hover {
      background: #1976d2;
    }
    
    .report-header {
      text-align: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #2980b9;
    }
    
    .report-header h1 {
      font-size: 20px;
      color: #2c3e50;
      margin-bottom: 5px;
    }
    
    .report-header .meta {
      color: #7f8c8d;
      font-size: 9px;
    }
    
    .summary-section h2 {
      font-size: 13px;
      color: #2c3e50;
      margin-bottom: 10px;
      padding-bottom: 3px;
      border-bottom: 1px solid #ecf0f1;
    }
    
    .totals-container {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    
    .total-box {
      background: #2980b9;
      color: white;
      padding: 8px 14px;
      border-radius: 5px;
      display: flex;
      flex-direction: column;
    }
    
    .total-label {
      font-size: 9px;
      opacity: 0.9;
    }
    
    .total-value {
      font-size: 14px;
      font-weight: bold;
    }
    
    .stats {
      color: #555;
      margin-bottom: 10px;
      font-size: 10px;
    }
    
    .stats span {
      margin-right: 12px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 9px;
    }
    
    th, td {
      padding: 4px 6px;
      text-align: left;
      border: 1px solid #ddd;
    }
    
    th {
      background: #2980b9;
      color: white;
      font-weight: 600;
      font-size: 8px;
      text-transform: uppercase;
    }
    
    tbody tr:nth-child(even) {
      background: #f8f9fa;
    }
    
    .amount {
      text-align: right;
      font-family: "Consolas", "Monaco", monospace;
    }
    
    .center {
      text-align: center;
    }
    
    .status {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 8px;
      font-size: 8px;
      font-weight: 600;
    }
    
    .status-draft {
      background: #ecf0f1;
      color: #7f8c8d;
    }
    
    .status-approved {
      background: #d5f4e6;
      color: #27ae60;
    }
    
    .status-rejected {
      background: #fde8e8;
      color: #e74c3c;
    }
    
    .status-error {
      background: #fde8e8;
      color: #c0392b;
    }
    
    .receipt-header h2 {
      font-size: 14px;
      color: #2c3e50;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid #3498db;
    }
    
    .merchant-name {
      font-size: 13px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 10px;
    }
    
    .receipt-details {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 5px;
      margin-bottom: 12px;
    }
    
    .detail-row {
      display: flex;
      padding: 3px 0;
      border-bottom: 1px solid #ecf0f1;
      font-size: 10px;
    }
    
    .detail-row:last-child {
      border-bottom: none;
    }
    
    .detail-row.highlight {
      background: #e8f4f8;
      margin: 3px -10px;
      padding: 6px 10px;
    }
    
    .detail-row .label {
      width: 100px;
      color: #7f8c8d;
      font-weight: 500;
    }
    
    .detail-row .value {
      flex: 1;
      color: #2c3e50;
    }
    
    .amount-large {
      font-size: 13px;
      font-weight: bold;
      color: #2980b9;
    }
    
    .section {
      margin-bottom: 12px;
    }
    
    .section h3 {
      font-size: 11px;
      color: #34495e;
      margin-bottom: 6px;
      padding-bottom: 3px;
      border-bottom: 1px solid #ecf0f1;
    }
    
    .items-table th {
      background: #34495e;
    }
    
    .image-container {
      text-align: center;
      padding: 6px;
      background: #f8f9fa;
      border-radius: 5px;
      max-height: 150mm;
      overflow: hidden;
    }
    
    .image-container img {
      max-width: 100%;
      max-height: 145mm;
      object-fit: contain;
      border-radius: 3px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    }
    
    .no-image {
      color: #95a5a6;
      font-style: italic;
      text-align: center;
      padding: 10px;
      font-size: 9px;
    }
    
    .notes {
      background: #fffde7;
      padding: 8px;
      border-radius: 3px;
      border-left: 3px solid #ffc107;
      color: #5d4e37;
      font-size: 9px;
      max-height: 30mm;
      overflow: hidden;
    }
    
    .page-footer {
      position: absolute;
      bottom: 5mm;
      left: 10mm;
      right: 10mm;
      text-align: center;
      font-size: 8px;
      color: #95a5a6;
      border-top: 1px solid #ecf0f1;
      padding-top: 5px;
    }
    
    @media print {
      body {
        background: white;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .print-instructions {
        display: none !important;
      }
      
      .page {
        width: 190mm;
        min-height: 277mm;
        padding: 0;
        margin: 0;
        box-shadow: none;
        page-break-after: always;
        page-break-inside: avoid;
      }
      
      .page:last-child {
        page-break-after: auto;
      }
      
      .page-content {
        width: 190mm;
        min-height: 260mm;
      }
      
      .page-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        text-align: center;
      }
      
      .image-container {
        max-height: 145mm;
        overflow: hidden;
      }
      
      .image-container img {
        max-width: 100%;
        max-height: 140mm;
        object-fit: contain;
      }
      
      /* Ensure tables don't break across pages */
      table {
        page-break-inside: avoid;
      }
      
      .section {
        page-break-inside: avoid;
      }
      
      .receipt-details {
        page-break-inside: avoid;
      }
      
      /* Preserve colors in print */
      .total-box {
        background: #2980b9 !important;
        color: white !important;
      }
      
      th {
        background: #2980b9 !important;
        color: white !important;
      }
      
      .items-table th {
        background: #34495e !important;
      }
      
      .status-draft {
        background: #ecf0f1 !important;
        color: #7f8c8d !important;
      }
      
      .status-approved {
        background: #d5f4e6 !important;
        color: #27ae60 !important;
      }
      
      .detail-row.highlight {
        background: #e8f4f8 !important;
      }
      
      .receipt-details {
        background: #f8f9fa !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-instructions">
    <span class="icon">📄</span>
    <div class="text">
      <strong>Save as PDF (A4 Format)</strong>
      Press Ctrl+P (or Cmd+P on Mac) to print. Select "Save as PDF" and ensure paper size is set to A4.
    </div>
    <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  </div>
  
  <!-- Summary Page -->
  <div class="page">
    <div class="page-content">
      <div class="report-header">
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">
          Generated: ${formatDateTime(Date.now())} | Total Receipts: ${receipts.length}
        </div>
      </div>
      
      <div class="summary-section">
        <h2>Accounting Summary</h2>
        
        <div class="totals-container">
          ${totalAmountsHtml}
        </div>
        
        <div class="stats">
          <span>✓ Approved: ${approvedCount}</span>
          <span>○ Draft: ${draftCount}</span>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th class="amount">Amount</th>
              <th class="center">Status</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows}
          </tbody>
        </table>
      </div>
    </div>
    <div class="page-footer">Page 1 of ${receipts.length + 1}</div>
  </div>
  
  ${receiptPages}
</body>
</html>
  `;

  // Open in new window
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
  } else {
    alert('Please allow popups to view the report');
  }
};
