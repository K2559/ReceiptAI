declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';

  interface UserOptions {
    startY?: number;
    head?: any[][];
    body?: any[][];
    foot?: any[][];
    theme?: 'striped' | 'grid' | 'plain';
    styles?: any;
    headStyles?: any;
    bodyStyles?: any;
    footStyles?: any;
    columnStyles?: any;
    margin?: any;
    didDrawPage?: (data: any) => void;
    didDrawCell?: (data: any) => void;
  }

  export default function autoTable(doc: jsPDF, options: UserOptions): void;
}
