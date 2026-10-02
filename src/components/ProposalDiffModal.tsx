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
    <div className="mt-3 p-3.5 bg-raised/90 border border-line/25 rounded-xl shadow-lg text-xs space-y-3 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-2 border-b border-line/12 pb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 uppercase">
            Proposed Update
          </span>
          <span className="font-semibold text-text truncate">{proposal.targetName}</span>
        </div>
        <span className="text-[11px] text-muted">{proposal.reason}</span>
      </div>

      {/* Field changes diff */}
      <div className="space-y-1.5 bg-surface p-2.5 rounded-lg border border-line/10">
        {Object.entries(proposal.changes).map(([field, newVal]) => (
          <div key={field} className="flex items-center justify-between text-xs py-0.5">
            <span className="font-mono text-text-secondary text-[11px]">{field}:</span>
            <div className="flex items-center gap-2 font-mono">
              <ArrowRight size={12} className="text-primary" />
              <span className="text-teal font-semibold bg-teal/10 px-1.5 py-0.5 rounded">
                {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {isApplied ? (
          <div className="flex items-center gap-1.5 text-xs text-teal font-semibold bg-teal/10 px-3 py-1.5 rounded-lg border border-teal/20">
            <Check size={14} />
            <span>Applied to store</span>
          </div>
        ) : isDiscarded ? (
          <div className="flex items-center gap-1.5 text-xs text-danger font-semibold bg-danger/10 px-3 py-1.5 rounded-lg border border-danger/20">
            <Trash2 size={14} />
            <span>Discarded</span>
          </div>
        ) : (
          <>
            <button
              onClick={onDiscard}
              className="px-3 py-1.5 rounded-lg bg-surface hover:bg-raised text-text-secondary hover:text-danger border border-line/15 font-medium transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={13} />
              <span>Discard</span>
            </button>
            <button
              onClick={onApply}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-primary to-teal hover:from-primary-soft hover:to-info text-on-primary font-bold shadow-md hover:shadow-primary-tint/20 active:scale-[0.98] transition-all flex items-center gap-1.5"
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
