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
  // Compact PDF for email — avoids Vercel 4.5MB request limit (413 Payload Too Large)
  const pdfBlob = await receiptElementToPdfBlob(params.element, {
    scale: 1,
    jpegQuality: 0.88,
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
