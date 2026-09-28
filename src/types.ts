export type ServiceKind = 'CMMI' | 'ISO' | 'IPA' | 'Other';

export type Stage =
  | 'New'
  | 'Contacted'
  | 'Demo scheduled'
  | 'Demo done'
  | 'Proposal sent'
  | 'Won'
  | 'Lost';

export interface ActivityNote {
  at: string; // ISO string
  note: string;
  author?: string;
}

export interface Client {
  id: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  service: ServiceKind;
  level?: string;
  lastAppraisalDate: string; // ISO string (YYYY-MM-DD)
  contractValue: number;
  owner: string;
  notes: string;
  activity?: ActivityNote[];
  lastContactDate?: string;
}

export interface Lead {
  id: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  source: string;
  stage: Stage;
  value: number;
  owner: string;
  lastContactDate: string; // ISO string (YYYY-MM-DD)
  nextFollowUpDate: string; // ISO string (YYYY-MM-DD)
  meetingContext: string; // INTERNAL, third person
  serviceInterest?: ServiceKind;
  activity: ActivityNote[];
  lostReason?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: 'Founder' | 'Auditor';
}

export interface ToolProposal {
  action: 'update_lead' | 'update_client' | 'create_lead' | 'create_client';
  id?: string;
  targetName: string;
  changes: Record<string, any>;
  reason: string;
  applied?: boolean;
  discarded?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  providerStamped: string; // e.g. "via OpenRouter (poolside/laguna-xs-2.1:free)" or "via Local Rule Engine"
  isOffline?: boolean;
  proposal?: ToolProposal;
  suggestedDrafts?: Array<{
    id: string;
    company: string;
    contactName: string;
    type: 'lead' | 'client';
    email: string;
  }>;
}

export interface AppSettings {
  openRouterApiKey: string;
  groqApiKey: string;
  openRouterModels: string[]; // up to 3 models
  groqModel: string;
  activeUserId: string;
}

export interface BriefingCard {
  id: string;
  type: 'lapsed' | 'due_soon' | 'quiet_leads' | 'proposals_out';
  title: string;
  tag: string;
  tagColor: 'rose' | 'amber' | 'cyan' | 'brand';
  worstOffender: string;
  valueAtStake: number;
  owner: string;
  detail: string;
  actionPrompt: string;
}

export interface BriefingData {
  greeting: string;
  dateStr: string;
  summaryLine: string;
  cards: BriefingCard[];
  chips: string[];
}

export type TabKey =
  | 'drishti'
  | 'dashboard'
  | 'radar'
  | 'pipeline'
  | 'clients'
  | 'import'
  | 'settings';
