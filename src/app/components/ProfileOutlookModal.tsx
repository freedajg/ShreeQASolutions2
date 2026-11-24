import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, Mail, ShieldCheck, X } from 'lucide-react';
import { AppSettings, TeamMember } from '../types/crm';

interface ProfileOutlookModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: TeamMember;
  settings: AppSettings;
  onUpdateBookingLink: (bookingLink: string) => void;
  onToggleOutlookConnection: () => void;
}

// Each person connects only their own mailbox: Drishti never sends as someone else.
export const ProfileOutlookModal: React.FC<ProfileOutlookModalProps> = ({
  open,
  onClose,
  currentUser,
  settings,
  onUpdateBookingLink,
  onToggleOutlookConnection,
}) => {
  const [bookingInput, setBookingInput] = useState(currentUser.bookingLink);

  if (!open) return null;

  const consentPending = settings.m365Provider === 'godaddy' && !settings.m365AdminConsent;

  const handleSaveBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const link = bookingInput.trim();
    if (link && !link.startsWith('https://')) return;
    onUpdateBookingLink(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted hover:bg-raised"
          aria-label="Close profile modal"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Member Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-on-primary font-display text-sm font-semibold">
            {currentUser.initials}
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-text">{currentUser.name}</h2>
            <div className="text-xs text-muted">
              {currentUser.role} · <span className="font-mono">{currentUser.email}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-5 text-xs">
          {/* My Outlook Connection Card */}
          {currentUser.role === 'Marketing' ? (
            <div className="rounded-xl border border-border bg-bg p-4 text-text-secondary">
              <div className="font-semibold text-text">Outlook Connection Not Required</div>
              <p className="mt-1">
                Marketing users add and track leads only and do not send client follow-up emails
                (FR-9).
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-text">
                      Your Microsoft 365 / Outlook Mailbox
                    </div>
                    <div className="mt-0.5 text-muted">
                      Follow-ups for leads you own are sent strictly from{' '}
                      <span className="font-mono text-text-secondary">{currentUser.email}</span> in
                      the same email thread.
                    </div>
                  </div>
                </div>
                {currentUser.outlookConnected ? (
                  <span className="inline-flex items-center gap-1 text-success font-medium shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Connected</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-warning font-medium shrink-0">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Not Connected</span>
                  </span>
                )}
              </div>

              {consentPending && (
                <div className="rounded-lg border border-danger-line bg-danger-wash p-2.5 text-danger">
                  Microsoft 365 is managed through GoDaddy: the tenant admin must approve Drishti
                  before mailboxes can connect.
                </div>
              )}
              {settings.emailTestMode && (
                <div className="rounded-lg border border-warning-line bg-warning-wash p-2.5 text-warning">
                  Email test mode is on: sends are recorded in Drishti but nothing is delivered.
                </div>
              )}

              <div className="flex items-center justify-end pt-1">
                <button
                  type="button"
                  onClick={onToggleOutlookConnection}
                  className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
                    currentUser.outlookConnected
                      ? 'border border-border text-text-secondary hover:bg-bg'
                      : 'bg-primary-strong hover:bg-primary-strong text-on-primary'
                  }`}
                >
                  {currentUser.outlookConnected ? 'Disconnect Outlook' : 'Connect My Outlook'}
                </button>
              </div>
            </div>
          )}

          {/* Booking Link Form (FR-1 & FR-7) */}
          {currentUser.role !== 'Marketing' && (
            <form onSubmit={handleSaveBooking} className="space-y-2">
              <label className="flex items-center gap-1.5 font-medium text-text-secondary">
                <Link2 className="h-3.5 w-3.5 text-muted" />
                <span>Personal Booking Link (inserted into your follow-up drafts)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  pattern="https://.*"
                  title="Must start with https://"
                  value={bookingInput}
                  onChange={(e) => setBookingInput(e.target.value)}
                  placeholder="https://outlook.office.com/book/..."
                  className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 font-mono text-text"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-ink hover:bg-ink text-on-primary px-3.5 py-2 font-medium shrink-0"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {/* Architecture Explanation: How Many Outlooks? */}
          <div className="rounded-xl border border-border bg-bg/80 p-4 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-text">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>How Outlook Connections Work in SQAS</span>
            </div>
            <p className="text-text-secondary leading-relaxed">
              <strong>One Microsoft 365 tenant</strong> (one-time admin consent) and{' '}
              <strong>one mailbox connection per Relationship Owner</strong>. Every email goes out
              from the person who owns the engagement, in the same thread, never from a shared
              inbox. If the owner hasn&apos;t connected, Drishti asks them to connect instead of
              using another sender.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
