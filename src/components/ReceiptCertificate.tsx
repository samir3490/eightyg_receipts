import { numberToWords } from '../utils/numberToWords';

export interface ReceiptOrg {
  name: string;
  pan: string;
  regNo: string;
  address: string;
  signatureBase64?: string | null;
}

export interface ReceiptDonor {
  name: string;
  pan: string;
}

export interface ReceiptDonation {
  id: string;
  amount: number;
  date: string;
  paymentMode: string;
  refNo?: string;
}

interface ReceiptCertificateProps {
  org: ReceiptOrg;
  donor?: ReceiptDonor;
  donation: ReceiptDonation;
  className?: string;
}

const formatReceiptDate = (dateStr: string): string => {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/** A4 landscape proportions — fixed size so PDF export fits one page */
export const RECEIPT_WIDTH_PX = 1050;
export const RECEIPT_HEIGHT_PX = 742;

export function ReceiptCertificate({ org, donor, donation, className = '' }: ReceiptCertificateProps) {
  const receiptNo = `80G-${donation.id.slice(-8).toUpperCase()}`;
  const formattedDate = formatReceiptDate(donation.date);
  const amountFormatted = donation.amount.toLocaleString('en-IN');

  return (
    <div
      className={`relative box-border overflow-hidden bg-white font-sans text-slate-800 ${className}`}
      style={{ width: RECEIPT_WIDTH_PX, height: RECEIPT_HEIGHT_PX, minWidth: RECEIPT_WIDTH_PX, minHeight: RECEIPT_HEIGHT_PX }}
    >
      {/* Accent edge */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 via-blue-700 to-slate-800" />

      {/* Subtle corner mark */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-slate-50 to-transparent pointer-events-none" />

      <div className="relative h-full flex flex-col pl-8 pr-10 py-8">
        {/* Header */}
        <div className="flex justify-between items-start gap-8 pb-5 border-b border-slate-200">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-700 mb-1.5">
              Tax Exemption Certificate
            </p>
            <h1 className="text-[22px] font-semibold leading-tight text-slate-900 tracking-tight">
              {org.name}
            </h1>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug max-w-lg">{org.address}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-[10px] text-slate-600">
              <span>
                <span className="uppercase tracking-wide text-slate-400">PAN </span>
                <span className="font-mono font-medium text-slate-800">{org.pan}</span>
              </span>
              <span>
                <span className="uppercase tracking-wide text-slate-400">80G Registration </span>
                <span className="font-medium text-slate-800">{org.regNo}</span>
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
            <p className="text-[9px] uppercase tracking-widest text-slate-400 font-medium">Receipt No.</p>
            <p className="font-mono text-sm font-semibold text-slate-900 mt-0.5">{receiptNo}</p>
            <p className="text-[9px] uppercase tracking-widest text-slate-400 font-medium mt-2.5">Date</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">{formattedDate}</p>
          </div>
        </div>

        {/* Title */}
        <div className="py-4">
          <span className="inline-flex items-center gap-2 bg-slate-900 text-white text-[10px] font-semibold uppercase tracking-[0.18em] px-4 py-2 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Donation Receipt under Section 80G
          </span>
        </div>

        {/* Body — two columns */}
        <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
          <div className="col-span-7 flex flex-col justify-center space-y-4 text-[13px] leading-relaxed text-slate-700">
            <p>
              This is to certify that we have received a voluntary donation with thanks from
            </p>
            <div className="border-l-2 border-blue-600 pl-4 py-1">
              <p className="text-lg font-semibold text-slate-900">{donor?.name || 'Unknown Donor'}</p>
              <p className="text-[11px] mt-1 text-slate-500">
                PAN{' '}
                <span className="font-mono font-semibold text-slate-800">{donor?.pan || 'N/A'}</span>
              </p>
            </div>
            <p>
              The donation is eligible for deduction under Section 80G of the Income Tax Act, 1961,
              subject to applicable limits and conditions.
            </p>
            <p className="text-[12px] text-slate-600">
              <span className="text-slate-500">Payment mode:</span>{' '}
              <span className="font-medium text-slate-800">{donation.paymentMode}</span>
              {donation.refNo && (
                <span className="text-slate-400">
                  {' '}
                  · Ref. <span className="font-mono">{donation.refNo}</span>
                </span>
              )}
            </p>
          </div>

          <div className="col-span-5 flex flex-col justify-center gap-4">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
              <p className="text-[9px] uppercase tracking-widest text-slate-400 font-medium">Amount Received</p>
              <p className="text-3xl font-semibold text-slate-900 mt-1 tracking-tight">
                ₹{amountFormatted}
                <span className="text-lg text-slate-400 font-normal"> /-</span>
              </p>
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-[9px] uppercase tracking-widest text-slate-400 font-medium mb-1">
                  In Words
                </p>
                <p className="text-[12px] font-medium text-slate-800 leading-snug uppercase">
                  {numberToWords(donation.amount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end gap-8 pt-4 border-t border-slate-100">
          <div className="max-w-md">
            <p className="text-[9px] text-slate-400 leading-relaxed">
              This is a computer-generated receipt. Exemption under Section 80G is subject to the
              provisions of the Income Tax Act and rules framed thereunder. Document ID:{' '}
              <span className="font-mono text-slate-500">{donation.id.slice(0, 12)}</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-slate-500 mb-2">For {org.name}</p>
            {org.signatureBase64 ? (
              <img
                src={org.signatureBase64}
                className="h-12 w-36 object-contain ml-auto mb-1"
                alt="Authorized signature"
              />
            ) : (
              <div className="h-12 mb-1" />
            )}
            <div className="w-44 border-t border-slate-300 ml-auto pt-1.5">
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-medium">
                Authorized Signatory
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
