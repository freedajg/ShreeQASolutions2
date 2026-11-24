export type Role = 'Owner/Admin' | 'Consultant' | 'Marketing';

export type ThemePreference = 'light' | 'dark' | 'system';

export type ServiceType =
  | 'ISO 9001'
  | 'ISO 20000-1'
  | 'ISO 27001'
  | 'ISO 22301'
  | 'ISO 27701'
  | 'ISO 42001'
  | 'ISO 13485'
  | 'CMMI'
  | 'CMMC'
  | 'SOC 1'
  | 'SOC 2'
  | 'GDPR'
  | 'DPDP'
  | 'HIPAA'
  | 'VAPT'
  | 'Other';

export type EngagementStatus =
  | 'Lead'
  | 'Proposal'
  | 'In Progress'
  | 'Implemented'
  | 'Audit Completed'
  | 'Certified'
  | 'Renewal Due'
  | 'Completed'
  | 'On Hold'
  | 'Closed';

export type StatusGroup = 'Sales pipeline' | 'Delivery' | 'Active client' | 'Paused' | 'Ended';

export type PaymentStatus = 'Not Invoiced' | 'Partially Paid' | 'Paid' | 'Overdue' | 'NA';

export type ClientRating = 'High' | 'Medium' | 'Low';

export type LeadSource =
  'Referral' | 'Website' | 'LinkedIn' | 'Existing Client' | 'Partner' | 'Event' | 'Other';

export type ClosedReason =
  'Lost to competitor' | 'No budget' | 'Not interested' | 'Relationship ended' | 'Other';

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  title: string;
  role: Role;
  email: string;
  bookingLink: string;
  outlookConnected: boolean;
  mfaEnabled: boolean;
  active: boolean;
  canViewContractValues: boolean;
}

export type TagTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface Tag {
  id: string;
  name: string;
  tone: TagTone;
}

export interface Client {
  id: string; // database id
  code: string; // Col A (her Client ID, e.g. SQAS-C001); empty if missing
  tags: Tag[];
  name: string; // Col B
  industry: string; // Col C
  address: string; // Col D
  city: string; // Col E
  stateCountry: string; // Col F
  contactPerson: string; // Col G
  designation: string; // Col H
  email: string; // Col I
  phone: string; // Col J
  website: string; // Col K
  leadSource: LeadSource; // Col AB
  rating: ClientRating; // Col AC
  doNotContact: boolean;
  archived?: boolean;
  createdAt: string;
}

export interface MeetingNote {
  id: string;
  date: string;
  heldById: string;
  heldByName: string;
  summary: string;
  nextStep: string;
  source: 'manual' | 'drishti' | 'import' | 'system';
}

export interface EmailRecord {
  id: string;
  threadId: string;
  subject: string;
  body: string;
  sentAt: string;
  sentById: string;
  sentByName: string;
  sentFromEmail: string;
  likelyOpenedAt?: string;
  linkClicks?: { url: string; clickedAt: string; count: number }[];
  repliedAt?: string;
  replySnippet?: string;
}

export interface DeliveryChecklistItem {
  id: string;
  clause: string;
  task: string;
  done: boolean;
}

export interface GapAnalysisItem {
  id: string;
  domain: string;
  currentState: 'Compliant' | 'Partial Gap' | 'Missing';
  ownerNote: string;
}

export interface DocumentRequestItem {
  id: string;
  docName: string;
  status: 'Collected' | 'Pending Client' | 'Under Review';
  updatedAt: string;
}

export interface Engagement {
  id: string;
  clientId: string;
  service: ServiceType;
  standardFramework: string;
  scope: string;
  status: EngagementStatus;
  closedReason?: ClosedReason;
  initialEngagementDate?: string;
  certificationCompletionDate?: string;
  certificateNo?: string;
  certificateValidFrom?: string;
  certificateValidTo?: string;
  certificationBodyOrLA?: string;
  surveillanceRenewalDueDate?: string;
  lastAuditReviewDate?: string;
  nextAuditReviewDate?: string;
  contractValueINR?: number;
  paymentStatus?: PaymentStatus;
  ownerId: string;
  leadSource?: LeadSource; // Col AB (stored on the engagement)
  remarks?: string;
  repliedAt?: string;
  createdById: string;
  lastContactedDate?: string;
  nextFollowUpDate?: string;
  followUpCount: number;
  notes: MeetingNote[];
  emails: EmailRecord[];
  archived: boolean;
  // Phase 2 Delivery Work Tools
  checklist?: DeliveryChecklistItem[];
  gapAnalysis?: GapAnalysisItem[];
  documents?: DocumentRequestItem[];
}

export interface FollowUpDraft {
  id: string;
  engagementId: string;
  clientId: string;
  ownerId: string;
  kind: 'renewal' | 'lead-followup' | 'manual' | 'bulk';
  triggerReason: string;
  threadMode: 'reply' | 'new-thread';
  threadId?: string;
  toEmail?: string;
  subject: string;
  body: string;
  scheduledFor: string;
  status: 'waiting' | 'sending' | 'sent' | 'skipped' | 'rescheduled' | 'failed';
  failureReason?: string;
  sentAt?: string;
  batchId?: string;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  source: 'manual' | 'drishti' | 'system' | 'import';
  action: string;
  entityType: 'client' | 'engagement' | 'email' | 'import' | 'team' | 'settings' | 'phase2';
  entityLabel: string;
  details: string;
}

export interface ImportBatchRecord {
  id: string;
  importedAt: string;
  importedByName: string;
  fileName: string;
  totalRows: number;
  acceptedCount: number;
  flaggedCount: number;
  duplicateCount: number;
  rejectedCount: number;
}

export interface RenewalCycleRule {
  serviceGroup: string;
  surveillanceYears: number | null;
  recertificationYears: number | null;
  description: string;
}

export interface AppSettings {
  followUpIntervalDays: 7 | 15;
  maxFollowUps: number;
  renewalReminderWindowsDays: [number, number];
  services: ServiceType[];
  paymentStatuses: PaymentStatus[];
  leadSources: LeadSource[];
  ratings: ClientRating[];
  cycles: RenewalCycleRule[];
  /** Default cycle per certification type, from the certification_types list. */
  serviceCycles: Partial<
    Record<ServiceType, { surveillanceMonths: number | null; recertMonths: number | null }>
  >;
  emailTestMode: boolean;
  assistantDailyLimit: number;
  m365Provider: 'microsoft' | 'godaddy' | 'unknown';
  m365AdminConsent: boolean;
  retention: {
    closedLeadsYears: number;
    emailContentYears: number;
    openTrackingMonths: number;
    dataResidencyRegion: string;
  };
}

// Phase 2 Types
export interface WhatsAppThread {
  id: string;
  clientId: string;
  engagementId: string;
  contactPhone: string;
  templateUsed: string;
  lastMessageAt: string;
  direction: 'outbound' | 'inbound';
  preview: string;
  deliveryStatus: 'Read' | 'Delivered' | 'Queued' | 'Failed';
}

export interface VoiceCallRecord {
  id: string;
  clientId: string;
  engagementId: string;
  ownerId: string;
  calledAt: string;
  durationSec: number;
  outcome:
    'Requested' | 'Meeting Booked' | 'Requested Proposal' | 'No Answer' | 'Callback Scheduled';
  bookedSlot?: string;
  transcriptSummary: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNo: string;
  clientId: string;
  engagementId: string;
  issuedDate: string;
  dueDate: string;
  amountINR: number;
  gstAmountINR: number;
  status: 'Draft' | 'Paid' | 'Partially Paid' | 'Sent' | 'Overdue';
  syncProvider: 'Tally Prime' | 'Zoho Books';
  syncStatus: 'Synced' | 'Not synced';
}

export type AppView =
  | 'today'
  | 'dashboard'
  | 'radar'
  | 'pipeline'
  | 'delivery'
  | 'clients'
  | 'outreach'
  | 'invoicing'
  | 'webcapture'
  | 'import'
  | 'settings';
