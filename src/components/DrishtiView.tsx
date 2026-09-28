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
      <div className="bg-gradient-to-b from-[#18213a]/80 to-[#111828]/90 border border-[rgba(148,175,235,0.18)] rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
        {/* Ambient top light */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[#818cf8]/40 to-transparent" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <DrishtiFace state={isAiLoading ? 'thinking' : 'idle'} size="lg" />

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#e9eefb]">
                {briefing.greeting}
              </h1>
              <span className="text-xs font-medium text-[#6d7c9c] tabular-nums">
                · {briefing.dateStr}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#9aabcc] leading-relaxed">
              <strong className="text-[#818cf8]">Drishti</strong>: Your second pair of eyes on every
              renewal and every lead. Nothing is changed without your say-so.
            </p>

            {/* Reading records animation line */}
            <div className="flex items-center gap-2 pt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2dd4bf] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2dd4bf]" />
              </span>
              <span className="text-xs text-[#2dd4bf] font-medium">
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
                  ? 'border-[#fb7185]/40 hover:border-[#fb7185] bg-[#fb7185]/5'
                  : card.tagColor === 'amber'
                  ? 'border-[#fbbf24]/40 hover:border-[#fbbf24] bg-[#fbbf24]/5'
                  : card.tagColor === 'cyan'
                  ? 'border-[#22d3ee]/40 hover:border-[#22d3ee] bg-[#22d3ee]/5'
                  : 'border-[#818cf8]/40 hover:border-[#818cf8] bg-[#818cf8]/5';

              const badgeTheme =
                card.tagColor === 'rose'
                  ? 'text-[#fb7185] bg-[#fb7185]/15'
                  : card.tagColor === 'amber'
                  ? 'text-[#fbbf24] bg-[#fbbf24]/15'
                  : card.tagColor === 'cyan'
                  ? 'text-[#22d3ee] bg-[#22d3ee]/15'
                  : 'text-[#818cf8] bg-[#818cf8]/15';

              return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card.actionPrompt)}
                  className={`text-left p-3.5 rounded-xl border transition-all duration-150 flex flex-col justify-between group active:scale-[0.98] ${borderTheme}`}
                >
                  <div className="space-y-1.5 w-full min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeTheme}`}>
                        {card.tag}
                      </span>
                      {card.type === 'lapsed' && <ShieldAlert size={14} className="text-[#fb7185]" />}
                      {card.type === 'due_soon' && <Clock size={14} className="text-[#fbbf24]" />}
                      {card.type === 'quiet_leads' && <UserX size={14} className="text-[#22d3ee]" />}
                      {card.type === 'proposals_out' && <FileCheck size={14} className="text-[#818cf8]" />}
                    </div>

                    <h4 className="text-xs font-semibold text-[#e9eefb] group-hover:text-white line-clamp-1">
                      {card.title}
                    </h4>

                    <p className="text-[11px] text-[#9aabcc] line-clamp-2 leading-relaxed">
                      {card.detail}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[rgba(148,175,235,0.1)] flex items-center justify-between text-[11px] text-[#6d7c9c] group-hover:text-[#818cf8]">
                    <span className="font-semibold">{formatINR(card.valueAtStake, true)} at stake</span>
                    <span>Ask Drishti &rarr;</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Suggested Question Chips (Reveal at ~1500ms) */}
        {briefingStage >= 3 && (
          <div className="mt-4 pt-3 border-t border-[rgba(148,175,235,0.12)] flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none animate-in fade-in duration-300">
            <span className="text-[11px] font-semibold text-[#6d7c9c] uppercase shrink-0">
              Suggestions:
            </span>
            {briefing.chips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleChipClick(chip)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs bg-[#111828] hover:bg-[#18213a] text-[#9aabcc] hover:text-[#e9eefb] border border-[rgba(148,175,235,0.18)] hover:border-[#818cf8]/40 transition-colors"
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
            <h3 className="text-xs font-semibold text-[#6d7c9c] uppercase tracking-wider">
              Consulting Conversation ({chatHistory.length} messages)
            </h3>
            <button
              onClick={clearChat}
              className="text-xs text-[#6d7c9c] hover:text-[#fb7185] flex items-center gap-1 transition-colors"
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
                  className={`flex items-start gap-3 ${
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  {isUser ? (
                    <div className="w-8 h-8 rounded-xl bg-[#18213a] border border-[rgba(148,175,235,0.2)] flex items-center justify-center font-bold text-xs text-[#818cf8] shrink-0">
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
                        ? 'bg-[#18213a] border border-[rgba(148,175,235,0.25)] text-[#e9eefb]'
                        : msg.isOffline
                        ? 'bg-[#111828] border-2 border-dashed border-[rgba(148,175,235,0.2)] text-[#e9eefb]'
                        : 'bg-[#111828] border border-[rgba(148,175,235,0.18)] text-[#e9eefb]'
                    }`}
                  >
                    {/* Header Stamp */}
                    <div className="flex items-center justify-between gap-3 text-[11px] text-[#6d7c9c] pb-2 mb-2 border-b border-[rgba(148,175,235,0.1)]">
                      <span className="font-semibold text-[#818cf8]">
                        {isUser ? activeUser.name : 'Drishti'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          msg.isOffline
                            ? 'bg-slate-800 text-[#9aabcc] border border-dashed border-slate-700'
                            : 'bg-indigo-500/15 text-[#a78bfa] border border-indigo-500/20'
                        }`}
                      >
                        {msg.isOffline
                          ? 'Answered offline, without a model'
                          : msg.providerStamped}
                      </span>
                    </div>

                    {/* Content Markdown */}
                    <div className="prose prose-invert prose-sm max-w-none text-[#e9eefb] [&_p]:my-2 [&_ul]:my-2 [&_li]:my-0.5 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-[#818cf8] [&_strong]:text-[#22d3ee]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.text}
                      </ReactMarkdown>
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
                      <div className="mt-3 pt-2.5 border-t border-[rgba(148,175,235,0.12)] flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-[#6d7c9c]">
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
                              className="px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-500/20 to-violet-500/20 hover:from-indigo-500/30 hover:to-violet-500/30 text-[#e9eefb] border border-indigo-500/30 flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <Mail size={13} className="text-[#a78bfa]" />
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
          className="relative flex items-center bg-[#111828]/95 backdrop-blur-md border border-[rgba(148,175,235,0.22)] rounded-2xl shadow-2xl p-1.5 focus-within:border-[#818cf8] transition-colors"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isAiLoading}
            placeholder="Ask Drishti about renewals, quiet leads, or request a draft..."
            className="flex-1 px-4 py-3 bg-transparent text-base sm:text-sm text-[#e9eefb] placeholder-[#6d7c9c] focus:outline-none disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={!inputVal.trim() || isAiLoading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#818cf8] to-[#2dd4bf] hover:from-[#a78bfa] hover:to-[#22d3ee] text-slate-950 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
          >
            <Send size={15} />
            <span className="hidden sm:inline">Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
}
