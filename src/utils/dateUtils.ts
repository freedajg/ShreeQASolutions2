import { Client, ServiceKind } from '../types';

/**
 * Derives renewal cycle in years based on service type.
 * CMMI (ML3, ML5) = 3 years
 * ISO, IPA and others = 1 year
 */
export function getRenewalCycleYears(service: ServiceKind): number {
  if (service === 'CMMI') {
    return 3;
  }
  return 1;
}

/**
 * Computes exact renewal date from client's last appraisal date and service cycle.
 */
export function getRenewalDate(client: Client): Date {
  const lastDate = new Date(client.lastAppraisalDate);
  if (isNaN(lastDate.getTime())) {
    return new Date();
  }
  const cycleYears = getRenewalCycleYears(client.service);
  const renewal = new Date(lastDate);
  renewal.setFullYear(renewal.getFullYear() + cycleYears);
  return renewal;
}

/**
 * Returns integer days until renewal (negative means overdue).
 */
export function getDaysUntilRenewal(client: Client, referenceDate: Date = new Date()): number {
  const renewalDate = getRenewalDate(client);
  const diffTime = renewalDate.getTime() - referenceDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export type RenewalBand = 'overdue' | 'due_soon' | 'upcoming' | 'later';

export function getRenewalBand(daysRemaining: number): RenewalBand {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 90) return 'due_soon';
  if (daysRemaining <= 180) return 'upcoming';
  return 'later';
}

// Fixed English month names (rule 8: dd-MMM-yyyy). Never locale-formatted, so September is
// always "Sep" (Chrome's en-GB short month is "Sept").
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// IST is UTC+05:30 all year (India has no daylight saving).
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Formats a date as dd-MMM-yyyy, e.g. "28-Sep-2026", "01-Oct-2026".
 * - Date-only strings (YYYY-MM-DD) are read by their parts: no Date object, no time-zone shift.
 * - Timestamps (strings with a time, or Date objects) are shown as the calendar day in IST.
 * - Empty, null, undefined or invalid input gives "—".
 */
export function formatStandardDate(dateInput: string | Date): string {
  if (!dateInput) return '—';

  if (typeof dateInput === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);
      const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return '—';
      return `${dateOnly[3]}-${MONTHS[month - 1]}-${dateOnly[1]}`;
    }
  }

  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';

  // Shift the instant by +05:30 and read the UTC fields: that is the calendar day in IST,
  // whatever time zone the browser is in.
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const day = String(ist.getUTCDate()).padStart(2, '0');
  return `${day}-${MONTHS[ist.getUTCMonth()]}-${ist.getUTCFullYear()}`;
}

export function formatFullDate(dateInput: string | Date = new Date()): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }); // e.g. "Sunday, 30 August 2026"
}

export function getDaysAgo(dateInput: string | Date, referenceDate: Date = new Date()): number {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return 0;
  const diffTime = referenceDate.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}
