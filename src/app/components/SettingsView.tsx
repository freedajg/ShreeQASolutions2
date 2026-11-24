import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, Mail, Shield, UserPlus, Users } from 'lucide-react';
import { ActivityLogEntry, AppSettings, Role, TeamMember } from '../types/crm';
import { formatTimestampIST } from '../utils/formatters';
import { EmailGoLiveChecklist } from './EmailGoLiveChecklist';
import type { EmailSetupStatus } from '../data/actions';

interface SettingsViewProps {
  currentUser: TeamMember;
  teamMembers: TeamMember[];
  settings: AppSettings;
  activityLog: ActivityLogEntry[];
  onUpdateM365: (patch: {
    m365_provider?: string;
    m365_admin_consent?: boolean;
    email_test_mode?: boolean;
  }) => void;
  onToggleOutlookConnection: (memberId: string) => void;
  onChangeMemberRole: (memberId: string, role: Role) => void;
  onToggleConsultantValueAccess: (memberId: string) => void;
  onToggleMemberActive: (memberId: string) => void;
  onInviteMember: (name: string, email: string, role: Role) => void;
  /** Database column names of app_settings (Owners only; the database refuses anyone else). */
  onUpdateSettings: (patch: Record<string, unknown>) => void;
  onUpdateCycle: (
    code: string,
    surveillanceMonths: number | null,
    recertMonths: number | null,
  ) => void;
  /** Runs the retention cleanup now (Owners; it also runs monthly on its own). */
  onRunRetention: () => void;
  /** Server-side readiness for real email (go-live checklist). */
  loadEmailStatus: () => Promise<EmailSetupStatus | null>;
}

const monthsOrNull = (v: string) => (v.trim() === '' ? null : Math.max(1, Math.round(Number(v))));

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  teamMembers,
  settings,
  activityLog,
  onUpdateM365,
  onToggleOutlookConnection,
  onChangeMemberRole,
  onToggleConsultantValueAccess,
  onToggleMemberActive,
  onInviteMember,
  onUpdateSettings,
  onUpdateCycle,
  onRunRetention,
  loadEmailStatus,
}) => {
  const m365Provider = settings.m365Provider;
  const m365AdminConsentGranted = settings.m365AdminConsent;
  const [tab, setTab] = useState<'team' | 'outlook' | 'lists' | 'privacy' | 'audit'>('team');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('Consultant');
  const [auditFilter, setAuditFilter] = useState<string>('all');

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    onInviteMember(inviteName.trim(), inviteEmail.trim(), inviteRole);
    setInviteName('');
    setInviteEmail('');
  };

  const clientFacingMembers = teamMembers.filter((m) => m.active && m.role !== 'Marketing');
  const connectedMailboxesCount = clientFacingMembers.filter((m) => m.outlookConnected).length;

  const filteredLog = activityLog.filter((a) => auditFilter === 'all' || a.source === auditFilter);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="font-display text-xl font-semibold text-text">Settings, Team & Audit Log</h2>
        <p className="mt-1 text-sm text-muted">
          Manage invite-only team permissions, Microsoft 365 Outlook mailboxes, dropdown lists, DPDP
          retention, and activity history.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1 rounded-lg bg-raised p-1 w-fit border border-border">
          {[
            { id: 'team', label: 'Team & RBAC' },
            {
              id: 'outlook',
              label: `Outlook & M365 (${connectedMailboxesCount}/${clientFacingMembers.length})`,
            },
            { id: 'lists', label: 'Dropdowns & Cycles' },
            { id: 'privacy', label: 'DPDP & Retention' },
            { id: 'audit', label: `Audit Log (${activityLog.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'bg-surface text-text shadow-xs'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'team' && (
        <div className="space-y-6">
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] font-medium text-muted">
                  <th className="py-3 px-4">Team Member</th>
                  <th className="py-3 px-4">Role (FR-1)</th>
                  <th className="py-3 px-4">Outlook Mailbox</th>
                  <th className="py-3 px-4">MFA</th>
                  <th className="py-3 px-4">Contract Values (FR-9)</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teamMembers.map((m) => (
                  <tr key={m.id} className={!m.active ? 'opacity-55' : ''}>
                    <td className="py-3 px-4">
                      <div className="font-medium text-text">{m.name}</div>
                      <div className="text-[11px] text-muted font-mono">{m.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      {m.id === currentUser.id ? (
                        <span className="font-medium text-text">{m.role}</span>
                      ) : (
                        <select
                          value={m.role}
                          onChange={(e) => onChangeMemberRole(m.id, e.target.value as Role)}
                          aria-label={`Change role for ${m.name}`}
                          className="rounded-lg border border-border bg-bg px-2.5 py-1 text-xs text-text"
                        >
                          <option value="Owner/Admin">Owner/Admin</option>
                          <option value="Consultant">Consultant</option>
                          <option value="Marketing">Marketing</option>
                        </select>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {m.role === 'Marketing' ? (
                        <span className="text-muted">N/A</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggleOutlookConnection(m.id)}
                          className={`font-medium hover:underline ${
                            m.outlookConnected ? 'text-success' : 'text-warning'
                          }`}
                        >
                          {m.outlookConnected ? 'Connected' : 'Connect Outlook'}
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {m.mfaEnabled ? (
                        <span className="text-success font-medium">Required & Active</span>
                      ) : (
                        <span className="text-muted">Optional</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {m.role === 'Owner/Admin' && (
                        <span className="text-text-secondary">Always visible</span>
                      )}
                      {m.role === 'Marketing' && (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <Lock className="h-3 w-3" />
                          <span>Blocked by system</span>
                        </span>
                      )}
                      {m.role === 'Consultant' && (
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={m.canViewContractValues}
                            onChange={() => onToggleConsultantValueAccess(m.id)}
                            className="rounded border-border-strong"
                          />
                          <span className="text-text-secondary">
                            {m.canViewContractValues ? 'Enabled' : 'Hidden by default'}
                          </span>
                        </label>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {m.id !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => onToggleMemberActive(m.id)}
                          className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-bg"
                        >
                          {m.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Invite New Member */}
          <form
            onSubmit={handleInviteSubmit}
            className="rounded-xl border border-border bg-surface p-5 space-y-4"
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-text">
                <UserPlus className="h-4 w-4 text-primary" />
                <span>Invite a team member</span>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Only invited people can sign in. They get an email with a link to set their
                password, then sign in to Drishti with this email.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="block text-[11px] font-medium text-text-secondary">Full name</span>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  required
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] font-medium text-text-secondary">
                  Work email (their Outlook address)
                </span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@shreeqasolutions.com"
                  required
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] font-medium text-text-secondary">Role</span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text"
                >
                  <option value="Consultant">
                    Consultant: their own clients, no money figures
                  </option>
                  <option value="Marketing">Marketing: views clients, no money, can't send</option>
                  <option value="Owner/Admin">
                    Owner/Admin: everything, needs two-step sign-in
                  </option>
                </select>
              </label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted">
                Deactivated members can't sign in, but keep their past emails and notes under their
                name.
              </span>
              <button
                type="submit"
                className="rounded-lg bg-primary-strong hover:bg-primary-strong px-4 py-2 text-xs font-medium text-on-primary"
              >
                Send Invite
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Microsoft 365 & Outlook Connection Hub (§10 & §11 ⚠1 + FR-7) */}
      {tab === 'outlook' && (
        <div className="space-y-6">
          <EmailGoLiveChecklist
            settings={settings}
            teamMembers={teamMembers}
            loadStatus={loadEmailStatus}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Tenant-Level Admin Consent */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-4 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-text">
                    1. Microsoft 365 Tenant Admin Consent
                  </h3>
                  <p className="mt-0.5 text-muted">
                    Domain: <span className="font-mono">shreeqasolutions.com</span> · approved by
                    the Microsoft 365 admin
                  </p>
                </div>
                {m365AdminConsentGranted ? (
                  <span className="inline-flex items-center gap-1 text-success font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Granted</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-danger font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Pending</span>
                  </span>
                )}
              </div>

              <div>
                <label className="block font-medium text-text-secondary mb-1.5">
                  Where was Microsoft 365 purchased? (PRD §11 Open Question ⚠1)
                </label>
                <div className="inline-flex rounded-lg bg-raised p-1">
                  <button
                    type="button"
                    onClick={() => onUpdateM365({ m365_provider: 'microsoft' })}
                    className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                      m365Provider === 'microsoft'
                        ? 'bg-surface text-text shadow-xs'
                        : 'text-text-secondary'
                    }`}
                  >
                    Microsoft Direct
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateM365({ m365_provider: 'godaddy' })}
                    className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                      m365Provider === 'godaddy'
                        ? 'bg-surface text-text shadow-xs'
                        : 'text-text-secondary'
                    }`}
                  >
                    Via GoDaddy
                  </button>
                </div>
              </div>

              {m365Provider === 'godaddy' && (
                <div className="rounded-lg border border-warning-line bg-warning-wash p-3 text-warning">
                  GoDaddy M365 reseller panels can block third-party OAuth admin consent. Book 30
                  min with Mahesh to grant consent directly in Microsoft Entra ID.
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-muted">
                  The admin approves Drishti once in Microsoft Entra; record it here when done.
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateM365({ m365_admin_consent: !m365AdminConsentGranted })}
                  className="rounded-lg border border-border px-3 py-1.5 font-medium text-text-secondary hover:bg-bg"
                >
                  {m365AdminConsentGranted ? 'Mark as not granted' : 'Mark consent granted'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg p-3">
                <div>
                  <div className="font-medium text-text">Email test mode</div>
                  <div className="text-muted">
                    {settings.emailTestMode
                      ? 'On: sends are recorded in Drishti, nothing is delivered.'
                      : 'Off: emails are delivered from each owner’s Outlook.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateM365({ email_test_mode: !settings.emailTestMode })}
                  className="rounded-lg border border-border px-3 py-1.5 font-medium text-text-secondary hover:bg-surface whitespace-nowrap"
                >
                  {settings.emailTestMode ? 'Turn off (go live)' : 'Turn on test mode'}
                </button>
              </div>
            </div>

            {/* 2. Summary of How Many Outlooks */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-semibold text-text">
                  2. Connected Mailboxes: {connectedMailboxesCount} of {clientFacingMembers.length}
                </h3>
              </div>
              <p className="text-text-secondary leading-relaxed">
                Drishti connects{' '}
                <strong>each Relationship Owner’s individual Outlook mailbox</strong> (not a single
                shared inbox) so every follow-up goes out from the exact consultant or founder who
                held the call, in the same email thread.
              </p>
              <div className="rounded-lg border border-border bg-bg p-3 space-y-1">
                <div>
                  • <strong>Owners & Consultants ({clientFacingMembers.length})</strong>: 1 Outlook
                  connection each
                </div>
                <div>
                  •{' '}
                  <strong>
                    Marketing ({teamMembers.filter((m) => m.role === 'Marketing').length})
                  </strong>
                  : 0 Outlook connections (cannot send client emails)
                </div>
              </div>
            </div>
          </div>

          {/* Per-Member Mailbox Connection Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] font-medium text-muted">
                  <th className="py-3 px-4">Mailbox Owner</th>
                  <th className="py-3 px-4">Outlook Email</th>
                  <th className="py-3 px-4">Booking Link</th>
                  <th className="py-3 px-4">Connection Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clientFacingMembers.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 px-4 font-medium text-text">
                      {m.name} <span className="text-muted font-normal">({m.role})</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-text-secondary">{m.email}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-muted truncate max-w-[200px]">
                      {m.bookingLink || 'Not set'}
                    </td>
                    <td className="py-3 px-4">
                      {m.outlookConnected ? (
                        <span className="inline-flex items-center gap-1 text-success font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Connected</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-warning font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Not Connected</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        disabled={m.id !== currentUser.id}
                        title={
                          m.id !== currentUser.id
                            ? 'Each person connects their own mailbox'
                            : undefined
                        }
                        onClick={() => onToggleOutlookConnection(m.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                          m.outlookConnected
                            ? 'border border-border text-text-secondary hover:bg-bg'
                            : 'bg-primary-strong hover:bg-primary-strong text-on-primary'
                        }`}
                      >
                        {m.outlookConnected ? 'Disconnect' : 'Connect Mailbox'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'lists' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-text">
              Follow-up & Renewal Reminder Timing (FR-10)
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-text-secondary mb-1">
                  Lead Quiet Interval
                </label>
                <div className="inline-flex rounded-lg bg-raised p-1">
                  {([7, 15] as const).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => onUpdateSettings({ follow_up_interval_days: days })}
                      className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                        settings.followUpIntervalDays === days
                          ? 'bg-surface text-text shadow-xs'
                          : 'text-text-secondary'
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-text-secondary mb-1">
                  Maximum follow-ups per lead
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  defaultValue={settings.maxFollowUps}
                  onBlur={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (n >= 1 && n <= 10 && n !== settings.maxFollowUps)
                      onUpdateSettings({ max_follow_ups: n });
                  }}
                  className="w-24 rounded-lg border border-border bg-bg px-3 py-1.5 font-mono text-text"
                />
              </div>

              <div>
                <label className="block font-medium text-text-secondary mb-1">
                  Renewal Reminder Windows (days before due date)
                </label>
                <input
                  type="text"
                  defaultValue={settings.renewalReminderWindowsDays.join(', ')}
                  onBlur={(e) => {
                    const days = e.target.value
                      .split(',')
                      .map((d) => Math.round(Number(d.trim())))
                      .filter((d) => d > 0 && d <= 365);
                    if (days.length >= 1 && days.length <= 4)
                      onUpdateSettings({ renewal_windows_days: days });
                  }}
                  className="w-40 rounded-lg border border-border bg-bg px-3 py-1.5 font-mono text-text"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-text">
              Default Certification Cycles (FR-4)
            </h3>
            <p className="text-[11px] text-muted">
              Months. Used only when an engagement has no surveillance, next-audit or valid-to date
              (shown as “Estimated”).
            </p>
            <div className="divide-y divide-border text-xs">
              <div className="py-1.5 grid grid-cols-[1fr_6rem_6rem] gap-3 text-[11px] text-muted">
                <span>Type</span>
                <span>Surveillance</span>
                <span>Recertification</span>
              </div>
              {settings.services.map((code) => {
                const c = settings.serviceCycles[code];
                return (
                  <div
                    key={code}
                    className="py-1.5 grid grid-cols-[1fr_6rem_6rem] gap-3 items-center"
                  >
                    <span className="font-medium text-text">{code}</span>
                    {(['surveillanceMonths', 'recertMonths'] as const).map((field) => (
                      <input
                        key={field}
                        type="number"
                        min={1}
                        aria-label={`${code} ${field === 'surveillanceMonths' ? 'surveillance' : 'recertification'} months`}
                        defaultValue={c?.[field] ?? ''}
                        placeholder="—"
                        onBlur={(e) => {
                          const next = monthsOrNull(e.target.value);
                          if (next === (c?.[field] ?? null)) return;
                          onUpdateCycle(
                            code,
                            field === 'surveillanceMonths' ? next : (c?.surveillanceMonths ?? null),
                            field === 'recertMonths' ? next : (c?.recertMonths ?? null),
                          );
                        }}
                        className="w-full rounded-lg border border-border bg-bg px-2 py-1 font-mono text-text"
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-text">
              Excel Dropdown Lists (§6.3)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-medium text-muted mb-1">
                  Services / Certifications ({settings.services.length})
                </div>
                <p className="text-text leading-relaxed">{settings.services.join(' · ')}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-muted mb-1">Payment Statuses</div>
                  <p className="text-text">{settings.paymentStatuses.join(' · ')}</p>
                </div>
                <div>
                  <div className="font-medium text-muted mb-1">Lead Sources</div>
                  <p className="text-text">{settings.leadSources.join(' · ')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'privacy' && (
        <div className="rounded-xl border border-border bg-surface p-6 space-y-5">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display text-base font-semibold text-text">
                DPDP Act 2023 Compliance & Data Retention (§8)
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                Shree QA Solutions is the Data Fiduciary. Data is stored strictly in{' '}
                <span className="font-medium text-text">
                  {settings.retention.dataResidencyRegion}
                </span>
                . Real client data is never used for AI model training.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="rounded-lg border border-border p-4">
              <div className="text-muted">Closed / Lost Leads</div>
              <div className="mt-1 font-mono text-lg font-semibold text-text">
                {settings.retention.closedLeadsYears} years
              </div>
              <p className="mt-1 text-muted">
                Then contact details removed; company & counts retained.
              </p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="text-muted">Email Content</div>
              <div className="mt-1 font-mono text-lg font-semibold text-text">
                {settings.retention.emailContentYears} years
              </div>
              <p className="mt-1 text-muted">After engagement closes (dates retained).</p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="text-muted">Open Tracking Records</div>
              <div className="mt-1 font-mono text-lg font-semibold text-text">
                {settings.retention.openTrackingMonths} months
              </div>
              <p className="mt-1 text-muted">Applied automatically by monthly cleanup job.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-xs">
            <div>
              <div className="font-medium text-text">Run the cleanup now</div>
              <div className="text-muted">
                Removes contact details of closed leads, old email text and old open tracking, using
                the settings above. Every run is logged.
              </div>
            </div>
            <button
              type="button"
              onClick={onRunRetention}
              className="rounded-lg border border-border px-3 py-1.5 font-medium text-text-secondary hover:bg-bg"
            >
              Run cleanup
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-xs">
            <div>
              <div className="font-medium text-text">Drishti questions per person per day</div>
              <div className="text-muted">Keeps the AI cost predictable (PRD §8).</div>
            </div>
            <input
              type="number"
              min={0}
              max={500}
              aria-label="Drishti questions per person per day"
              defaultValue={settings.assistantDailyLimit}
              onBlur={(e) => {
                const n = Math.round(Number(e.target.value));
                if (n >= 0 && n <= 500) onUpdateSettings({ assistant_daily_limit: n });
              }}
              className="w-24 rounded-lg border border-border bg-bg px-3 py-1.5 font-mono text-text"
            />
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1 rounded-lg bg-raised p-1">
              {['all', 'manual', 'drishti', 'system', 'import'].map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setAuditFilter(src)}
                  className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    auditFilter === src ? 'bg-surface text-text shadow-xs' : 'text-text-secondary'
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted">
              <Users className="inline h-3.5 w-3.5 mr-1" />
              Permanent audit trail
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] font-medium text-muted">
                  <th className="py-2.5 px-4">Timestamp (IST)</th>
                  <th className="py-2.5 px-4">Actor & Source</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Target & Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLog.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2.5 px-4 font-mono text-muted whitespace-nowrap">
                      {formatTimestampIST(entry.timestamp)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-text">{entry.actorName}</span>
                      <span className="text-muted"> · </span>
                      <span
                        className={
                          entry.source === 'drishti' ? 'text-primary font-medium' : 'text-muted'
                        }
                      >
                        via {entry.source}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-text">{entry.action}</td>
                    <td className="py-2.5 px-4 text-text-secondary">
                      <span className="font-medium text-text">{entry.entityLabel}:</span>{' '}
                      {entry.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
