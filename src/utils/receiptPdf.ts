import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { RECEIPT_HEIGHT_PX, RECEIPT_WIDTH_PX } from '../components/ReceiptCertificate';

export function getReceiptFilename(receiptId: string, donorName?: string): string {
  const id = receiptId.slice(-8).toUpperCase();
  const safeName = (donorName || 'Donor').replace(/[^\w\-]+/g, '_').slice(0, 40);
  return `80G-Receipt-${safeName}-${id}.pdf`;
}

const waitForImages = (element: HTMLElement): Promise<void> =>
  Promise.all(
    Array.from(element.querySelectorAll('img')).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  ).then(() => undefined);

export async function receiptElementToPdfBlob(element: HTMLElement): Promise<Blob> {
  await waitForImages(element);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: RECEIPT_WIDTH_PX,
    height: RECEIPT_HEIGHT_PX,
    windowWidth: RECEIPT_WIDTH_PX,
    windowHeight: RECEIPT_HEIGHT_PX,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 6;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;

  let imgWidth = maxWidth;
  let imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight > maxHeight) {
    imgHeight = maxHeight;
    imgWidth = (canvas.width * imgHeight) / canvas.height;
  }

  const x = (pageWidth - imgWidth) / 2;
  const y = (pageHeight - imgHeight) / 2;

  pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);

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
