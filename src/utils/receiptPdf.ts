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

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export interface ReceiptPdfOptions {
  /** Lower scale = smaller file (use 1 for email). Default 2 for downloads. */
  scale?: number;
  /** JPEG quality 0–1 when using compact mode. Default 0.9 */
  jpegQuality?: number;
}

export async function receiptElementToPdfBlob(
  element: HTMLElement,
  options: ReceiptPdfOptions = {}
): Promise<Blob> {
  const scale = options.scale ?? 2;
  const jpegQuality = options.jpegQuality ?? 0.9;
  const useCompact = scale <= 1;

  await waitForImages(element);

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: RECEIPT_WIDTH_PX,
    height: RECEIPT_HEIGHT_PX,
    windowWidth: RECEIPT_WIDTH_PX,
    windowHeight: RECEIPT_HEIGHT_PX,
  });

  const imgData = useCompact
    ? canvas.toDataURL('image/jpeg', jpegQuality)
    : canvas.toDataURL('image/png');
  const imageFormat = useCompact ? 'JPEG' : 'PNG';
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

  pdf.addImage(imgData, imageFormat, x, y, imgWidth, imgHeight);

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

export interface OpenReceiptPdfOptions {
  title?: string;
}

export async function openReceiptPdfInNewTab(
  element: HTMLElement,
  options: OpenReceiptPdfOptions = {}
): Promise<Window | null> {
  const blob = await receiptElementToPdfBlob(element);
  const pdfUrl = URL.createObjectURL(blob);
  const title = options.title ?? '80G Donation Receipt — Lata Agrawal Foundation';
  const logoUrl = `${window.location.origin}/lata-agrawal-foundation-logo.png`;
  const safeTitle = escapeHtml(title);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <link rel="icon" type="image/png" href="${logoUrl}" />
  <link rel="apple-touch-icon" href="${logoUrl}" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f1f5f9; }
    header {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 16px; background: #1a2744; color: #fff;
    }
    header img {
      height: 36px; width: 36px; object-fit: contain;
      border-radius: 6px; background: #f7f4ed; padding: 2px;
    }
    header h1 { margin: 0; font-size: 14px; font-weight: 600; letter-spacing: 0.02em; }
    iframe { display: block; width: 100%; height: calc(100vh - 52px); border: 0; background: #fff; }
  </style>
</head>
<body>
  <header>
    <img src="${logoUrl}" alt="Lata Agrawal Foundation" />
    <h1>${safeTitle}</h1>
  </header>
  <iframe src="${pdfUrl}" title="${safeTitle}"></iframe>
</body>
</html>`;

  const htmlBlob = new Blob([html], { type: 'text/html' });
  const htmlUrl = URL.createObjectURL(htmlBlob);
  const tab = window.open(htmlUrl, '_blank', 'noopener,noreferrer');

  if (!tab) {
    URL.revokeObjectURL(pdfUrl);
    URL.revokeObjectURL(htmlUrl);
    throw new Error('Popup blocked. Please allow pop-ups for this site.');
  }

  const cleanup = () => {
    URL.revokeObjectURL(pdfUrl);
    URL.revokeObjectURL(htmlUrl);
  };

  tab.addEventListener('beforeunload', cleanup);
  setTimeout(cleanup, 120_000);

  return tab;
}
