import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import nodemailer from 'nodemailer';
import fs from 'fs';

const ALLOWED_ORIGINS = [
  'https://portal.agrawalfoundation.org',
  'https://donor-transparency.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
}

function formatIndianDate(dateString: string): string {
  if (!dateString) return '';
  const part = dateString.includes('T') ? dateString.split('T')[0] : dateString.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
    const [year, month, day] = part.split('-');
    return `${day}/${month}/${year}`;
  }
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

interface CertificateEmailFields {
  to: string;
  recipientName: string;
  programName: string;
  role: string;
  startDate: string;
  endDate: string;
  pdfFilename: string;
}

function fieldValue(fields: formidable.Fields, name: string): string {
  const raw = fields[name];
  if (Array.isArray(raw)) return String(raw[0] ?? '');
  return raw ? String(raw) : '';
}

function roleLabel(role: string): string {
  switch (role) {
    case 'trainer':
      return 'Training Excellence';
    case 'volunteer':
      return 'Volunteer Service';
    default:
      return 'Completion';
  }
}

function buildEmailHtml(data: CertificateEmailFields): string {
  const start = formatIndianDate(data.startDate);
  const end = formatIndianDate(data.endDate);
  const certType = roleLabel(data.role);

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<body style="font-family: Georgia, serif; color: #1a2744; line-height: 1.65; max-width: 600px; margin: 0 auto;">',
    '<div style="text-align: center; padding: 28px 20px; border-bottom: 2px solid #c9a227;">',
    '<p style="margin: 0 0 8px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #c9a227;">Lata Agrawal Foundation</p>',
    '<h1 style="margin: 0; font-size: 22px; color: #1a2744;">Certificate of ' + certType + '</h1>',
    '</div>',
    '<div style="padding: 28px 20px;">',
    `<p>Dear <strong>${data.recipientName}</strong>,</p>`,
    `<p>Congratulations! Please find your official <strong>Certificate of ${certType}</strong> for <strong>${data.programName}</strong> attached to this email.</p>`,
    '<p>We appreciate your dedication and are proud to recognize your achievement with the Lata Agrawal Foundation.</p>',
    '<div style="background: #f7f4ed; border-left: 4px solid #c9a227; padding: 16px 18px; margin: 24px 0; border-radius: 4px;">',
    '<p style="margin: 0 0 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #c9a227;">Program period</p>',
    `<p style="margin: 6px 0;"><strong>Start:</strong> ${start}</p>`,
    `<p style="margin: 6px 0;"><strong>End:</strong> ${end}</p>`,
    `<p style="margin: 6px 0;"><strong>Program:</strong> ${data.programName}</p>`,
    '</div>',
    '<p>With warm regards,<br/><strong>Lata Agrawal Foundation</strong></p>',
    '</div>',
    '</body>',
    '</html>',
  ].join('');
}

async function parseMultipartRequest(req: VercelRequest): Promise<{
  fields: CertificateEmailFields;
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

  if (!fieldValue(fields, 'to') || !fieldValue(fields, 'recipientName') || !fieldValue(fields, 'programName')) {
    throw new Error('Missing required fields');
  }

  return {
    fields: {
      to: fieldValue(fields, 'to'),
      recipientName: fieldValue(fields, 'recipientName'),
      programName: fieldValue(fields, 'programName'),
      role: fieldValue(fields, 'role') || 'student',
      startDate: fieldValue(fields, 'startDate'),
      endDate: fieldValue(fields, 'endDate'),
      pdfFilename: fieldValue(fields, 'pdfFilename') || 'Certificate.pdf',
    },
    pdfBuffer,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');

  if (!gmailUser || !gmailPass) {
    return res.status(503).json({
      error: 'Email is not configured on the 80G server.',
    });
  }

  try {
    const { fields, pdfBuffer } = await parseMultipartRequest(req);
    const html = buildEmailHtml(fields);
    const certType = roleLabel(fields.role);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from: `"Lata Agrawal Foundation" <${gmailUser}>`,
      to: fields.to,
      replyTo: gmailUser,
      subject: `Your Certificate of ${certType} — ${fields.programName} | Lata Agrawal Foundation`,
      html,
      text: [
        `Dear ${fields.recipientName},`,
        '',
        `Congratulations! Your Certificate of ${certType} for ${fields.programName} is attached.`,
        '',
        `Program period: ${formatIndianDate(fields.startDate)} to ${formatIndianDate(fields.endDate)}`,
        '',
        'With warm regards,',
        'Lata Agrawal Foundation',
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
    console.error('Send certificate email error:', err);
    const message = err instanceof Error ? err.message : 'Failed to send email';
    if (message.includes('too large') || message.includes('maxFileSize')) {
      return res.status(413).json({ error: 'Certificate PDF is too large to send.' });
    }
    return res.status(500).json({ error: message });
  }
}
