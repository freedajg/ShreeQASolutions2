import React from 'react';
import { Check, Trash2, ArrowRight } from 'lucide-react';
import { ToolProposal } from '../types';

interface ProposalDiffProps {
  proposal: ToolProposal;
  onApply: () => void;
  onDiscard: () => void;
}

export function ProposalDiff({ proposal, onApply, onDiscard }: ProposalDiffProps) {
  const isApplied = proposal.applied;
  const isDiscarded = proposal.discarded;

  return (
    <div className="mt-3 p-3.5 bg-[#18213a]/90 border border-[rgba(148,175,235,0.25)] rounded-xl shadow-lg text-xs space-y-3 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-2 border-b border-[rgba(148,175,235,0.12)] pb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#818cf8]/20 text-[#818cf8] border border-[#818cf8]/30 uppercase">
            Proposed Update
          </span>
          <span className="font-semibold text-[#e9eefb] truncate">{proposal.targetName}</span>
        </div>
        <span className="text-[11px] text-[#6d7c9c]">{proposal.reason}</span>
      </div>

      {/* Field changes diff */}
      <div className="space-y-1.5 bg-[#111828] p-2.5 rounded-lg border border-[rgba(148,175,235,0.1)]">
        {Object.entries(proposal.changes).map(([field, newVal]) => (
          <div key={field} className="flex items-center justify-between text-xs py-0.5">
            <span className="font-mono text-[#9aabcc] text-[11px]">{field}:</span>
            <div className="flex items-center gap-2 font-mono">
              <ArrowRight size={12} className="text-[#818cf8]" />
              <span className="text-[#2dd4bf] font-semibold bg-[#2dd4bf]/10 px-1.5 py-0.5 rounded">
                {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {isApplied ? (
          <div className="flex items-center gap-1.5 text-xs text-[#2dd4bf] font-semibold bg-[#2dd4bf]/10 px-3 py-1.5 rounded-lg border border-[#2dd4bf]/20">
            <Check size={14} />
            <span>Applied to store</span>
          </div>
        ) : isDiscarded ? (
          <div className="flex items-center gap-1.5 text-xs text-[#fb7185] font-semibold bg-[#fb7185]/10 px-3 py-1.5 rounded-lg border border-[#fb7185]/20">
            <Trash2 size={14} />
            <span>Discarded</span>
          </div>
        ) : (
          <>
            <button
              onClick={onDiscard}
              className="px-3 py-1.5 rounded-lg bg-[#111828] hover:bg-[#18213a] text-[#9aabcc] hover:text-[#fb7185] border border-[rgba(148,175,235,0.15)] font-medium transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={13} />
              <span>Discard</span>
            </button>
            <button
              onClick={onApply}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#818cf8] to-[#2dd4bf] hover:from-[#a78bfa] hover:to-[#22d3ee] text-slate-950 font-bold shadow-md hover:shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>Apply to Store</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
