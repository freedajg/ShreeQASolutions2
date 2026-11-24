import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Copy } from 'lucide-react';
import type { AppSettings, TeamMember } from '../types/crm';
import type { EmailSetupStatus } from '../data/actions';

interface Props {
  settings: AppSettings;
  teamMembers: TeamMember[];
  loadStatus: () => Promise<EmailSetupStatus | null>;
}

// What must be true before real emails go out (PRD FR-7). Each line says who does it.
// Real email still only ever leaves Drishti when a person presses Send.
export const EmailGoLiveChecklist: React.FC<Props> = ({ settings, teamMembers, loadStatus }) => {
  const [status, setStatus] = useState<EmailSetupStatus | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void loadStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, [loadStatus]);

  const owners = teamMembers.filter((m) => m.active && m.role !== 'Marketing');
  const connected = owners.filter((m) => m.outlookConnected);
  const server = status ?? null;

  const steps: { done: boolean; title: string; who: string; detail?: React.ReactNode }[] = [
    {
      done: settings.m365Provider !== 'unknown',
      title: 'Where Microsoft 365 was bought is recorded (Microsoft or GoDaddy)',
      who: 'Owner, below',
    },
    {
      done: Boolean(server?.microsoftAppSet),
      title: 'Drishti app registered in Microsoft Entra; its details saved on the server',
      who: 'Microsoft 365 admin + developer',
      detail: server && (
        <span>
          Redirect address to enter in Microsoft: <CopyText value={server.redirectUri} />
        </span>
      ),
    },
    {
      done: Boolean(server?.encryptionKeySet && server?.appOriginSet),
      title: 'Server secrets set (token encryption key, app address)',
      who: 'Developer',
    },
    {
      done: settings.m365AdminConsent,
      title: 'Admin consent granted once for the whole company',
      who: 'Microsoft 365 admin (Mahesh)',
    },
    {
      done: owners.length > 0 && connected.length === owners.length,
      title: `Each person who sends has connected their Outlook (${connected.length} of ${owners.length})`,
      who: 'Each owner, from My Profile & Outlook',
    },
    {
      done: !settings.emailTestMode,
      title: 'Test mode turned off (after one real test email)',
      who: 'Owner, below',
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-3 text-xs">
      <div>
        <h3 className="font-display text-sm font-semibold text-text">
          Real email: go-live checklist
        </h3>
        <p className="mt-0.5 text-muted">
          {settings.emailTestMode
            ? 'Test mode is on: Send records the email in Drishti but nothing is delivered.'
            : 'Real email is on: Send delivers from the Relationship Owner’s own Outlook.'}{' '}
          Either way, nothing is sent until a person presses Send.
        </p>
      </div>
      {status === undefined && <p className="text-muted">Checking the server…</p>}
      {status === null && (
        <p className="text-warning">
          The server functions aren’t reachable yet (not deployed), so the server steps show as not
          done.
        </p>
      )}
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-2.5">
            {s.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Done" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted" aria-label="Not done" />
            )}
            <div>
              <div className={s.done ? 'text-text' : 'text-text-secondary'}>
                {i + 1}. {s.title}
              </div>
              <div className="text-muted">Who: {s.who}</div>
              {s.detail && <div className="mt-0.5 text-muted">{s.detail}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

const CopyText: React.FC<{ value: string }> = ({ value }) => (
  <span className="inline-flex items-center gap-1">
    <code className="font-mono text-text-secondary break-all">{value}</code>
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(value)}
      aria-label="Copy"
      className="rounded p-0.5 text-muted hover:text-text"
    >
      <Copy className="h-3 w-3" />
    </button>
  </span>
);
