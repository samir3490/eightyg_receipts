import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import nodemailer from 'nodemailer';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ReceiptEmailFields {
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

function buildThankYouHtml(data: ReceiptEmailFields): string {
  const amount = data.amount.toLocaleString('en-IN');
  const addressBlock = data.orgAddress
    ? `<p style="font-size: 12px; color: #64748b; margin-top: 16px;">${data.orgAddress}</p>`
    : '';

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<body style="font-family: Georgia, serif; color: #1a2744; line-height: 1.65; max-width: 600px; margin: 0 auto;">',
    '<div style="text-align: center; padding: 28px 20px; border-bottom: 2px solid #c9a227;">',
    '<p style="margin: 0 0 8px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #c9a227;">Lata Agrawal Foundation</p>',
    `<h1 style="margin: 0; font-size: 22px; color: #1a2744;">${data.orgName}</h1>`,
    '</div>',
    '<div style="padding: 28px 20px;">',
    `<p>Dear <strong>${data.donorName}</strong>,</p>`,
    `<p>Thank you for your generous donation of <strong>₹${amount}</strong> to <strong>${data.orgName}</strong>.</p>`,
    '<p>Your support helps us continue our work and create meaningful impact. We are deeply grateful for your trust and philanthropy.</p>',
    '<p>Please find your official <strong>Section 80G donation receipt</strong> attached to this email. Kindly retain it for your income tax records.</p>',
    '<div style="background: #f7f4ed; border-left: 4px solid #c9a227; padding: 16px 18px; margin: 24px 0; border-radius: 4px;">',
    '<p style="margin: 0 0 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #c9a227;">Receipt summary</p>',
    `<p style="margin: 6px 0;"><strong>Receipt No:</strong> ${data.receiptNo}</p>`,
    `<p style="margin: 6px 0;"><strong>Date:</strong> ${data.donationDate}</p>`,
    `<p style="margin: 6px 0;"><strong>Amount:</strong> ₹${amount}</p>`,
    `<p style="margin: 6px 0;"><strong>Payment:</strong> ${data.paymentMode}</p>`,
    '</div>',
    `<p>With warm regards,<br/><strong>${data.orgName}</strong></p>`,
    addressBlock,
    '</div>',
    '<p style="font-size: 11px; color: #94a3b8; text-align: center; padding: 20px; border-top: 1px solid #e2e8f0;">',
    'Tax exemption under Section 80G is subject to the Income Tax Act, 1961 and applicable rules.',
    '</p>',
    '</body>',
    '</html>',
  ]
    .join('')
    .replace(/<\/?motion/g, (tag) => tag.replace('motion', 'div'));
}

function fieldValue(fields: formidable.Fields, name: string): string {
  const raw = fields[name];
  if (Array.isArray(raw)) return String(raw[0] ?? '');
  return raw ? String(raw) : '';
}

async function parseMultipartRequest(req: VercelRequest): Promise<{
  fields: ReceiptEmailFields;
  pdfBuffer: Buffer;
}> {
  const form = formidable({
    maxFileSize: 8 * 1024 * 1024,
    maxFields: 20,
  });

  const [fields, files] = await form.parse(req);
  const pdfFile = files.pdf?.[0];

  if (!pdfFile?.filepath) {
    throw new Error('PDF attachment is missing');
  }

  const pdfBuffer = fs.readFileSync(pdfFile.filepath);
  fs.unlink(pdfFile.filepath, () => undefined);

  const amount = Number(fieldValue(fields, 'amount'));
  if (!fieldValue(fields, 'to') || !fieldValue(fields, 'donorName') || Number.isNaN(amount)) {
    throw new Error('Missing required fields');
  }

  return {
    fields: {
      to: fieldValue(fields, 'to'),
      donorName: fieldValue(fields, 'donorName'),
      amount,
      orgName: fieldValue(fields, 'orgName'),
      orgAddress: fieldValue(fields, 'orgAddress') || undefined,
      receiptNo: fieldValue(fields, 'receiptNo'),
      donationDate: fieldValue(fields, 'donationDate'),
      paymentMode: fieldValue(fields, 'paymentMode'),
      pdfFilename: fieldValue(fields, 'pdfFilename') || '80G-Receipt.pdf',
    },
    pdfBuffer,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');

  if (!gmailUser || !gmailPass) {
    return res.status(503).json({
      error:
        'Email is not configured on the server. Add GMAIL_USER and GMAIL_APP_PASSWORD in your Vercel project settings.',
    });
  }

  try {
    const { fields, pdfBuffer } = await parseMultipartRequest(req);
    const amount = fields.amount.toLocaleString('en-IN');
    const html = buildThankYouHtml(fields);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from: `"${fields.orgName}" <${gmailUser}>`,
      to: fields.to,
      replyTo: gmailUser,
      subject: `Thank you for your donation — 80G Receipt | ${fields.orgName}`,
      html,
      text: [
        `Dear ${fields.donorName},`,
        '',
        `Thank you for your generous donation of ₹${amount} to ${fields.orgName}.`,
        '',
        'Your Section 80G donation receipt is attached to this email. Please retain it for your tax records.',
        '',
        `Receipt No: ${fields.receiptNo}`,
        `Date: ${fields.donationDate}`,
        `Amount: ₹${amount}`,
        `Payment: ${fields.paymentMode}`,
        '',
        'With warm regards,',
        fields.orgName,
      ].join('\n'),
      attachments: [
        {
          filename: fields.pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Send receipt email error:', err);
    const message = err instanceof Error ? err.message : 'Failed to send email';
    if (message.includes('too large') || message.includes('maxFileSize')) {
      return res.status(413).json({ error: 'Receipt PDF is too large to send.' });
    }
    return res.status(500).json({ error: message });
  }
}
