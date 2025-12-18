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

// Render text as image to support Chinese characters
const renderTextAsImage = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fontSize: number = 12,
  fontWeight: string = 'normal'
): number => {
  if (!text) return 0;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    doc.text(text, x, y);
    return doc.getTextWidth(text);
  }

  // Set up canvas with high DPI for crisp text
  const scale = 3;
  ctx.font = `${fontWeight} ${fontSize * scale}px "Microsoft YaHei", "SimHei", "Noto Sans SC", sans-serif`;
  const metrics = ctx.measureText(text);
  
  canvas.width = Math.ceil(metrics.width) + 10;
  canvas.height = Math.ceil(fontSize * scale * 1.5);
  
  // Redraw after resize
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fontWeight} ${fontSize * scale}px "Microsoft YaHei", "SimHei", "Noto Sans SC", sans-serif`;
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 2, canvas.height / 2);

  try {
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width / scale / 2.83; // Convert px to mm (72dpi)
    const imgHeight = canvas.height / scale / 2.83;
    doc.addImage(imgData, 'PNG', x, y - imgHeight * 0.7, imgWidth, imgHeight);
    return imgWidth;
  } catch (e) {
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

  const {
    title = 'Receipt Report',
    includeLineItems = true,
  } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // ===== PAGE 1: SUMMARY =====
  
  // Title
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

  const approvedCount = receipts.filter(r => r.status === 'approved').length;
  const draftCount = receipts.filter(r => r.status === 'draft').length;

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

  // Summary Table - use simple ASCII for headers, render Chinese in cells as images
  const tableData = receipts.map(receipt => [
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
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 60 },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 40 }
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
    renderTextAsImage(doc, merchant, 14, yPos, 14, 'bold');
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
    doc.text(`Category: ${category}`, 14, yPos); yPos += 6;
    doc.text(`Payment Method: ${paymentMethod}`, 14, yPos); yPos += 12;

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
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 30, halign: 'right' },
          3: { cellWidth: 30, halign: 'right' }
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
      const splitNotes = doc.splitTextToSize(receipt.notes, pageWidth - 28);
      doc.text(splitNotes, 14, yPos);
    }

    // Page footer
    doc.setFontSize(8);
    doc.text(
      `Page ${index + 2} of ${receipts.length + 1}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save
  const filename = `receipt_report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};
