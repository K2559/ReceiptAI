/**
 * Simple PDF Report Generator with Chinese Character Support
 * Uses jsPDF with canvas-based text rendering for Chinese characters
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReceiptData } from '../types';

interface PDFOptions {
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

// Check if text contains Chinese characters
const containsChinese = (text: string): boolean => {
  return /[\u4e00-\u9fa5\u3400-\u4dbf\u{20000}-\u{2a6df}]/u.test(text);
};

// Render text to canvas and return as image data
const textToImageData = (
  text: string,
  fontSize: number,
  fontWeight: string = 'normal',
  maxWidth?: number
): { data: string; width: number; height: number } | null => {
  if (!text) return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const scale = 3; // High DPI for crisp text
  const font = `${fontWeight} ${fontSize * scale}px "Microsoft YaHei", "SimHei", "PingFang SC", "Noto Sans SC", "Source Han Sans CN", sans-serif`;
  
  ctx.font = font;
  let displayText = text;
  
  // Truncate if too wide
  if (maxWidth) {
    const maxPx = maxWidth * 2.83 * scale; // mm to px
    while (ctx.measureText(displayText).width > maxPx && displayText.length > 3) {
      displayText = displayText.slice(0, -4) + '...';
    }
  }
  
  const metrics = ctx.measureText(displayText);
  canvas.width = Math.ceil(metrics.width) + 10;
  canvas.height = Math.ceil(fontSize * scale * 1.4);

  // Redraw after resize (canvas clears on resize)
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = font;
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayText, 2, canvas.height / 2);

  return {
    data: canvas.toDataURL('image/png'),
    width: canvas.width / scale / 2.83, // px to mm
    height: canvas.height / scale / 2.83
  };
};

// Render text as image in PDF (for standalone text)
const renderTextAsImage = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fontSize: number = 12,
  fontWeight: string = 'normal'
): number => {
  if (!text) return 0;

  const img = textToImageData(text, fontSize, fontWeight);
  if (!img) {
    doc.text(text, x, y);
    return doc.getTextWidth(text);
  }

  try {
    doc.addImage(img.data, 'PNG', x, y - img.height * 0.7, img.width, img.height);
    return img.width;
  } catch {
    doc.text(text, x, y);
    return doc.getTextWidth(text);
  }
};

export const generatePDFReport = async (
  receipts: ReceiptData[],
  options: PDFOptions = {}
) => {
  if (!receipts || receipts.length === 0) {
    alert('No receipts selected for PDF generation');
    return;
  }

  const { title = 'Receipt Report', includeLineItems = true } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // ===== PAGE 1: SUMMARY =====
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, yPos, { align: 'center' });

  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
  doc.text(`Total Receipts: ${receipts.length}`, pageWidth / 2, yPos + 5, { align: 'center' });

  yPos += 15;

  // Summary Statistics
  const totalAmount = receipts.reduce((sum, r) => {
    const amount = parseFloat(String(r.totalAmount || r.total || 0));
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  const approvedCount = receipts.filter((r) => r.status === 'approved').length;
  const draftCount = receipts.filter((r) => r.status === 'draft').length;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Accounting Summary', 14, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Amount: ${totalAmount.toFixed(2)}`, 14, yPos);
  yPos += 7;
  doc.text(`Approved Receipts: ${approvedCount}`, 14, yPos);
  yPos += 7;
  doc.text(`Draft Receipts: ${draftCount}`, 14, yPos);
  yPos += 12;

  // Summary Table
  const tableData = receipts.map((receipt) => [
    formatDate(receipt.transactionDate || receipt.date),
    receipt.merchantName || receipt.merchant || '-',
    `${parseFloat(String(receipt.totalAmount || receipt.total || 0)).toFixed(2)}`,
    (receipt.status || 'draft').toUpperCase(),
    receipt.category || '-'
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Merchant', 'Amount', 'Status', 'Category']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      minCellHeight: 8
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 60 },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 40 }
    },
    didDrawCell: (data) => {
      // Replace Chinese text with image rendering
      if (data.section === 'body' && data.cell.text) {
        const text = data.cell.text.join(' ');
        if (containsChinese(text)) {
          const cellWidth = data.cell.width - 4;
          const img = textToImageData(text, 9, 'normal', cellWidth);
          if (img) {
            // Clear the cell text area
            doc.setFillColor(data.row.index % 2 === 0 ? 255 : 245, data.row.index % 2 === 0 ? 255 : 245, data.row.index % 2 === 0 ? 255 : 250);
            doc.rect(data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2, 'F');
            // Draw image
            const imgY = data.cell.y + (data.cell.height - img.height) / 2;
            doc.addImage(img.data, 'PNG', data.cell.x + 2, imgY, img.width, img.height);
          }
        }
      }
    }
  });

  // ===== INDIVIDUAL RECEIPT PAGES =====
  for (let index = 0; index < receipts.length; index++) {
    const receipt = receipts[index];
    doc.addPage();
    yPos = 20;

    // Receipt Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Receipt ${index + 1} of ${receipts.length}`, 14, yPos);
    yPos += 12;

    // Merchant Name (may contain Chinese)
    const merchant = receipt.merchantName || receipt.merchant || 'Unknown';
    if (containsChinese(merchant)) {
      renderTextAsImage(doc, merchant, 14, yPos, 14, 'bold');
    } else {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(merchant, 14, yPos);
    }
    yPos += 10;

    // Receipt Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const date = formatDate(receipt.transactionDate || receipt.date);
    const amount = parseFloat(String(receipt.totalAmount || receipt.total || 0)).toFixed(2);
    const status = (receipt.status || 'draft').toUpperCase();
    const category = receipt.category || '-';
    const paymentMethod = receipt.paymentMethod || '-';

    doc.text(`Date: ${date}`, 14, yPos); yPos += 6;
    doc.text(`Total Amount: ${amount}`, 14, yPos); yPos += 6;
    doc.text(`Status: ${status}`, 14, yPos); yPos += 6;
    
    // Category might contain Chinese
    if (containsChinese(category)) {
      doc.text('Category: ', 14, yPos);
      renderTextAsImage(doc, category, 14 + doc.getTextWidth('Category: '), yPos, 10);
    } else {
      doc.text(`Category: ${category}`, 14, yPos);
    }
    yPos += 6;
    
    doc.text(`Payment Method: ${paymentMethod}`, 14, yPos);
    yPos += 12;

    // Line Items
    if (includeLineItems && Array.isArray(receipt.items) && receipt.items.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Line Items', 14, yPos);
      yPos += 8;

      const itemsData = receipt.items.map((item: any) => [
        item.description || item.name || '-',
        String(item.quantity || 1),
        `${parseFloat(String(item.price || item.amount || 0)).toFixed(2)}`,
        `${(parseFloat(String(item.quantity || 1)) * parseFloat(String(item.price || item.amount || 0))).toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Description', 'Qty', 'Unit Price', 'Total']],
        body: itemsData,
        theme: 'grid',
        headStyles: {
          fillColor: [52, 73, 94],
          fontSize: 9
        },
        styles: {
          fontSize: 9,
          cellPadding: 4,
          minCellHeight: 8
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 30, halign: 'right' },
          3: { cellWidth: 30, halign: 'right' }
        },
        didDrawCell: (data) => {
          // Replace Chinese text in Description column with image
          if (data.section === 'body' && data.column.index === 0 && data.cell.text) {
            const text = data.cell.text.join(' ');
            if (containsChinese(text)) {
              const cellWidth = data.cell.width - 4;
              const img = textToImageData(text, 9, 'normal', cellWidth);
              if (img) {
                // Clear cell
                doc.setFillColor(255, 255, 255);
                doc.rect(data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1, 'F');
                // Draw image
                const imgY = data.cell.y + (data.cell.height - img.height) / 2;
                doc.addImage(img.data, 'PNG', data.cell.x + 2, imgY, img.width, img.height);
              }
            }
          }
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Receipt Image
    const imageData = receipt.rawImage || receipt.image || receipt.imageUrl || receipt.imageData;

    if (imageData && imageData.startsWith('data:image/')) {
      try {
        const maxImgWidth = pageWidth - 28;
        const maxImgHeight = pageHeight - yPos - 30;

        if (maxImgHeight > 50) {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('Original Receipt Image', 14, yPos);
          yPos += 8;

          const imgProps = doc.getImageProperties(imageData);
          const ratio = imgProps.width / imgProps.height;

          let finalWidth = Math.min(maxImgWidth, 150);
          let finalHeight = finalWidth / ratio;

          if (finalHeight > maxImgHeight) {
            finalHeight = maxImgHeight;
            finalWidth = finalHeight * ratio;
          }

          doc.addImage(imageData, 'JPEG', 14, yPos, finalWidth, finalHeight);
        }
      } catch (error) {
        console.error('Error adding image:', error);
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('(Image could not be loaded)', 14, yPos);
        doc.setTextColor(0, 0, 0);
      }
    } else {
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('(No receipt image available)', 14, yPos);
      doc.setTextColor(0, 0, 0);
    }

    // Notes
    if (receipt.notes) {
      yPos = Math.min(yPos + 60, pageHeight - 50);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Notes', 14, yPos);
      yPos += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      if (containsChinese(receipt.notes)) {
        renderTextAsImage(doc, receipt.notes.substring(0, 100), 14, yPos, 9);
      } else {
        const splitNotes = doc.splitTextToSize(receipt.notes, pageWidth - 28);
        doc.text(splitNotes, 14, yPos);
      }
    }

    // Page footer
    doc.setFontSize(8);
    doc.text(`Page ${index + 2} of ${receipts.length + 1}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  // Save
  const filename = `receipt_report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};
