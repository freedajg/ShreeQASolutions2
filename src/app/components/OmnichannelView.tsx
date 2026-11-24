import React, { useState } from 'react';
import { CheckCircle2, MessageCircle, PhoneCall, Send } from 'lucide-react';
import { Client, Engagement, TeamMember, VoiceCallRecord, WhatsAppThread } from '../types/crm';
import { formatTimestampIST } from '../utils/formatters';

interface OmnichannelViewProps {
  clients: Client[];
  clientsById: Record<string, Client>;
  engagements: Engagement[];
  membersById: Record<string, TeamMember>;
  whatsappThreads: WhatsAppThread[];
  voiceCalls: VoiceCallRecord[];
  onSendWhatsApp: (clientId: string, engagementId: string, template: string, text: string) => void;
  onLogCall: (call: {
    clientId: string;
    engagementId: string;
    ownerId: string;
    outcome: string;
    durationSec?: number;
    bookedSlot?: string;
    summary?: string;
  }) => void;
}

// SQAS has no WhatsApp Business account or calling provider yet (PRD §5, phase 2). This screen
// keeps an honest record: WhatsApp messages are saved as queued (nothing is sent), and calls are
// logged by the person who made them. No call or message is simulated.
const CALL_OUTCOMES = [
  'Meeting Booked',
  'Requested Proposal',
  'Callback Scheduled',
  'No Answer',
] as const;

const APPROVED_WA_TEMPLATES = [
  {
    id: 'sqas_cmmi_renewal_reminder_v1',
    label: 'CMMI 3-Year Renewal Reminder',
    body: 'Namaste {{contact}}, reminder from {{owner}} (SQAS): {{company}} CMMI appraisal is due for renewal. Reply 1 to book a 15-min calendar slot.',
  },
  {
    id: 'sqas_iso_surveillance_check',
    label: 'ISO Annual Surveillance Check-in',
    body: 'Hi {{contact}}, your ISO surveillance audit window is approaching. Let us confirm readiness on a quick call with {{owner}}.',
  },
  {
    id: 'sqas_lead_proposal_followup',
    label: 'Lead Proposal Follow-up',
    body: 'Hi {{contact}}, following up from Shree QA Solutions on your {{service}} readiness timeline. Pick a slot on {{owner}}’s calendar anytime.',
  },
];

export const OmnichannelView: React.FC<OmnichannelViewProps> = ({
  clients,
  clientsById,
  engagements,
  membersById,
  whatsappThreads,
  voiceCalls,
  onSendWhatsApp,
  onLogCall,
}) => {
  const open = engagements.filter((e) => !e.archived && e.status !== 'Closed');
  const [channelTab, setChannelTab] = useState<'whatsapp' | 'voice'>('whatsapp');
  const [selectedEngId, setSelectedEngId] = useState(open[0]?.id || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState(APPROVED_WA_TEMPLATES[0].id);
  const [outcome, setOutcome] = useState<string>(CALL_OUTCOMES[0]);
  const [minutes, setMinutes] = useState('');
  const [slot, setSlot] = useState('');
  const [summary, setSummary] = useState('');

  const activeEng = open.find((e) => e.id === selectedEngId) || open[0];
  const activeClient = activeEng ? clientsById[activeEng.clientId] : clients[0];
  const activeOwner = activeEng?.ownerId ? membersById[activeEng.ownerId] : undefined;

  const tpl =
    APPROVED_WA_TEMPLATES.find((t) => t.id === selectedTemplateId) || APPROVED_WA_TEMPLATES[0];
  const renderedPreview = tpl.body
    .replace('{{contact}}', activeClient?.contactPerson.split(' ')[0] || 'there')
    .replace('{{company}}', activeClient?.name || 'your team')
    .replace('{{owner}}', activeOwner?.name.split(' ')[0] || 'Shree QA Solutions')
    .replace('{{service}}', activeEng?.service || 'ISO');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-text">WhatsApp & Calls</h2>
          <p className="mt-0.5 text-sm text-muted">
            Queue WhatsApp reminders and log client calls. Sending starts once a WhatsApp Business
            account is connected (phase 2).
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg bg-raised p-1 border border-border">
          <button
            type="button"
            onClick={() => setChannelTab('whatsapp')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              channelTab === 'whatsapp'
                ? 'bg-surface text-text shadow-xs'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>WhatsApp Business</span>
          </button>
          <button
            type="button"
            onClick={() => setChannelTab('voice')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              channelTab === 'voice'
                ? 'bg-surface text-text shadow-xs'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>Call Log</span>
          </button>
        </div>
      </div>

      {channelTab === 'whatsapp' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Meta Account & Template Composer */}
          <div className="lg:col-span-5 rounded-xl border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="text-xs font-medium text-text">WhatsApp Business</div>
                <div className="text-[11px] text-warning mt-0.5">
                  Not connected yet: messages are saved as queued, not sent
                </div>
              </div>
              <CheckCircle2 className="h-4 w-4 text-muted shrink-0" />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-text-secondary mb-1">
                  Target Engagement
                </label>
                <select
                  value={selectedEngId}
                  onChange={(e) => setSelectedEngId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                >
                  {open.map((e) => (
                    <option key={e.id} value={e.id}>
                      {clientsById[e.clientId]?.name} — {e.service || 'Service not set'} (
                      {e.status || 'no status'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-text-secondary mb-1">
                  Message Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                >
                  {APPROVED_WA_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[11px] font-medium text-muted mb-1">
                  Rendered Preview ({activeClient?.phone || 'No phone'})
                </div>
                <div className="rounded-xl border border-success-line bg-success-wash p-3.5 text-text leading-relaxed">
                  {renderedPreview}
                </div>
              </div>

              <button
                type="button"
                disabled={!activeClient?.phone || activeClient?.doNotContact}
                onClick={() =>
                  activeClient &&
                  activeEng &&
                  onSendWhatsApp(activeClient.id, activeEng.id, tpl.id, renderedPreview)
                }
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-success-strong hover:bg-success-strong disabled:opacity-45 text-on-primary px-4 py-2.5 text-xs font-medium transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Queue WhatsApp Reminder</span>
              </button>
            </div>
          </div>

          {/* Right: Recent WhatsApp Activity */}
          <div className="lg:col-span-7 rounded-xl border border-border bg-surface overflow-hidden">
            <div className="border-b border-border px-5 py-3.5 text-xs font-semibold text-text">
              Recent WhatsApp Conversations ({whatsappThreads.length})
            </div>
            <div className="divide-y divide-border">
              {whatsappThreads.map((wa) => {
                const c = clientsById[wa.clientId];
                return (
                  <div key={wa.id} className="p-4 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text">
                        {c?.name} ·{' '}
                        <span className="font-mono font-normal text-muted">{wa.contactPhone}</span>
                      </span>
                      <span className="font-mono text-[11px] text-muted">
                        {formatTimestampIST(wa.lastMessageAt)}
                      </span>
                    </div>
                    <p className="text-text-secondary leading-relaxed">{wa.preview}</p>
                    <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                      <span className="font-mono">{wa.templateUsed}</span>
                      <span
                        className={
                          wa.deliveryStatus === 'Queued'
                            ? 'text-warning font-medium'
                            : 'text-success font-medium'
                        }
                      >
                        {wa.direction === 'inbound' ? 'Inbound Reply' : wa.deliveryStatus}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {channelTab === 'voice' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Trigger AI Voice Call & Calendar Slot Sync */}
          <div className="lg:col-span-5 rounded-xl border border-border bg-surface p-5 space-y-4">
            <div className="border-b border-border pb-3">
              <div className="text-xs font-semibold text-text">Log a Call</div>
              <p className="text-[11px] text-muted mt-0.5">
                Record a call you made so the team sees it on the client&apos;s history. AI calling
                comes in phase 2.
              </p>
            </div>

            <form
              className="space-y-3 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                if (!activeClient || !activeEng) return;
                onLogCall({
                  clientId: activeClient.id,
                  engagementId: activeEng.id,
                  ownerId: activeEng.ownerId,
                  outcome,
                  durationSec: minutes ? Math.round(Number(minutes) * 60) : undefined,
                  bookedSlot: slot,
                  summary,
                });
                setMinutes('');
                setSlot('');
                setSummary('');
              }}
            >
              <div>
                <label className="block font-medium text-text-secondary mb-1">
                  Client / Engagement
                </label>
                <select
                  value={selectedEngId}
                  onChange={(e) => setSelectedEngId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                >
                  {open.map((e) => (
                    <option key={e.id} value={e.id}>
                      {clientsById[e.clientId]?.name} — {e.service || 'Service not set'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-text-secondary mb-1">Outcome</label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                  >
                    {CALL_OUTCOMES.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-text-secondary mb-1">Minutes</label>
                  <input
                    type="number"
                    min={0}
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-text"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-text-secondary mb-1">
                  Meeting booked for (optional)
                </label>
                <input
                  type="text"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  placeholder="e.g. 02-Oct-2026 11:30 IST"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                />
              </div>
              <div>
                <label className="block font-medium text-text-secondary mb-1">Summary</label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                />
              </div>
              <button
                type="submit"
                disabled={!activeEng}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-strong disabled:opacity-45 text-on-primary px-4 py-2.5 text-xs font-medium transition-colors"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>Save Call</span>
              </button>
            </form>
          </div>

          {/* Right: Call & Auto-Booking Log */}
          <div className="lg:col-span-7 rounded-xl border border-border bg-surface overflow-hidden">
            <div className="border-b border-border px-5 py-3.5 text-xs font-semibold text-text">
              Call Log ({voiceCalls.length})
            </div>
            <div className="divide-y divide-border">
              {voiceCalls.map((vc) => {
                const c = clientsById[vc.clientId];
                const o = membersById[vc.ownerId];
                return (
                  <div key={vc.id} className="p-4 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-text">
                        {c?.name} ·{' '}
                        <span className="font-normal text-muted">
                          Owner: {o?.name.split(' ')[0] ?? '—'}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-muted">
                        {formatTimestampIST(vc.calledAt)}
                        {vc.durationSec ? ` · ${Math.round(vc.durationSec / 60)} min` : ''}
                      </span>
                    </div>
                    <p className="text-text-secondary leading-relaxed">{vc.transcriptSummary}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                      <span className="font-medium text-success">{vc.outcome}</span>
                      {vc.bookedSlot && (
                        <span className="font-mono text-primary">Booked: {vc.bookedSlot}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
