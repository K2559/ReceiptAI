/**
 * PDF Report Generator with Chinese Character Support
 * 
 * Uses pdfmake with dynamically loaded Chinese font (Noto Sans SC)
 */

import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { ReceiptData } from '../types';

// Set up default fonts - handle different module formats
const vfs = (pdfFonts as any)?.pdfMake?.vfs || (pdfFonts as any)?.vfs || (pdfFonts as any)?.default?.pdfMake?.vfs;
if (vfs) {
  (pdfMake as any).vfs = vfs;
}

// Chinese font loading state
let chineseFontLoaded = false;
let chineseFontLoading = false;

// Load Chinese font from CDN
const loadChineseFont = async (): Promise<boolean> => {
  if (chineseFontLoaded) return true;
  if (chineseFontLoading) {
    // Wait for existing load
    while (chineseFontLoading) {
      await new Promise(r => setTimeout(r, 100));
    }
    return chineseFontLoaded;
  }
  
  chineseFontLoading = true;
  
  try {
    // Use Source Han Sans (思源黑体) - a reliable Chinese font
    // This is hosted on unpkg which is very reliable
    const fontUrl = 'https://unpkg.com/source-han-sans-sc@1.0.0/SourceHanSansSC-Regular.ttf';
    
    console.log('Loading Chinese font from:', fontUrl);
    const response = await fetch(fontUrl);
    if (!response.ok) {
      console.error('Font fetch failed:', response.status, response.statusText);
      throw new Error(`Failed to fetch font: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('Font downloaded, size:', arrayBuffer.byteLength);
    
    // Convert to base64
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    // Add to pdfMake vfs
    (pdfMake as any).vfs = (pdfMake as any).vfs || {};
    (pdfMake as any).vfs['SourceHanSans.ttf'] = base64;
    
    // Register the font
    (pdfMake as any).fonts = {
      ...(pdfMake as any).fonts,
      SourceHanSans: {
        normal: 'SourceHanSans.ttf',
        bold: 'SourceHanSans.ttf',
        italics: 'SourceHanSans.ttf',
        bolditalics: 'SourceHanSans.ttf'
      }
    };
    
    chineseFontLoaded = true;
    console.log('Chinese font loaded and registered successfully');
    return true;
  } catch (error) {
    console.error('Failed to load Chinese font:', error);
    return false;
  } finally {
    chineseFontLoading = false;
  }
};

interface PDFOptions {
  title?: string;
  includeLineItems?: boolean;
  groupByMerchant?: boolean;
}

// Helper function to validate and format image data for pdfMake
const getValidImageData = (imageData: string | undefined | null): string | null => {
  if (!imageData || typeof imageData !== 'string') {
    return null;
  }

  // Check if it's already a valid data URL
  if (imageData.startsWith('data:image/')) {
    // Validate it has the base64 part
    const parts = imageData.split(',');
    if (parts.length === 2 && parts[1].length > 0) {
      return imageData;
    }
    return null;
  }

  // Check if it's a local file path or URL (not supported in browser)
  if (imageData.startsWith('http://') || 
      imageData.startsWith('https://') || 
      imageData.startsWith('file://') ||
      imageData.startsWith('/') ||
      imageData.match(/^[a-zA-Z]:\\/)) {
    console.warn('Image is a URL/path, not a base64 data URL. Skipping:', imageData.substring(0, 50));
    return null;
  }

  // Try to detect if it's raw base64 data
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  const cleanData = imageData.trim();
  
  // Check if it looks like base64 (at least 100 chars and valid base64 characters)
  if (cleanData.length > 100 && base64Regex.test(cleanData.substring(0, 100).replace(/\s/g, ''))) {
    // Try to detect image type from base64 header
    const header = cleanData.substring(0, 20);
    let mimeType = 'image/jpeg'; // default
    
    if (header.startsWith('/9j/')) {
      mimeType = 'image/jpeg';
    } else if (header.startsWith('iVBORw')) {
      mimeType = 'image/png';
    } else if (header.startsWith('R0lGOD')) {
      mimeType = 'image/gif';
    } else if (header.startsWith('UklGR')) {
      mimeType = 'image/webp';
    }
    
    return `data:${mimeType};base64,${cleanData}`;
  }

  console.warn('Invalid image data format. Skipping.');
  return null;
};

export const generatePDFReport = async (
  receipts: ReceiptData[],
  options: PDFOptions = {}
) => {
  console.log('generatePDFReport called with', receipts.length, 'receipts');
  
  if (!receipts || receipts.length === 0) {
    alert('No receipts selected for PDF generation');
    return;
  }

  // Try to load Chinese font
  const hasChineseFont = await loadChineseFont();
  const fontName = hasChineseFont ? 'SourceHanSans' : 'Roboto';
  console.log('Using font:', fontName, 'Chinese font loaded:', hasChineseFont);

  try {

  const {
    title = 'Receipt Report',
    includeLineItems = true,
  } = options;

  // Calculate summary statistics
  const totalAmount = receipts.reduce((sum, r) => {
    const amount = parseFloat(String(r.totalAmount || r.total || 0));
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const approvedCount = receipts.filter(r => r.status === 'approved').length;
  const draftCount = receipts.filter(r => r.status === 'draft').length;

  // Build summary table data
  const summaryTableBody = [
    [
      { text: 'Date', style: 'tableHeader' },
      { text: 'Merchant', style: 'tableHeader' },
      { text: 'Amount', style: 'tableHeader' },
      { text: 'Status', style: 'tableHeader' },
      { text: 'Category', style: 'tableHeader' }
    ],
    ...receipts.map(receipt => [
      formatDate(receipt.transactionDate || receipt.date),
      receipt.merchantName || receipt.merchant || '-',
      `$${parseFloat(String(receipt.totalAmount || receipt.total || 0)).toFixed(2)}`,
      (receipt.status || 'draft').toUpperCase(),
      receipt.category || '-'
    ])
  ];

  // Build document content
  const content: any[] = [
    // Page 1: Summary
    { text: title, style: 'header', alignment: 'center' },
    { text: `Generated: ${new Date().toLocaleString()}`, style: 'subheader', alignment: 'center' },
    { text: `Total Receipts: ${receipts.length}`, style: 'subheader', alignment: 'center', margin: [0, 0, 0, 20] },
    
    { text: 'Accounting Summary', style: 'sectionHeader' },
    { text: `Total Amount: $${totalAmount.toFixed(2)}`, margin: [0, 5, 0, 5] },
    { text: `Approved Receipts: ${approvedCount}`, margin: [0, 0, 0, 5] },
    { text: `Draft Receipts: ${draftCount}`, margin: [0, 0, 0, 15] },
    
    {
      table: {
        headerRows: 1,
        widths: ['auto', '*', 'auto', 'auto', 'auto'],
        body: summaryTableBody
      },
      layout: 'lightHorizontalLines'
    }
  ];

  // Add individual receipt pages
  receipts.forEach((receipt, index) => {
    content.push({ text: '', pageBreak: 'before' });
    
    const merchant = receipt.merchantName || receipt.merchant || 'Unknown';
    const date = formatDate(receipt.transactionDate || receipt.date);
    const amount = parseFloat(String(receipt.totalAmount || receipt.total || 0)).toFixed(2);
    const status = (receipt.status || 'draft').toUpperCase();
    const category = receipt.category || '-';
    const paymentMethod = receipt.paymentMethod || '-';

    content.push(
      { text: `Receipt ${index + 1} of ${receipts.length}`, style: 'receiptHeader' },
      { text: merchant, style: 'merchantName' },
      { text: `Date: ${date}`, margin: [0, 5, 0, 3] },
      { text: `Total Amount: $${amount}`, margin: [0, 0, 0, 3] },
      { text: `Status: ${status}`, margin: [0, 0, 0, 3] },
      { text: `Category: ${category}`, margin: [0, 0, 0, 3] },
      { text: `Payment Method: ${paymentMethod}`, margin: [0, 0, 0, 10] }
    );

    // Line Items
    if (includeLineItems && Array.isArray(receipt.items) && receipt.items.length > 0) {
      const itemsTableBody = [
        [
          { text: 'Description', style: 'tableHeader' },
          { text: 'Qty', style: 'tableHeader' },
          { text: 'Unit Price', style: 'tableHeader' },
          { text: 'Total', style: 'tableHeader' }
        ],
        ...receipt.items.map((item: any) => [
          item.description || item.name || '-',
          String(item.quantity || 1),
          `$${parseFloat(String(item.price || item.amount || 0)).toFixed(2)}`,
          `$${(parseFloat(String(item.quantity || 1)) * parseFloat(String(item.price || item.amount || 0))).toFixed(2)}`
        ])
      ];

      content.push(
        { text: 'Line Items', style: 'sectionHeader', margin: [0, 10, 0, 5] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: itemsTableBody
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 10]
        }
      );
    }

    // Receipt Image - validate and add only if valid base64 data URL
    // Use smaller size to fit on same page as receipt details
    const rawImageData = receipt.rawImage || receipt.image || receipt.imageUrl || receipt.imageData;
    const validImageData = getValidImageData(rawImageData);
    
    if (validImageData) {
      content.push(
        { text: 'Original Receipt Image', style: 'sectionHeader', margin: [0, 10, 0, 5] },
        {
          image: validImageData,
          width: 200, // Smaller thumbnail size to fit on same page
          alignment: 'left',
          margin: [0, 0, 0, 10]
        }
      );
    } else if (rawImageData) {
      // Had image data but it was invalid
      content.push(
        { text: '(Image format not supported for PDF export)', style: 'error', margin: [0, 10, 0, 10] }
      );
    } else {
      content.push(
        { text: '(No receipt image available)', style: 'noImage', margin: [0, 10, 0, 10] }
      );
    }

    // Notes
    if (receipt.notes) {
      content.push(
        { text: 'Notes', style: 'sectionHeader', margin: [0, 10, 0, 5] },
        { text: receipt.notes, margin: [0, 0, 0, 10] }
      );
    }
  });

  // Document definition
  const docDefinition: any = {
    content,
    styles: {
      header: {
        fontSize: 20,
        bold: true,
        margin: [0, 0, 0, 10]
      },
      subheader: {
        fontSize: 10,
        margin: [0, 0, 0, 5]
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
        margin: [0, 10, 0, 5]
      },
      receiptHeader: {
        fontSize: 16,
        bold: true,
        margin: [0, 0, 0, 10]
      },
      merchantName: {
        fontSize: 12,
        bold: true,
        margin: [0, 0, 0, 8]
      },
      tableHeader: {
        bold: true,
        fontSize: 10,
        color: 'white',
        fillColor: '#2980b9'
      },
      error: {
        fontSize: 9,
        color: 'red'
      },
      noImage: {
        fontSize: 9,
        color: 'gray'
      }
    },
    defaultStyle: {
      fontSize: 10,
      font: fontName
    },
    pageMargins: [40, 40, 40, 40],
    footer: (currentPage: number, pageCount: number) => {
      return {
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: 'center',
        fontSize: 8,
        margin: [0, 10, 0, 0]
      };
    }
  };

  // Generate and download PDF
  console.log('Creating PDF with pdfMake...');
  const filename = `receipt_report_${new Date().toISOString().split('T')[0]}.pdf`;
  pdfMake.createPdf(docDefinition).download(filename);
  console.log('PDF generation completed');
  
  } catch (error) {
    console.error('Error generating PDF:', error);
    const errorMessage = error instanceof Error 
      ? `${error.message}${error.stack ? '\n' + error.stack : ''}`
      : String(error) || 'Unknown error';
    alert(`Failed to generate PDF: ${errorMessage}`);
  }
};

// Helper function to format dates
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
