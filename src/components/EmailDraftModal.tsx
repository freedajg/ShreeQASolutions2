import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Send,
  Mail,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Client, Lead } from '../types';
import { useCrm } from '../context/CrmContext';
import { generateDraftEmailOffline } from '../utils/localAiEngine';
import { sanitizeModelOutput } from '../utils/sanitizer';

interface EmailDraftModalProps {
  target: {
    type: 'lead' | 'client';
    entity: Lead | Client;
  };
  onClose: () => void;
}

export function EmailDraftModal({ target, onClose }: EmailDraftModalProps) {
  const { entity, type } = target;
  const isLead = type === 'lead';
  const leadEntity = isLead ? (entity as Lead) : null;
  const clientEntity = !isLead ? (entity as Client) : null;

  const { logEmailSent } = useCrm();

  const [recipientEmail, setRecipientEmail] = useState(entity.email || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Generate initial draft using the strict first-person formula
  useEffect(() => {
    setRecipientEmail(entity.email || '');
    const standard =
      leadEntity?.serviceInterest || clientEntity?.service || 'Process Certification';
    const subj = isLead
      ? `Following up on our ${standard} assessment discussion - ${entity.company}`
      : `Upcoming ${standard} renewal schedule - ${entity.company}`;
    setSubject(subj);

    const generated = generateDraftEmailOffline({
      company: entity.company,
      contactName: entity.contactName,
      owner: entity.owner,
      meetingContext: leadEntity?.meetingContext || '',
      notes: clientEntity?.notes || '',
      service: clientEntity?.service,
      serviceInterest: leadEntity?.serviceInterest,
    });

    setBody(sanitizeModelOutput(generated));
  }, [entity, isLead, leadEntity, clientEntity]);

  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;

  const handleCopy = async () => {
    const fullText = `To: ${recipientEmail}\nSubject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleSend = () => {
    const cleanEmail = recipientEmail.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter a recipient email address.');
      return;
    }
    setErrorMessage(null);

    // Build the mailto link with encoded recipient, subject, and body
    const mailtoUrl = `mailto:${encodeURIComponent(cleanEmail)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;

    // Dispatch via temporary link to trigger the user's default email client
    const mailLink = document.createElement('a');
    mailLink.href = mailtoUrl;
    mailLink.target = '_blank';
    mailLink.rel = 'noopener noreferrer';
    document.body.appendChild(mailLink);
    mailLink.click();
    document.body.removeChild(mailLink);

    // Automatically record activity note & update last contact date in CRM
    logEmailSent({ type, id: entity.id }, subject, cleanEmail);

    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
    }, 4500);
  };

  const handleRegenerate = () => {
    const generated = generateDraftEmailOffline({
      company: entity.company,
      contactName: entity.contactName,
      owner: entity.owner,
      meetingContext: leadEntity?.meetingContext || '',
      notes: clientEntity?.notes || '',
      service: clientEntity?.service,
      serviceInterest: leadEntity?.serviceInterest,
    });
    setBody(sanitizeModelOutput(generated));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-backdrop/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line/22 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-line/14 flex items-center justify-between bg-raised/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-tint/30 to-violet/30 border border-primary-tint/40 flex items-center justify-center text-primary-soft">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-text">Follow-Up: {entity.company}</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-raised text-teal border border-teal/20 flex items-center gap-1">
                  <Mail size={11} />
                  Ready to Send
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Prepared for <strong className="text-text">{entity.owner}</strong> to send to{' '}
                <strong className="text-text">{entity.contactName}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-text-strong hover:bg-raised transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Guidance Notice Banner */}
        <div className="px-4 py-2.5 bg-bg/60 border-b border-line/10 flex items-start gap-2.5 text-xs text-text-secondary">
          <AlertCircle size={15} className="text-primary shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span>
              Clicking <strong className="text-teal">Send Email</strong> opens your default email
              client with recipient and draft pre-filled, advances the last contact date to today,
              and logs an activity record in your CRM.
            </span>
          </div>
        </div>

        {/* Success Confirmation Banner */}
        {sentSuccess && (
          <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-success-strong/10 border border-success-strong/30 text-xs text-success-light flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-success shrink-0" />
              <span>
                <strong>Mail dispatched!</strong> Activity note logged and contact date updated for{' '}
                {entity.company}.
              </span>
            </div>
            <button
              onClick={() => setSentSuccess(false)}
              className="text-success hover:text-success-lighter text-[11px] font-medium underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-4 mt-3 px-3.5 py-2 rounded-xl bg-danger-strong/10 border border-danger-strong/30 text-xs text-danger-light flex items-center gap-2">
            <AlertCircle size={15} className="text-danger-medium shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Recipient Field */}
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
              Recipient Email (To:)
            </label>
            <div className="relative">
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="contact@company.com"
                className="w-full px-3.5 py-2 rounded-xl bg-bg border border-line/18 text-sm text-text focus:outline-none focus:border-primary transition-colors"
              />
              <span className="absolute right-3 top-2.5 text-xs text-text-secondary/70">
                {entity.contactName}
              </span>
            </div>
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line/18 text-sm text-text focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Body Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                Email Body (First-Person, Concise)
              </label>
              <span
                className={`text-[11px] font-mono tabular-nums ${
                  wordCount <= 110 ? 'text-teal' : 'text-warning'
                }`}
              >
                {wordCount} / 110 words
              </span>
            </div>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-bg border border-line/18 text-sm text-text font-sans leading-relaxed focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          {/* Internal meeting context reference */}
          {leadEntity?.meetingContext && (
            <div className="p-3 rounded-xl bg-raised/50 border border-line/10 text-xs">
              <span className="text-[11px] font-semibold text-muted block mb-1">
                Internal CRM Meeting Context (Reference Only):
              </span>
              <p className="text-text-secondary italic">"{leadEntity.meetingContext}"</p>
            </div>
          )}

          {/* Client notes reference if present */}
          {clientEntity?.notes && !leadEntity && (
            <div className="p-3 rounded-xl bg-raised/50 border border-line/10 text-xs">
              <span className="text-[11px] font-semibold text-muted block mb-1">
                Account Notes (Reference Only):
              </span>
              <p className="text-text-secondary italic">"{clientEntity.notes}"</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-line/14 bg-raised/40 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleRegenerate}
            className="px-3 py-2 rounded-xl text-xs font-medium text-text-secondary hover:text-text hover:bg-raised transition-colors flex items-center gap-1.5"
            title="Reset and regenerate draft"
          >
            <RefreshCw size={13} />
            <span>Reset Draft</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-strong hover:bg-raised transition-colors"
            >
              Close
            </button>

            {/* Secondary Action: Copy Draft */}
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-raised hover:bg-overlay text-text border border-line/22 active:scale-[0.98] transition-all flex items-center gap-2"
              title="Copy subject and body to clipboard"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-teal" />
                  <span className="text-teal">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} className="text-text-secondary" />
                  <span>Copy Draft</span>
                </>
              )}
            </button>

            {/* Primary Action: Send Email */}
            <button
              onClick={handleSend}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-on-primary shadow-md active:scale-[0.98] transition-all flex items-center gap-2 ${
                sentSuccess
                  ? 'bg-success hover:bg-success-light text-on-success'
                  : 'bg-gradient-to-r from-primary via-primary-strong to-teal hover:from-primary-soft hover:to-info shadow-primary-tint/25'
              }`}
              title="Launch default email app and record CRM touchpoint"
            >
              {sentSuccess ? (
                <>
                  <Check size={15} />
                  <span>Sent & Logged!</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Send Email</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
