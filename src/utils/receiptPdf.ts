import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export function getReceiptFilename(receiptId: string, donorName?: string): string {
  const id = receiptId.slice(-8).toUpperCase();
  const safeName = (donorName || 'Donor').replace(/[^\w\-]+/g, '_').slice(0, 40);
  return `80G-Receipt-${safeName}-${id}.pdf`;
}

export async function receiptElementToPdfBlob(element: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf.output('blob');
}

export async function downloadReceiptPdf(element: HTMLElement, filename: string): Promise<void> {
  const blob = await receiptElementToPdfBlob(element);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function openReceiptPdfInNewTab(element: HTMLElement): Promise<Window | null> {
  const blob = await receiptElementToPdfBlob(element);
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank', 'noopener,noreferrer');
  if (!tab) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked. Please allow pop-ups for this site.');
  }
  tab.addEventListener('beforeunload', () => URL.revokeObjectURL(url));
  return tab;
}
