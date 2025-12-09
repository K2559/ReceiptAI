import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReceiptData } from '../types';

interface PDFOptions {
  title?: string;
  includeLineItems?: boolean;
  groupByMerchant?: boolean;
}

export const generatePDFReport = (
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
    groupByMerchant = false
  } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  // ===== PAGE 1: ACCOUNTING SUMMARY =====
  
  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
  doc.text(`Total Receipts: ${receipts.length}`, pageWidth / 2, yPosition + 5, { align: 'center' });
  
  yPosition += 15;

  // Summary Statistics
  const totalAmount = receipts.reduce((sum, r) => {
    const amount = parseFloat(String(r.totalAmount || r.total || 0));
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const approvedCount = receipts.filter(r => r.status === 'approved').length;
  const draftCount = receipts.filter(r => r.status === 'draft').length;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Accounting Summary', 14, yPosition);
  yPosition += 10;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Amount: $${totalAmount.toFixed(2)}`, 14, yPosition);
  yPosition += 7;
  doc.text(`Approved Receipts: ${approvedCount}`, 14, yPosition);
  yPosition += 7;
  doc.text(`Draft Receipts: ${draftCount}`, 14, yPosition);
  
  yPosition += 12;

  // Summary Table
  const tableData = receipts.map(receipt => {
    const date = receipt.transactionDate || receipt.date || '-';
    const merchant = receipt.merchantName || receipt.merchant || '-';
    const amount = receipt.totalAmount || receipt.total || '-';
    const status = receipt.status || 'draft';
    const category = receipt.category || '-';
    
    return [
      formatDate(date),
      merchant,
      `$${parseFloat(String(amount)).toFixed(2)}`,
      status.toUpperCase(),
      category
    ];
  });

  autoTable(doc, {
    startY: yPosition,
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
    },
    didDrawPage: (data) => {
      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      const pageNumber = (doc as any).internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.text(
        `Page ${pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
  });

  // ===== SUBSEQUENT PAGES: ONE RECEIPT PER PAGE =====
  receipts.forEach((receipt, index) => {
    doc.addPage();
    yPosition = 20;

    // Receipt Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Receipt ${index + 1} of ${receipts.length}`, 14, yPosition);
    yPosition += 10;

    // Receipt Details
    const merchant = receipt.merchantName || receipt.merchant || 'Unknown';
    const date = formatDate(receipt.transactionDate || receipt.date);
    const amount = parseFloat(String(receipt.totalAmount || receipt.total || 0)).toFixed(2);
    const status = (receipt.status || 'draft').toUpperCase();
    const category = receipt.category || '-';
    const paymentMethod = receipt.paymentMethod || '-';

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(merchant, 14, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${date}`, 14, yPosition);
    yPosition += 6;
    doc.text(`Total Amount: $${amount}`, 14, yPosition);
    yPosition += 6;
    doc.text(`Status: ${status}`, 14, yPosition);
    yPosition += 6;
    doc.text(`Category: ${category}`, 14, yPosition);
    yPosition += 6;
    doc.text(`Payment Method: ${paymentMethod}`, 14, yPosition);
    yPosition += 10;

    // Line Items (if available)
    if (includeLineItems && Array.isArray(receipt.items) && receipt.items.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Line Items', 14, yPosition);
      yPosition += 7;

      const itemsData = receipt.items.map((item: any) => [
        item.description || item.name || '-',
        item.quantity || 1,
        `$${parseFloat(String(item.price || item.amount || 0)).toFixed(2)}`,
        `$${(parseFloat(String(item.quantity || 1)) * parseFloat(String(item.price || item.amount || 0))).toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: yPosition,
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

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Original Receipt Image (if available)
    if (receipt.rawImage) {
      try {
        const imgData = receipt.rawImage.startsWith('data:') 
          ? receipt.rawImage 
          : `data:image/jpeg;base64,${receipt.rawImage}`;
        
        // Create a temporary image to get dimensions
        const img = new Image();
        img.src = imgData;
        
        // Calculate available space
        const maxImageWidth = pageWidth - 28; // 14px margin on each side
        const maxImageHeight = pageHeight - yPosition - 30; // Leave space for footer
        
        if (maxImageHeight > 50) { // Only add if there's reasonable space
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('Original Receipt Image', 14, yPosition);
          yPosition += 8;
          
          // Get image properties using getImageProperties
          const imgProps = doc.getImageProperties(imgData);
          const imgWidth = imgProps.width;
          const imgHeight = imgProps.height;
          const imgRatio = imgWidth / imgHeight;
          
          // Calculate dimensions maintaining aspect ratio
          let finalWidth = maxImageWidth;
          let finalHeight = finalWidth / imgRatio;
          
          // If height exceeds available space, scale by height instead
          if (finalHeight > maxImageHeight) {
            finalHeight = maxImageHeight;
            finalWidth = finalHeight * imgRatio;
          }
          
          // Center the image horizontally if it's smaller than max width
          const xPosition = 14 + (maxImageWidth - finalWidth) / 2;
          
          doc.addImage(imgData, 'JPEG', xPosition, yPosition, finalWidth, finalHeight);
          yPosition += finalHeight + 5;
        }
      } catch (error) {
        console.error('Error adding receipt image to PDF:', error);
        // Continue without the image if there's an error
      }
    }

    // Additional Notes (if available)
    if (receipt.notes) {
      if (yPosition > pageHeight - 40) {
        // Not enough space, skip or truncate
      } else {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Notes', 14, yPosition);
        yPosition += 6;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const splitNotes = doc.splitTextToSize(receipt.notes, pageWidth - 28);
        doc.text(splitNotes, 14, yPosition);
      }
    }

    // Footer for each page
    doc.setFontSize(8);
    doc.text(
      `Page ${index + 2} of ${receipts.length + 1}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  });

  // Save the PDF
  const filename = `receipt_report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
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
