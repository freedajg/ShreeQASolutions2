import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  AlertTriangle,
  Clock,
  UserX,
  FileCheck,
  Mail,
  Trash2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCrm } from '../context/CrmContext';
import { computeBriefing } from '../utils/briefing';
import { formatINR } from '../utils/currency';
import { DrishtiFace } from './DrishtiFace';
import { ProposalDiff } from './ProposalDiffModal';

export function DrishtiView() {
  const {
    clients,
    leads,
    chatHistory,
    sendUserMessage,
    isAiLoading,
    activeUser,
    clearChat,
    applyProposal,
    discardProposal,
    openDraftModal,
  } = useCrm();

  const [inputVal, setInputVal] = useState('');
  const [briefingStage, setBriefingStage] = useState(0); // 0: greeting, 1: summary (~260ms), 2: cards (~900ms), 3: chips (~1500ms)
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute deterministic briefing
  const briefing = computeBriefing(clients, leads, activeUser.name);

  // Staged reveal on mount without scrolling the entire page
  useEffect(() => {
    const t1 = setTimeout(() => setBriefingStage(1), 260);
    const t2 = setTimeout(() => setBriefingStage(2), 900);
    const t3 = setTimeout(() => setBriefingStage(3), 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || isAiLoading) return;
    const msg = inputVal;
    setInputVal('');
    await sendUserMessage(msg);
  };

  const handleChipClick = async (chipText: string) => {
    if (isAiLoading) return;
    await sendUserMessage(chipText);
  };

  const handleCardClick = async (actionPrompt: string) => {
    if (isAiLoading) return;
    await sendUserMessage(actionPrompt);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12 space-y-6">
      {/* Hero / Drishti Identity Header */}
      <div className="bg-gradient-to-b from-raised/80 to-surface/90 border border-line/18 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
        {/* Ambient top light */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <DrishtiFace state={isAiLoading ? 'thinking' : 'idle'} size="lg" />

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                {briefing.greeting}
              </h1>
              <span className="text-xs font-medium text-muted tabular-nums">
                · {briefing.dateStr}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              <strong className="text-primary">Drishti</strong>: Your second pair of eyes on every
              renewal and every lead. Nothing is changed without your say-so.
            </p>

            {/* Reading records animation line */}
            <div className="flex items-center gap-2 pt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
              </span>
              <span className="text-xs text-teal font-medium">
                {briefingStage === 0
                  ? `Reading ${clients.length} client records and ${leads.length} pipeline leads...`
                  : briefing.summaryLine}
              </span>
            </div>
          </div>
        </div>

        {/* Staged Briefing Cards (Reveal at ~900ms) */}
        {briefingStage >= 2 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-300">
            {briefing.cards.map((card) => {
              const borderTheme =
                card.tagColor === 'rose'
                  ? 'border-danger/40 hover:border-danger bg-danger/5'
                  : card.tagColor === 'amber'
                    ? 'border-warning/40 hover:border-warning bg-warning/5'
                    : card.tagColor === 'cyan'
                      ? 'border-info/40 hover:border-info bg-info/5'
                      : 'border-primary/40 hover:border-primary bg-primary/5';

              const badgeTheme =
                card.tagColor === 'rose'
                  ? 'text-danger bg-danger/15'
                  : card.tagColor === 'amber'
                    ? 'text-warning bg-warning/15'
                    : card.tagColor === 'cyan'
                      ? 'text-info bg-info/15'
                      : 'text-primary bg-primary/15';

              return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card.actionPrompt)}
                  className={`text-left p-3.5 rounded-xl border transition-all duration-150 flex flex-col justify-between group active:scale-[0.98] ${borderTheme}`}
                >
                  <div className="space-y-1.5 w-full min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeTheme}`}
                      >
                        {card.tag}
                      </span>
                      {card.type === 'lapsed' && <ShieldAlert size={14} className="text-danger" />}
                      {card.type === 'due_soon' && <Clock size={14} className="text-warning" />}
                      {card.type === 'quiet_leads' && <UserX size={14} className="text-info" />}
                      {card.type === 'proposals_out' && (
                        <FileCheck size={14} className="text-primary" />
                      )}
                    </div>

                    <h4 className="text-xs font-semibold text-text group-hover:text-text-strong line-clamp-1">
                      {card.title}
                    </h4>

                    <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                      {card.detail}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-line/10 flex items-center justify-between text-[11px] text-muted group-hover:text-primary">
                    <span className="font-semibold">
                      {formatINR(card.valueAtStake, true)} at stake
                    </span>
                    <span>Ask Drishti &rarr;</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Suggested Question Chips (Reveal at ~1500ms) */}
        {briefingStage >= 3 && (
          <div className="mt-4 pt-3 border-t border-line/12 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none animate-in fade-in duration-300">
            <span className="text-[11px] font-semibold text-muted uppercase shrink-0">
              Suggestions:
            </span>
            {briefing.chips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleChipClick(chip)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs bg-surface hover:bg-raised text-text-secondary hover:text-text border border-line/18 hover:border-primary/40 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat Thread */}
      {chatHistory.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Consulting Conversation ({chatHistory.length} messages)
            </h3>
            <button
              onClick={clearChat}
              className="text-xs text-muted hover:text-danger flex items-center gap-1 transition-colors"
            >
              <Trash2 size={13} />
              <span>Clear History</span>
            </button>
          </div>

          <div className="space-y-4">
            {chatHistory.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  {isUser ? (
                    <div className="w-8 h-8 rounded-xl bg-raised border border-line/20 flex items-center justify-center font-bold text-xs text-primary shrink-0">
                      {activeUser.name[0]}
                    </div>
                  ) : (
                    <DrishtiFace
                      state={msg.isOffline ? 'offline' : 'idle'}
                      size="sm"
                      className="shrink-0 mt-1"
                    />
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-sm leading-relaxed shadow-md ${
                      isUser
                        ? 'bg-raised border border-line/25 text-text'
                        : msg.isOffline
                          ? 'bg-surface border-2 border-dashed border-line/20 text-text'
                          : 'bg-surface border border-line/18 text-text'
                    }`}
                  >
                    {/* Header Stamp */}
                    <div className="flex items-center justify-between gap-3 text-[11px] text-muted pb-2 mb-2 border-b border-line/10">
                      <span className="font-semibold text-primary">
                        {isUser ? activeUser.name : 'Drishti'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          msg.isOffline
                            ? 'bg-subtle text-text-secondary border border-dashed border-subtle-border'
                            : 'bg-primary-tint/15 text-primary-soft border border-primary-tint/20'
                        }`}
                      >
                        {msg.isOffline ? 'Answered offline, without a model' : msg.providerStamped}
                      </span>
                    </div>

                    {/* Content Markdown */}
                    <div className="prose prose-invert prose-sm max-w-none text-text [&_p]:my-2 [&_ul]:my-2 [&_li]:my-0.5 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-primary [&_strong]:text-info">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    </div>

                    {/* Tool Proposal Diff */}
                    {msg.proposal && (
                      <ProposalDiff
                        proposal={msg.proposal}
                        onApply={() => applyProposal(msg.id, msg.proposal!)}
                        onDiscard={() => discardProposal(msg.id)}
                      />
                    )}

                    {/* Derived Real Record Draft Action Buttons */}
                    {msg.suggestedDrafts && msg.suggestedDrafts.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-line/12 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-muted">
                          Action Available:
                        </span>
                        {msg.suggestedDrafts.map((d) => {
                          const targetEntity =
                            d.type === 'lead'
                              ? leads.find((l) => l.id === d.id)
                              : clients.find((c) => c.id === d.id);
                          if (!targetEntity) return null;

                          return (
                            <button
                              key={d.id}
                              onClick={() =>
                                openDraftModal({
                                  type: d.type,
                                  entity: targetEntity,
                                })
                              }
                              className="px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary-tint/20 to-violet/20 hover:from-primary-tint/30 hover:to-violet/30 text-text border border-primary-tint/30 flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <Mail size={13} className="text-primary-soft" />
                              <span>Draft for {d.company}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="sticky bottom-20 md:bottom-4 z-30 pt-2">
        <form
          onSubmit={handleSend}
          className="relative flex items-center bg-surface/95 backdrop-blur-md border border-line/22 rounded-2xl shadow-2xl p-1.5 focus-within:border-primary transition-colors"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isAiLoading}
            placeholder="Ask Drishti about renewals, quiet leads, or request a draft..."
            className="flex-1 px-4 py-3 bg-transparent text-base sm:text-sm text-text placeholder-muted focus:outline-none disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={!inputVal.trim() || isAiLoading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-teal hover:from-primary-soft hover:to-info text-on-primary font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
          >
            <Send size={15} />
            <span className="hidden sm:inline">Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
}
