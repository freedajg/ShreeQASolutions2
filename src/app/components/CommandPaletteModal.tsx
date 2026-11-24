import React, { useMemo, useState } from 'react';
import { ArrowRight, Building2, Search, X } from 'lucide-react';
import { AppView, Client, Engagement, TeamMember } from '../types/crm';
import { canSeeEngagement } from '../utils/formatters';
import { OUTREACH_LABEL } from '../features';

interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: TeamMember;
  clients: Client[];
  engagements: Engagement[];
  onNavigate: (view: AppView) => void;
  onOpenClient: (clientId: string, engagementId?: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  open,
  onClose,
  currentUser,
  clients,
  engagements,
  onNavigate,
  onOpenClient,
}) => {
  const [query, setQuery] = useState('');

  const isMarketing = currentUser.role === 'Marketing';
  const isAdmin = currentUser.role === 'Owner/Admin';

  const quickViews: { id: AppView; label: string; group: string; hidden?: boolean }[] = [
    { id: 'today', label: 'Today Queue — Draft Approvals', group: 'Screens', hidden: isMarketing },
    { id: 'dashboard', label: 'Executive Dashboard', group: 'Screens' },
    { id: 'radar', label: 'Renewal Radar', group: 'Screens', hidden: isMarketing },
    { id: 'pipeline', label: 'Sales Pipeline Board', group: 'Screens' },
    { id: 'outreach', label: OUTREACH_LABEL, group: 'Screens', hidden: isMarketing },
    { id: 'webcapture', label: 'Website Lead-Capture Form', group: 'Phase 2' },
    {
      id: 'delivery',
      label: 'Delivery Checklists & Gap Analysis',
      group: 'Screens',
      hidden: isMarketing,
    },
    {
      id: 'invoicing',
      label: 'Invoicing',
      group: 'Phase 2',
      hidden: !isAdmin && !currentUser.canViewContractValues,
    },
    { id: 'clients', label: 'Clients & 30-Col Database', group: 'Screens' },
    { id: 'import', label: 'Excel Import & Flag Report', group: 'Admin', hidden: !isAdmin },
    { id: 'settings', label: 'Settings, Team & Audit Log', group: 'Admin', hidden: !isAdmin },
  ];

  const q0 = query.trim().toLowerCase();
  const matchingViews = quickViews.filter(
    (v) =>
      !v.hidden &&
      (!q0 || v.label.toLowerCase().includes(q0) || v.group.toLowerCase().includes(q0)),
  );

  const matchingClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => {
        const hasVisibleEng = engagements.some(
          (e) => e.clientId === c.id && canSeeEngagement(currentUser, e),
        );
        if (!hasVisibleEng) return false;
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.contactPerson.toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [clients, engagements, currentUser, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-backdrop/55 pt-[12vh] p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to screen, client, or certification..."
            className="flex-1 bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-raised"
            aria-label="Close quick jump"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {matchingClients.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[11px] font-medium text-muted">Clients</div>
              <div className="space-y-0.5">
                {matchingClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onOpenClient(c.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-raised transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Building2 className="h-3.5 w-3.5 text-muted shrink-0" />
                      <span className="font-medium text-text truncate">{c.name}</span>
                      <span className="font-mono text-[11px] text-muted">{c.id}</span>
                    </div>
                    <span className="text-muted shrink-0">{c.city}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingViews.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[11px] font-medium text-muted">Navigation</div>
              <div className="space-y-0.5">
                {matchingViews.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      onNavigate(v.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-raised transition-colors"
                  >
                    <span className="font-medium text-text">{v.label}</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                      <span>{v.group}</span>
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingClients.length === 0 && matchingViews.length === 0 && (
            <div className="py-8 text-center text-xs text-muted">
              No matching clients or screens.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
