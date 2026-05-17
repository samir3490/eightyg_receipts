/** Parse YYYY-MM-DD or ISO strings without UTC day-shift */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]) - 1;
    const d = Number(iso[3]);
    return new Date(y, m, d);
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Display date as DD/MM/YYYY across the app */
export function formatDateDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${day}/${month}/${year}, ${time}`;
}

/** @deprecated Use formatDateDDMMYYYY */
export function formatShortDate(dateStr: string): string {
  return formatDateDDMMYYYY(dateStr);
}

/** For date inputs and Firestore (YYYY-MM-DD) */
export function toInputDateValue(dateStr: string): string {
  if (!dateStr) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayInputDateValue(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Indian financial year label e.g. FY 2025–26 */
export function currentFinancialYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (m >= 3) return `FY ${y}–${String(y + 1).slice(-2)}`;
  return `FY ${y - 1}–${String(y).slice(-2)}`;
}
