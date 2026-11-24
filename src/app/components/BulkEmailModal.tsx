import React, { useMemo, useState } from 'react';
import { AlertTriangle, Mail, Send, X } from 'lucide-react';
import type { AppSettings, Client, Engagement, TeamMember } from '../types/crm';
import { getStatusGroup } from '../utils/formatters';
import type { SendResult } from '../data/actions';

// One email or many (PRD FR-7 + the bulk email asked for on 24-Nov-2026).
// - Every email goes from the Relationship Owner of the client's engagement, from their own
//   mailbox, in the thread they already have (CLAUDE.md rule 4). Never from another sender.
// - Nothing is sent until the person presses Send here; "Save as drafts" sends nothing.
// - Skipped, with the reason shown: do-not-contact, no email, archived, no owner, or no
//   engagement this person may email (Consultants: only their own).

interface BulkEmailModalProps {
  clientIds: string[];
  currentUser: TeamMember;
  clientsById: Record<string, Client>;
  engagements: Engagement[];
  membersById: Record<string, TeamMember>;
  settings: AppSettings;
  onClose: () => void;
  onCreateBatch: (
    subject: string,
    body: string,
    filterSummary: string,
    total: number,
  ) => Promise<string>;
  onCreateDraft: (d: {
    engagementId: string;
    kind: 'manual' | 'bulk';
    subject: string;
    body: string;
    reason?: string;
    batchId?: string;
  }) => Promise<string>;
  onSend: (draftIds: string[]) => Promise<SendResult>;
  onDone: (message: string) => void;
}

interface Recipient {
  client: Client;
  engagement?: Engagement;
  owner?: TeamMember;
  skip?: string;
}

const FIELDS = ['{{first_name}}', '{{company}}', '{{certification}}', '{{owner_name}}'] as const;
const GROUP_ORDER = ['Sales pipeline', 'Paused', 'Active client', 'Delivery'];

function firstName(person: string) {
  return person.replace(/^(dr|mr|mrs|ms|miss|prof|col|capt)\.?\s+/i, '').split(/\s+/)[0] || 'there';
}

function fill(template: string, r: Recipient): string {
  return template
    .replace(/\{\{first_name\}\}/g, firstName(r.client.contactPerson))
    .replace(/\{\{company\}\}/g, r.client.name)
    .replace(
      /\{\{certification\}\}/g,
      r.engagement?.standardFramework || r.engagement?.service || 'certification',
    )
    .replace(/\{\{owner_name\}\}/g, r.owner?.name ?? '');
}

export const BulkEmailModal: React.FC<BulkEmailModalProps> = ({
  clientIds,
  currentUser,
  clientsById,
  engagements,
  membersById,
  settings,
  onClose,
  onCreateBatch,
  onCreateDraft,
  onSend,
  onDone,
}) => {
  const single = clientIds.length === 1;
  const [subject, setSubject] = useState(single ? '' : 'Update from Shree QA Solutions');
  const [body, setBody] = useState('Hi {{first_name}},\n\n\n\nRegards,\n{{owner_name}}');
  const [busy, setBusy] = useState<'idle' | 'saving' | 'sending'>('idle');
  const [problem, setProblem] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const recipients: Recipient[] = useMemo(
    () =>
      clientIds.map((id) => {
        const client = clientsById[id];
        if (client.doNotContact) return { client, skip: 'Do not contact' };
        if (!client.email) return { client, skip: 'No email address' };
        if (client.archived) return { client, skip: 'Archived' };
        const mine = engagements
          .filter((e) => e.clientId === id && !e.archived && e.status !== 'Closed')
          .filter((e) => currentUser.role === 'Owner/Admin' || e.ownerId === currentUser.id)
          .sort(
            (a, b) =>
              GROUP_ORDER.indexOf(getStatusGroup(a.status)) -
              GROUP_ORDER.indexOf(getStatusGroup(b.status)),
          );
        const engagement = mine.find((e) => e.ownerId) ?? mine[0];
        if (!engagement)
          return {
            client,
            skip: currentUser.role === 'Owner/Admin' ? 'No open engagement' : 'Not your engagement',
          };
        if (!engagement.ownerId)
          return { client, engagement, skip: 'Engagement has no Relationship Owner' };
        const owner = membersById[engagement.ownerId];
        if (!owner?.active)
          return { client, engagement, skip: 'Relationship Owner is deactivated' };
        if (!settings.emailTestMode && !owner.outlookConnected)
          return {
            client,
            engagement,
            owner,
            skip: `Connect mailbox: ${owner.name} hasn’t connected Outlook`,
          };
        return { client, engagement, owner };
      }),
    [clientIds, clientsById, engagements, membersById, currentUser, settings.emailTestMode],
  );
  const ready = recipients.filter((r) => !r.skip);
  const skipped = recipients.filter((r) => r.skip);
  const senders = [...new Set(ready.map((r) => r.owner!.email))];
  const preview = ready[Math.min(previewIndex, Math.max(ready.length - 1, 0))];

  const validate = () => {
    if (!subject.trim()) return 'Write a subject.';
    if (!body.trim()) return 'Write the message.';
    if (ready.length === 0) return 'None of the chosen clients can be emailed.';
    return null;
  };

  const createDrafts = async (): Promise<string[]> => {
    const batchId = single
      ? undefined
      : await onCreateBatch(
          subject,
          body,
          `${ready.length} of ${recipients.length} selected client(s)`,
          ready.length,
        );
    const ids: string[] = [];
    for (const r of ready) {
      ids.push(
        await onCreateDraft({
          engagementId: r.engagement!.id,
          kind: single ? 'manual' : 'bulk',
          subject: fill(subject, r),
          body: fill(body, r),
          reason: single ? 'Written by hand' : 'Bulk email',
          batchId,
        }),
      );
    }
    return ids;
  };

  const handleSaveDrafts = async () => {
    const v = validate();
    if (v) return setProblem(v);
    setBusy('saving');
    setProblem(null);
    try {
      const ids = await createDrafts();
      onDone(`${ids.length} draft(s) saved to Today for review. Nothing was sent.`);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Drafts could not be saved.');
      setBusy('idle');
    }
  };

  const handleSend = async () => {
    const v = validate();
    if (v) return setProblem(v);
    setBusy('sending');
    setProblem(null);
    try {
      const ids = await createDrafts();
      let sent = 0;
      let failed = 0;
      let testMode = settings.emailTestMode;
      const reasons = new Set<string>();
      for (let i = 0; i < ids.length; i += 200) {
        const res = await onSend(ids.slice(i, i + 200));
        testMode = res.testMode;
        for (const r of res.results) {
          if (r.status === 'sent') sent++;
          else {
            failed++;
            if (r.reason) reasons.add(r.reason);
          }
        }
      }
      onDone(
        `${sent} email(s) ${testMode ? 'recorded as sent (test mode: nothing delivered)' : 'sent'}` +
          (failed
            ? `; ${failed} failed and stay in Today (${[...reasons].slice(0, 2).join('; ')})`
            : '') +
          '.',
      );
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'The emails could not be sent.');
      setBusy('idle');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Email clients"
    >
      <div className="relative w-full max-w-4xl rounded-2xl border border-border bg-surface shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-text flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              {single
                ? `Email ${recipients[0]?.client.name}`
                : `Email ${recipients.length} clients`}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Each email goes from the client’s Relationship Owner’s own Outlook, in their existing
              thread
              {senders.length > 0 &&
                ` (${senders.length} sender${senders.length > 1 ? 's' : ''}: ${senders.join(', ')})`}
              .
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-raised"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 text-xs">
          <div className="space-y-3">
            {settings.emailTestMode && (
              <div className="rounded-lg border border-warning-line bg-warning-wash p-2.5 text-warning">
                Test mode is on: sends are recorded in Drishti but nothing is delivered.
              </div>
            )}
            <div>
              <label htmlFor="bulk-subject" className="block font-medium text-text-secondary mb-1">
                Subject
              </label>
              <input
                id="bulk-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={300}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              />
            </div>
            <div>
              <label htmlFor="bulk-body" className="block font-medium text-text-secondary mb-1">
                Message
              </label>
              <textarea
                id="bulk-body"
                rows={11}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={10000}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text leading-relaxed"
              />
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-muted">Insert:</span>
                {FIELDS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setBody((b) => `${b}${f}`)}
                    className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-secondary hover:bg-raised"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-bg p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-text">Preview</span>
                {ready.length > 1 && (
                  <select
                    aria-label="Preview recipient"
                    value={previewIndex}
                    onChange={(e) => setPreviewIndex(Number(e.target.value))}
                    className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] text-text"
                  >
                    {ready.map((r, i) => (
                      <option key={r.client.id} value={i}>
                        {r.client.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {preview ? (
                <>
                  <div className="text-muted">
                    From{' '}
                    <span className="font-mono text-text-secondary">{preview.owner?.email}</span> to{' '}
                    <span className="font-mono text-text-secondary">{preview.client.email}</span>
                  </div>
                  <div className="font-semibold text-text">
                    {fill(subject, preview) || '(no subject)'}
                  </div>
                  <div className="whitespace-pre-line leading-relaxed text-text-secondary">
                    {fill(body, preview)}
                  </div>
                </>
              ) : (
                <div className="text-muted">No client can be emailed.</div>
              )}
            </div>

            <div className="rounded-xl border border-border">
              <div className="border-b border-border px-3.5 py-2 font-medium text-text">
                {ready.length} will be emailed · {skipped.length} skipped
              </div>
              <ul className="max-h-48 overflow-y-auto divide-y divide-border">
                {recipients.map((r) => (
                  <li
                    key={r.client.id}
                    className="flex items-center justify-between gap-2 px-3.5 py-1.5"
                  >
                    <span className="truncate text-text">{r.client.name}</span>
                    {r.skip ? (
                      <span className="inline-flex items-center gap-1 text-warning shrink-0">
                        <AlertTriangle className="h-3 w-3" />
                        {r.skip}
                      </span>
                    ) : (
                      <span className="text-muted shrink-0">
                        from {r.owner?.name.split(' ')[0]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {problem && (
          <p role="alert" className="px-6 pb-2 text-xs text-danger">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 font-medium text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy !== 'idle' || ready.length === 0}
            onClick={() => void handleSaveDrafts()}
            className="rounded-lg border border-border px-4 py-2 font-medium text-text-secondary disabled:opacity-50"
          >
            {busy === 'saving' ? 'Saving…' : 'Save as drafts'}
          </button>
          <button
            type="button"
            disabled={busy !== 'idle' || ready.length === 0}
            onClick={() => void handleSend()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-strong px-4 py-2 font-medium text-on-primary disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {busy === 'sending'
              ? 'Sending…'
              : `Send ${ready.length} email${ready.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
};
