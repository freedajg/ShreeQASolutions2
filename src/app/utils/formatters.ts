import { AppSettings, Engagement, EngagementStatus, StatusGroup, TeamMember } from '../types/crm';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats ISO date (YYYY-MM-DD or full ISO) to dd-mmm-yyyy (e.g., 12-Mar-2024)
 */
export function formatDateDDMMMYYYY(dateStr?: string): string {
  if (!dateStr) return '—';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2].padStart(2, '0');
  if (monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${day}-${MONTHS[monthIdx]}-${year}`;
}

/**
 * Formats a timestamp to dd-mmm-yyyy · HH:MM IST. Database timestamps carry a time zone
 * (usually UTC) and are converted to IST (+05:30); a bare date is shown as a date.
 */
export function formatTimestampIST(isoStr?: string): string {
  if (!isoStr) return '—';
  if (!/T|\s\d{2}:/.test(isoStr)) return formatDateDDMMMYYYY(isoStr);
  const ms = Date.parse(isoStr);
  if (Number.isNaN(ms)) return formatDateDDMMMYYYY(isoStr);
  const ist = new Date(ms + 330 * 60_000).toISOString(); // shift to IST, read as UTC parts
  return `${formatDateDDMMMYYYY(ist.slice(0, 10))} · ${ist.slice(11, 16)} IST`;
}

/** Today's date in India (YYYY-MM-DD). */
export function todayIST(): string {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}

/**
 * Formats number in Indian Rupee grouping (e.g., ₹1,00,000, ₹12,50,000)
 */
export function formatINR(amount?: number | null): string {
  if (amount === undefined || amount === null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Returns number of calendar days from dateA to dateB (positive if dateB is after dateA)
 */
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA.slice(0, 10) + 'T00:00:00Z').getTime();
  const b = new Date(dateB.slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addYears(isoDate: string, years: number): string {
  const d = new Date(isoDate.slice(0, 10) + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function getStatusGroup(status: EngagementStatus): StatusGroup {
  if (status === 'Lead' || status === 'Proposal') return 'Sales pipeline';
  if (status === 'In Progress' || status === 'Implemented' || status === 'Audit Completed')
    return 'Delivery';
  if (status === 'Certified' || status === 'Renewal Due' || status === 'Completed')
    return 'Active client';
  if (status === 'On Hold') return 'Paused';
  return 'Ended';
}

export type RadarBucket = 'Overdue' | 'Due in 30 days' | '31–90 days' | 'Later';

export interface ComputedRenewalInfo {
  dueDate: string | null;
  eventKind: 'Surveillance audit' | 'Recertification' | 'Renewal / Review' | 'No cycle configured';
  isEstimated: boolean;
  daysDelta: number | null; // negative = overdue, positive = days remaining
  bucket: RadarBucket | null;
  ruleUsed: string;
}

/**
 * Implements FR-4 Renewal date rule (in exact priority order). Same rule as the database
 * function app.renewal_info() (supabase/migrations/20261124100000_renewals.sql):
 * 1. Surveillance / Renewal Due Date, if filled          -> surveillance
 * 2. Next Audit / Review Date, if filled                 -> surveillance
 * 3. Certificate Valid To, if filled                      -> recertification
 * 4. Otherwise Certification / Completion Date + the type's first cycle (surveillance months
 *    if it has them, else recertification months), labelled estimated
 */
export function computeRenewalInfo(
  engagement: Engagement,
  referenceDate: string,
  settings: AppSettings,
): ComputedRenewalInfo {
  let dueDate: string | null = null;
  let eventKind: ComputedRenewalInfo['eventKind'] = 'Renewal / Review';
  let isEstimated = false;
  let ruleUsed = '';

  if (engagement.surveillanceRenewalDueDate) {
    dueDate = engagement.surveillanceRenewalDueDate;
    eventKind = 'Surveillance audit';
    ruleUsed = 'Col V: Surveillance / Renewal Due Date';
  } else if (engagement.nextAuditReviewDate) {
    dueDate = engagement.nextAuditReviewDate;
    eventKind = 'Surveillance audit';
    ruleUsed = 'Col X: Next Audit / Review Date';
  } else if (engagement.certificateValidTo) {
    dueDate = engagement.certificateValidTo;
    eventKind = 'Recertification';
    ruleUsed = 'Col T: Certificate Valid To';
  } else if (engagement.certificationCompletionDate) {
    const cycle = settings.serviceCycles?.[engagement.service];
    const months = cycle ? (cycle.surveillanceMonths ?? cycle.recertMonths) : null;
    if (months !== null && months !== undefined) {
      dueDate = addMonths(engagement.certificationCompletionDate, months);
      isEstimated = true;
      eventKind = cycle?.surveillanceMonths ? 'Surveillance audit' : 'Recertification';
      ruleUsed = `Estimated (+${months} months from Col Q)`;
    } else {
      eventKind = 'No cycle configured';
      ruleUsed = 'No automatic cycle for service type';
    }
  }

  if (!dueDate) {
    return {
      dueDate: null,
      eventKind,
      isEstimated: false,
      daysDelta: null,
      bucket: null,
      ruleUsed: ruleUsed || 'No dates entered',
    };
  }

  const daysDelta = daysBetween(referenceDate, dueDate);
  let bucket: RadarBucket = 'Later';
  if (daysDelta < 0) bucket = 'Overdue';
  else if (daysDelta <= 30) bucket = 'Due in 30 days';
  else if (daysDelta <= 90) bucket = '31–90 days';

  return {
    dueDate,
    eventKind,
    isEstimated,
    daysDelta,
    bucket,
    ruleUsed,
  };
}

/** Adds calendar months like Postgres `date + interval 'n months'` (clamps to month end). */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function isLeadQuiet(
  engagement: Engagement,
  referenceDate: string,
  intervalDays: number,
): boolean {
  const group = getStatusGroup(engagement.status);
  if (group !== 'Sales pipeline') return false;
  if (!engagement.lastContactedDate) return true;
  return daysBetween(engagement.lastContactedDate, referenceDate) > intervalDays;
}

/**
 * FR-9 System-level RBAC Enforcement helpers
 */
export function canViewContractValues(user: TeamMember): boolean {
  if (user.role === 'Owner/Admin') return true;
  if (user.role === 'Marketing') return false;
  return user.canViewContractValues;
}

export function canSeeEngagement(user: TeamMember, engagement: Engagement): boolean {
  if (engagement.archived && user.role !== 'Owner/Admin') return false;
  if (user.role === 'Marketing') {
    // Marketing sees leads only: Lead, Proposal and On Hold (the database enforces this too)
    return (
      engagement.status === 'Lead' ||
      engagement.status === 'Proposal' ||
      engagement.status === 'On Hold'
    );
  }
  return true;
}

export function canEditEngagement(user: TeamMember, engagement: Engagement): boolean {
  if (user.role === 'Owner/Admin') return true;
  if (user.role === 'Consultant') return engagement.ownerId === user.id;
  if (user.role === 'Marketing') {
    return (
      (engagement.status === 'Lead' ||
        engagement.status === 'Proposal' ||
        engagement.status === 'On Hold') &&
      engagement.createdById === user.id
    );
  }
  return false;
}

export function canSendEmailForOwner(user: TeamMember, ownerId: string): boolean {
  if (user.role === 'Owner/Admin') return true; // Can approve & trigger from owner's mailbox
  if (user.role === 'Consultant') return user.id === ownerId;
  return false; // Marketing cannot send emails
}

/**
 * FR-12: One-click Excel (CSV) export in exact 30-column layout (Col A to Col AD)
 */
export function generate30ColumnCSV(
  clients: Record<
    string,
    {
      id: string;
      code: string;
      name: string;
      industry: string;
      address: string;
      city: string;
      stateCountry: string;
      contactPerson: string;
      designation: string;
      email: string;
      phone: string;
      website: string;
      leadSource: string;
      rating: string;
    }
  >,
  engagements: Engagement[],
  membersById: Record<string, TeamMember>,
  includeFinancials: boolean,
): string {
  const headers = [
    'Client ID',
    'Client Name',
    'Industry / Sector',
    'Address',
    'City',
    'State / Country',
    'Contact Person',
    'Designation',
    'Email',
    'Phone',
    'Website',
    'Service / Certification',
    'Standard / Framework',
    'Scope of Certification / Service',
    'Certification / Service Status',
    'Initial Engagement Date',
    'Certification / Completion Date',
    'Certificate / Report No.',
    'Certificate Valid From',
    'Certificate Valid To',
    'Certification Body / External LA',
    'Surveillance / Renewal Due Date',
    'Last Audit / Review Date',
    'Next Audit / Review Date',
    'Contract Value',
    'Payment Status',
    'Relationship Owner',
    'Lead Source',
    'Client Rating / Priority',
    'Remarks',
  ];

  const escape = (val?: string | number) => {
    let s = val === undefined || val === null ? '' : String(val);
    // A cell starting with = + - @ would run as a formula in Excel (CSV injection).
    if (typeof val === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = engagements
    .filter((e) => !e.archived)
    .map((e) => {
      const c = clients[e.clientId];
      const ownerName = e.ownerId ? membersById[e.ownerId]?.name || '' : '';
      return [
        c?.code || '',
        c?.name || '',
        c?.industry || '',
        c?.address || '',
        c?.city || '',
        c?.stateCountry || '',
        c?.contactPerson || '',
        c?.designation || '',
        c?.email || '',
        c?.phone || '',
        c?.website || '',
        e.service,
        e.standardFramework,
        e.scope,
        e.status,
        formatDateDDMMMYYYY(e.initialEngagementDate).replace('—', ''),
        formatDateDDMMMYYYY(e.certificationCompletionDate).replace('—', ''),
        e.certificateNo || '',
        formatDateDDMMMYYYY(e.certificateValidFrom).replace('—', ''),
        formatDateDDMMMYYYY(e.certificateValidTo).replace('—', ''),
        e.certificationBodyOrLA || '',
        formatDateDDMMMYYYY(e.surveillanceRenewalDueDate).replace('—', ''),
        formatDateDDMMMYYYY(e.lastAuditReviewDate).replace('—', ''),
        formatDateDDMMMYYYY(e.nextAuditReviewDate).replace('—', ''),
        includeFinancials ? (e.contractValueINR ?? '') : '',
        includeFinancials ? (e.paymentStatus ?? '') : '',
        ownerName,
        e.leadSource || c?.leadSource || '',
        c?.rating || '',
        e.remarks || '',
      ]
        .map(escape)
        .join(',');
    });

  return [headers.map(escape).join(','), ...rows].join('\n');
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
