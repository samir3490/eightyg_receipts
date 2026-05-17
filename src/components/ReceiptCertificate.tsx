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

export function ReceiptCertificate({ org, donor, donation, className = '' }: ReceiptCertificateProps) {
  return (
    <div className={`p-8 md:p-16 text-slate-900 font-serif bg-white ${className}`}>
      <div className="border-[8px] border-slate-900 p-8 md:p-12 relative">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4">{org.name}</h2>
          <p className="text-sm italic text-slate-500 mb-8 max-w-lg mx-auto leading-relaxed">{org.address}</p>
          <div className="flex flex-wrap justify-center gap-6 md:gap-12 text-[10px] font-black border-y-4 border-slate-900 py-5 uppercase tracking-[0.3em]">
            <span>PAN: {org.pan}</span>
            <span>80G REG: {org.regNo}</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-12 md:mb-16 font-sans">
          <div className="bg-slate-900 text-white px-6 md:px-10 py-4 font-black tracking-widest uppercase text-xs">
            Donation Receipt
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-black text-slate-300">
              Receipt ID: <span className="text-slate-900 font-mono">80G-{donation.id.slice(-8).toUpperCase()}</span>
            </p>
            <p className="text-[10px] uppercase font-black text-slate-300 mt-2">
              Date: <span className="text-slate-900 font-bold">{donation.date}</span>
            </p>
          </div>
        </div>
        <div className="space-y-8 md:space-y-10 text-lg md:text-2xl leading-[1.6] mb-16 md:mb-20 text-slate-800">
          <p>
            Received with thanks from <strong>{donor?.name || 'Unknown'}</strong> (PAN:{' '}
            <span className="font-mono font-black">{donor?.pan || 'N/A'}</span>)
          </p>
          <p>
            A sum of <strong>INR {donation.amount.toLocaleString('en-IN')}/-</strong>
          </p>
          <div className="bg-slate-50 p-6 rounded-2xl border-l-8 border-slate-900 font-sans">
            <p className="text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">Amount in Words</p>
            <p className="font-black text-xl md:text-2xl uppercase">{numberToWords(donation.amount)}</p>
          </div>
          <p>
            Via <strong>{donation.paymentMode}</strong>
            {donation.refNo && <span className="text-slate-400"> (Ref: {donation.refNo})</span>}.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-end gap-8 font-sans">
          <div className="text-[10px] text-slate-300 font-bold uppercase tracking-widest max-w-xs leading-relaxed">
            Generated electronically. This certificate is valid for tax exemption under IT Act. Hash:{' '}
            {donation.id.slice(0, 16)}
          </div>
          <div className="text-right">
            <p className="text-sm font-black mb-4">For {org.name}</p>
            {org.signatureBase64 && (
              <img
                src={org.signatureBase64}
                className="h-16 w-40 object-contain mx-auto mb-2"
                alt="Signature"
              />
            )}
            <div className="h-1 w-48 md:w-64 bg-slate-900 mb-3 ml-auto" />
            <p className="text-[10px] uppercase font-black tracking-widest">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
