import { receiptElementToPdfBlob } from './receiptPdf';

export interface SendReceiptEmailParams {
  element: HTMLElement;
  to: string;
  donorName: string;
  amount: number;
  orgName: string;
  orgAddress?: string;
  receiptNo: string;
  donationDate: string;
  paymentMode: string;
  pdfFilename: string;
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Could not encode PDF'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Could not read PDF file'));
    reader.readAsDataURL(blob);
  });

export async function sendReceiptEmailToDonor(params: SendReceiptEmailParams): Promise<void> {
  const pdfBlob = await receiptElementToPdfBlob(params.element);
  const pdfBase64 = await blobToBase64(pdfBlob);

  const response = await fetch('/api/send-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: params.to,
      donorName: params.donorName,
      amount: params.amount,
      orgName: params.orgName,
      orgAddress: params.orgAddress,
      receiptNo: params.receiptNo,
      donationDate: params.donationDate,
      paymentMode: params.paymentMode,
      pdfBase64,
      pdfFilename: params.pdfFilename,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string; success?: boolean };

  if (!response.ok) {
    throw new Error(data.error || `Failed to send email (${response.status})`);
  }
}
