import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

interface SendReceiptBody {
  to: string;
  donorName: string;
  amount: number;
  orgName: string;
  orgAddress?: string;
  receiptNo: string;
  donationDate: string;
  paymentMode: string;
  pdfBase64: string;
  pdfFilename: string;
}

function buildThankYouHtml(data: SendReceiptBody): string {
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
  ].join('');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    return res.status(503).json({
      error:
        'Email is not configured on the server. Add GMAIL_USER and GMAIL_APP_PASSWORD in your Vercel project settings.',
    });
  }

  const body = req.body as SendReceiptBody;
  if (!body?.to || !body?.pdfBase64 || !body?.donorName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    const pdfBuffer = Buffer.from(body.pdfBase64, 'base64');
    const amount = body.amount.toLocaleString('en-IN');
    const html = buildThankYouHtml(body);

    await transporter.sendMail({
      from: `"${body.orgName}" <${gmailUser}>`,
      to: body.to,
      replyTo: gmailUser,
      subject: `Thank you for your donation — 80G Receipt | ${body.orgName}`,
      html,
      text: [
        `Dear ${body.donorName},`,
        '',
        `Thank you for your generous donation of ₹${amount} to ${body.orgName}.`,
        '',
        'Your Section 80G donation receipt is attached to this email. Please retain it for your tax records.',
        '',
        `Receipt No: ${body.receiptNo}`,
        `Date: ${body.donationDate}`,
        `Amount: ₹${amount}`,
        `Payment: ${body.paymentMode}`,
        '',
        `With warm regards,`,
        body.orgName,
      ].join('\n'),
      attachments: [
        {
          filename: body.pdfFilename || '80G-Receipt.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Send receipt email error:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to send email',
    });
  }
}
