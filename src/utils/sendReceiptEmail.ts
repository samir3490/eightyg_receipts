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

export async function sendReceiptEmailToDonor(params: SendReceiptEmailParams): Promise<void> {
  // Full resolution (scale 2) with high-quality JPEG — sharp text, still small enough to email
  const pdfBlob = await receiptElementToPdfBlob(params.element, {
    scale: 2,
    useJpeg: true,
    jpegQuality: 0.97,
  });

  const form = new FormData();
  form.append('to', params.to);
  form.append('donorName', params.donorName);
  form.append('amount', String(params.amount));
  form.append('orgName', params.orgName);
  if (params.orgAddress) form.append('orgAddress', params.orgAddress);
  form.append('receiptNo', params.receiptNo);
  form.append('donationDate', params.donationDate);
  form.append('paymentMode', params.paymentMode);
  form.append('pdfFilename', params.pdfFilename);
  form.append('pdf', pdfBlob, params.pdfFilename);

  const response = await fetch('/api/send-receipt', {
    method: 'POST',
    body: form,
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string };

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error(
        'Receipt file is too large to send. Please try again, or download the PDF and email it manually.'
      );
    }
    throw new Error(data.error || `Failed to send email (${response.status})`);
  }
}
