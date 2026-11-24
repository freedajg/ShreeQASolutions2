import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Maximize2, Minimize2, Send, Sparkles, X } from 'lucide-react';
import { TeamMember } from '../types/crm';
import { formatDateDDMMMYYYY } from '../utils/formatters';

// Drishti never changes data by itself (PRD FR-11): the server answers and proposes; a person
// clicks Apply, which runs apply_drishti_proposal() and is logged "via Drishti".
type Changes = {
  status?: string;
  next_follow_up_on?: string;
  note_summary?: string;
  note_next_step?: string;
};

interface ServerProposal {
  engagementId: string;
  clientName: string;
  summary: string;
  changes: Changes;
  before: { status: string | null; next_follow_up_on: string | null };
}

interface AskResult {
  answer: string;
  source: 'gemini' | 'rules';
  proposals: ServerProposal[];
}

interface ProposalCard extends ServerProposal {
  state: 'ready' | 'applying' | 'applied';
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'drishti';
  text: string;
  proposals?: ProposalCard[];
}

interface DrishtiAssistantDrawerProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  currentUser: TeamMember;
  onAsk: (question: string) => Promise<AskResult>;
  onApplyProposal: (engagementId: string, changes: Changes) => Promise<boolean>;
}

function rows(p: ServerProposal): { field: string; from: string; to: string }[] {
  const out: { field: string; from: string; to: string }[] = [];
  if (p.changes.status)
    out.push({ field: 'Stage (Col O)', from: p.before.status ?? '—', to: p.changes.status });
  if (p.changes.next_follow_up_on)
    out.push({
      field: 'Next Follow-up',
      from: formatDateDDMMMYYYY(p.before.next_follow_up_on ?? undefined),
      to: formatDateDDMMMYYYY(p.changes.next_follow_up_on),
    });
  if (p.changes.note_summary)
    out.push({ field: 'Meeting Note', from: '—', to: p.changes.note_summary });
  if (p.changes.note_next_step)
    out.push({ field: 'Next Step', from: '—', to: p.changes.note_next_step });
  return out;
}

export const DrishtiAssistantDrawer: React.FC<DrishtiAssistantDrawerProps> = ({
  open,
  onToggle,
  onClose,
  currentUser,
  onAsk,
  onApplyProposal,
}) => {
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-welcome',
      sender: 'drishti',
      text: `Hi ${currentUser.name.split(' ')[0]} — ask about overdue renewals, quiet leads, or a client, or tell me about a meeting and I'll propose the update for you to apply.`,
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || busy) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, sender: 'user', text: query }]);
    if (!textToSend) setInput('');
    setBusy(true);
    try {
      const res = await onAsk(query);
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          sender: 'drishti',
          text:
            res.answer +
            (res.source === 'rules' ? '\n\n(Basic answers only: the AI model is offline.)' : ''),
          proposals: res.proposals.map((p) => ({ ...p, state: 'ready' as const })),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          sender: 'drishti',
          text: e instanceof Error ? e.message : 'Drishti is unavailable.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const setCardState = (msgId: string, index: number, state: ProposalCard['state']) =>
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.proposals
          ? { ...m, proposals: m.proposals.map((p, i) => (i === index ? { ...p, state } : p)) }
          : m,
      ),
    );

  const handleApplyCard = async (msgId: string, index: number, proposal: ProposalCard) => {
    setCardState(msgId, index, 'applying');
    const ok = await onApplyProposal(proposal.engagementId, proposal.changes);
    setCardState(msgId, index, ok ? 'applied' : 'ready');
  };

  return (
    <>
      {/* Bottom-Right Anchored Popup Window */}
      {open && (
        <section
          aria-label="Drishti Assistant Popup"
          className={`fixed bottom-20 right-4 sm:right-6 z-50 flex flex-col rounded-2xl border border-border bg-surface shadow-2xl shadow-backdrop/15 overflow-hidden transition-all duration-150 ${
            expanded
              ? 'w-[calc(100vw-2rem)] sm:w-[480px] h-[640px] max-h-[82vh]'
              : 'w-[calc(100vw-2rem)] sm:w-[390px] h-[510px] max-h-[76vh]'
          }`}
        >
          {/* Compact Popup Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-bg/70">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-strong text-on-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-xs font-semibold text-text">
                  Drishti Assistant
                </div>
                <div className="text-[11px] text-muted truncate">
                  {currentUser.role} scope · Proposals only, you apply
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="hidden sm:inline-flex rounded-md p-1.5 text-muted hover:bg-raised/60 hover:text-text-secondary"
                aria-label={expanded ? 'Compact size' : 'Expand size'}
              >
                {expanded ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-muted hover:bg-raised/60 hover:text-text-secondary"
                aria-label="Close Drishti popup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Prompt Chips */}
          <div className="border-b border-border px-3.5 py-2 flex items-center gap-1.5 overflow-x-auto">
            {[
              { label: 'Overdue renewals', prompt: 'Which renewals are overdue?' },
              { label: 'Quiet leads', prompt: 'Which leads have gone quiet?' },
              { label: 'Due this month', prompt: 'Which renewals are due in the next 30 days?' },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={busy}
                onClick={() => void handleSend(item.prompt)}
                className="rounded-md border border-border bg-bg px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-raised whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Conversation Feed */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3.5 space-y-3"
            aria-live="polite"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                    m.sender === 'user'
                      ? 'bg-primary-strong text-on-primary'
                      : 'border border-border bg-bg text-text'
                  }`}
                >
                  {m.text}
                </div>

                {m.proposals?.map((p, index) => (
                  <div
                    key={`${p.engagementId}-${index}`}
                    className="mt-2 w-full rounded-xl border border-primary-line bg-surface p-3 text-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-semibold text-text">{p.clientName}</span>
                      <span className="font-mono text-[10px] text-primary">via Drishti</span>
                    </div>
                    {p.summary && <p className="text-[11px] text-text-secondary">{p.summary}</p>}

                    <div className="divide-y divide-border">
                      {rows(p).map((c) => (
                        <div
                          key={c.field}
                          className="py-1.5 flex items-start justify-between gap-2 text-[11px]"
                        >
                          <span className="text-muted shrink-0">{c.field}</span>
                          <span className="text-right font-medium text-text">
                            <span className="text-muted line-through mr-1">{c.from}</span>
                            <ArrowRight className="inline h-3 w-3 text-muted mr-1" />
                            <span>{c.to}</span>
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-0.5">
                      {p.state === 'applied' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-success font-medium">
                          <Check className="h-3.5 w-3.5" />
                          <span>Applied & logged</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={p.state === 'applying'}
                          onClick={() => void handleApplyCard(m.id, index, p)}
                          className="rounded-lg bg-primary-strong px-3 py-1.5 text-[11px] font-medium text-on-primary transition-colors disabled:opacity-60"
                        >
                          {p.state === 'applying' ? 'Applying…' : 'Apply Changes'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {busy && <div className="text-[11px] text-muted">Drishti is thinking…</div>}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="border-t border-border p-2.5 flex items-center gap-2 bg-surface"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="Ask Drishti or describe a meeting..."
              aria-label="Message Drishti"
              className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-strong text-on-primary shrink-0 transition-colors disabled:opacity-60"
              aria-label="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </section>
      )}

      {/* Bottom-Right Floating Launcher Button */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? 'Close Drishti assistant' : 'Open Drishti assistant'}
        className="fixed bottom-5 right-4 sm:right-6 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-ink text-on-primary px-4 py-2.5 text-xs font-semibold shadow-lg shadow-backdrop/20 transition-transform active:scale-95"
      >
        {open ? (
          <>
            <X className="h-4 w-4" />
            <span>Close</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            <span>Drishti</span>
          </>
        )}
      </button>
    </>
  );
};
