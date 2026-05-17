import { numberToWords } from '../utils/numberToWords';
import { formatDateDDMMYYYY } from '../utils/format';

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

/** Foundation brand assets & colours (from official logo) */
const LOGO_SRC = '/lata-agrawal-foundation-logo.png';
const BRAND_NAVY = '#1a2744';
const BRAND_GOLD = '#c9a227';
const BRAND_CREAM = '#f7f4ed';

/** A4 landscape proportions — fixed size so PDF export fits one page */
export const RECEIPT_WIDTH_PX = 1050;
export const RECEIPT_HEIGHT_PX = 742;

export function ReceiptCertificate({ org, donor, donation, className = '' }: ReceiptCertificateProps) {
  const receiptNo = `80G-${donation.id.slice(-8).toUpperCase()}`;
  const formattedDate = formatDateDDMMYYYY(donation.date);
  const amountFormatted = donation.amount.toLocaleString('en-IN');

  return (
    <div
      className={`relative box-border overflow-hidden bg-white font-sans text-slate-800 ${className}`}
      style={{ width: RECEIPT_WIDTH_PX, height: RECEIPT_HEIGHT_PX, minWidth: RECEIPT_WIDTH_PX, minHeight: RECEIPT_HEIGHT_PX }}
    >
      {/* Brand accent — navy to gold */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: `linear-gradient(to bottom, ${BRAND_NAVY}, ${BRAND_GOLD})` }}
      />

      <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none opacity-40" style={{ background: `radial-gradient(circle at top right, ${BRAND_CREAM}, transparent 70%)` }} />

      <div className="relative h-full flex flex-col pl-8 pr-10 py-7">
        {/* Header with logo */}
        <div className="flex justify-between items-start gap-6 pb-5 border-b" style={{ borderColor: `${BRAND_GOLD}33` }}>
          <div className="flex items-start gap-5 min-w-0 flex-1">
            <div
              className="shrink-0 rounded-xl p-2 shadow-sm border"
              style={{ backgroundColor: BRAND_CREAM, borderColor: `${BRAND_GOLD}55` }}
            >
              <img
                src={LOGO_SRC}
                alt="Lata Agrawal Foundation"
                className="h-[88px] w-[88px] object-contain"
                crossOrigin="anonymous"
              />
            </div>
            <div className="min-w-0 pt-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.22em] mb-1.5"
                style={{ color: BRAND_GOLD }}
              >
                Tax Exemption Certificate
              </p>
              <h1
                className="text-[20px] font-semibold leading-tight tracking-tight"
                style={{ color: BRAND_NAVY, fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {org.name}
              </h1>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-snug max-w-md">{org.address}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5 text-[10px] text-slate-600">
                <span>
                  <span className="uppercase tracking-wide text-slate-400">PAN </span>
                  <span className="font-mono font-medium" style={{ color: BRAND_NAVY }}>{org.pan}</span>
                </span>
                <span>
                  <span className="uppercase tracking-wide text-slate-400">80G Registration </span>
                  <span className="font-medium" style={{ color: BRAND_NAVY }}>{org.regNo}</span>
                </span>
              </div>
            </div>
          </div>

          <div
            className="shrink-0 text-right rounded-lg px-4 py-3 border"
            style={{ backgroundColor: BRAND_CREAM, borderColor: `${BRAND_GOLD}44` }}
          >
            <p className="text-[9px] uppercase tracking-widest font-medium" style={{ color: BRAND_GOLD }}>
              Receipt No.
            </p>
            <p className="font-mono text-sm font-semibold mt-0.5" style={{ color: BRAND_NAVY }}>
              {receiptNo}
            </p>
            <p className="text-[9px] uppercase tracking-widest font-medium mt-2.5" style={{ color: BRAND_GOLD }}>
              Date
            </p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: BRAND_NAVY }}>
              {formattedDate}
            </p>
          </div>
        </div>

        {/* Title */}
        <div className="py-3.5">
          <span
            className="inline-flex items-center gap-2 text-white text-[10px] font-semibold uppercase tracking-[0.18em] px-4 py-2 rounded-md"
            style={{ backgroundColor: BRAND_NAVY }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: BRAND_GOLD }} />
            Donation Receipt under Section 80G
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
          <div className="col-span-7 flex flex-col justify-center space-y-3.5 text-[13px] leading-relaxed text-slate-700">
            <p>This is to certify that we have received a voluntary donation with thanks from</p>
            <div className="pl-4 py-1 border-l-2" style={{ borderColor: BRAND_GOLD }}>
              <p className="text-lg font-semibold" style={{ color: BRAND_NAVY }}>
                {donor?.name || 'Unknown Donor'}
              </p>
              <p className="text-[11px] mt-1 text-slate-500">
                PAN <span className="font-mono font-semibold" style={{ color: BRAND_NAVY }}>{donor?.pan || 'N/A'}</span>
              </p>
            </div>
            <p>
              The donation is eligible for deduction under Section 80G of the Income Tax Act, 1961,
              subject to applicable limits and conditions.
            </p>
            <p className="text-[12px] text-slate-600">
              <span className="text-slate-500">Payment mode:</span>{' '}
              <span className="font-medium" style={{ color: BRAND_NAVY }}>{donation.paymentMode}</span>
              {donation.refNo && (
                <span className="text-slate-400">
                  {' '}
                  · Ref. <span className="font-mono">{donation.refNo}</span>
                </span>
              )}
            </p>
          </div>

          <div className="col-span-5 flex flex-col justify-center">
            <div
              className="rounded-xl p-5 shadow-sm border"
              style={{
                borderColor: `${BRAND_GOLD}44`,
                background: `linear-gradient(135deg, ${BRAND_CREAM} 0%, #ffffff 100%)`,
              }}
            >
              <p className="text-[9px] uppercase tracking-widest font-medium" style={{ color: BRAND_GOLD }}>
                Amount Received
              </p>
              <p className="text-3xl font-semibold mt-1 tracking-tight" style={{ color: BRAND_NAVY }}>
                ₹{amountFormatted}
                <span className="text-lg text-slate-400 font-normal"> /-</span>
              </p>
              <div className="mt-4 pt-4 border-t" style={{ borderColor: `${BRAND_GOLD}33` }}>
                <p className="text-[9px] uppercase tracking-widest font-medium mb-1" style={{ color: BRAND_GOLD }}>
                  In Words
                </p>
                <p className="text-[12px] font-medium leading-snug uppercase" style={{ color: BRAND_NAVY }}>
                  {numberToWords(donation.amount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end gap-8 pt-3 border-t" style={{ borderColor: `${BRAND_GOLD}22` }}>
          <div className="max-w-md">
            <p className="text-[9px] text-slate-400 leading-relaxed">
              Computer-generated receipt · Valid for tax exemption under the Income Tax Act · ID:{' '}
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
                crossOrigin="anonymous"
              />
            ) : (
              <div className="h-12 mb-1" />
            )}
            <div className="w-44 border-t ml-auto pt-1.5" style={{ borderColor: `${BRAND_GOLD}66` }}>
              <p className="text-[9px] uppercase tracking-widest font-medium" style={{ color: BRAND_GOLD }}>
                Authorized Signatory
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
