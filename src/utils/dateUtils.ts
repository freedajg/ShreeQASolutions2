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

export function formatStandardDate(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }); // e.g. "12 Mar 2027"
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
