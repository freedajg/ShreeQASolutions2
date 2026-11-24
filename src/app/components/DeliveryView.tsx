import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FileText, FolderCheck, StickyNote, X } from 'lucide-react';
import { Client, Engagement, EngagementStatus, TeamMember } from '../types/crm';
import {
  canEditEngagement,
  canViewContractValues,
  formatDateDDMMMYYYY,
  formatINR,
  getStatusGroup,
} from '../utils/formatters';

interface DeliveryViewProps {
  currentUser: TeamMember;
  clientsById: Record<string, Client>;
  engagements: Engagement[];
  membersById: Record<string, TeamMember>;
  onUpdateStatus: (engagementId: string, status: EngagementStatus) => void;
  onToggleChecklistItem: (engagementId: string, itemId: string) => void;
  onUpdateGapStatus: (
    engagementId: string,
    gapId: string,
    state: 'Compliant' | 'Partial Gap' | 'Missing',
  ) => void;
  onUpdateDocStatus: (
    engagementId: string,
    docId: string,
    status: 'Collected' | 'Pending Client' | 'Under Review',
  ) => void;
  onOpenClient: (clientId: string, engagementId?: string) => void;
  onAddNoteModal: (engagementId: string) => void;
  onAddItem: (
    engagementId: string,
    kind: 'checklist' | 'gap' | 'document',
    label: string,
    detail: string,
  ) => void;
}

/** One line to add a checklist clause, gap domain or document request. */
const AddItemRow: React.FC<{
  labelHint: string;
  detailHint?: string;
  onAdd: (label: string, detail: string) => void;
}> = ({ labelHint, detailHint, onAdd }) => {
  const [label, setLabel] = useState('');
  const [detail, setDetail] = useState('');
  return (
    <form
      className="flex flex-wrap gap-2 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim()) return;
        onAdd(label, detail);
        setLabel('');
        setDetail('');
      }}
    >
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={labelHint}
        aria-label={labelHint}
        className="flex-1 min-w-32 rounded-lg border border-border bg-bg px-3 py-1.5 text-text"
      />
      {detailHint && (
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder={detailHint}
          aria-label={detailHint}
          className="flex-[2] min-w-40 rounded-lg border border-border bg-bg px-3 py-1.5 text-text"
        />
      )}
      <button
        type="submit"
        className="rounded-lg bg-primary-strong px-3 py-1.5 font-medium text-on-primary"
      >
        Add
      </button>
    </form>
  );
};

export const DeliveryView: React.FC<DeliveryViewProps> = ({
  currentUser,
  clientsById,
  engagements,
  membersById,
  onUpdateStatus,
  onToggleChecklistItem,
  onUpdateGapStatus,
  onUpdateDocStatus,
  onOpenClient,
  onAddNoteModal,
  onAddItem,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workroomEngId, setWorkroomEngId] = useState<string | null>(null);
  const [workroomTab, setWorkroomTab] = useState<'checklist' | 'gaps' | 'docs'>('checklist');
  const showFinancials = canViewContractValues(currentUser);

  const deliveryItems = useMemo(() => {
    return engagements.filter((e) => {
      if (e.archived) return false;
      if (getStatusGroup(e.status) !== 'Delivery') return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      return true;
    });
  }, [engagements, statusFilter]);

  const workroomEng = workroomEngId ? engagements.find((e) => e.id === workroomEngId) : null;
  const workroomClient = workroomEng ? clientsById[workroomEng.clientId] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-text">
            Delivery & Audit Workroom
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Won engagements in implementation or audit with site-visit checklists, gap-analysis
            tracking, and document collection.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg bg-raised p-1 border border-border">
          {['all', 'In Progress', 'Implemented', 'Audit Completed'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-surface text-text shadow-xs'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              {s === 'all' ? 'All Delivery' : s}
            </button>
          ))}
        </div>
      </div>

      {deliveryItems.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-sm text-muted">
          No engagements in delivery matching this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-[11px] font-medium text-muted">
                <th className="py-3 px-4">Client & Scope</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Delivery Status</th>
                <th className="py-3 px-4">Readiness</th>
                <th className="py-3 px-4">Owner</th>
                {showFinancials && <th className="py-3 px-4 text-right">Value & Payment</th>}
                <th className="py-3 px-4 text-right">Workroom & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {deliveryItems.map((eng) => {
                const client = clientsById[eng.clientId];
                if (!client) return null;
                const owner = membersById[eng.ownerId];
                const canEdit = canEditEngagement(currentUser, eng);
                const totalChk = eng.checklist?.length || 0;
                const doneChk = eng.checklist?.filter((c) => c.done).length || 0;

                return (
                  <tr key={eng.id} className="hover:bg-bg/70 transition-colors">
                    <td className="py-3.5 px-4 align-top">
                      <button
                        type="button"
                        onClick={() => onOpenClient(client.id, eng.id)}
                        className="font-medium text-text hover:text-primary text-left"
                      >
                        {client.name}
                      </button>
                      <div className="mt-0.5 text-xs text-muted max-w-xs truncate">
                        {eng.scope || eng.standardFramework}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top text-xs text-text-secondary">
                      <div className="font-medium">{eng.service}</div>
                      <div className="text-[11px] text-muted">
                        Last visit: {formatDateDDMMMYYYY(eng.lastContactedDate)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      {canEdit ? (
                        <select
                          value={eng.status}
                          onChange={(e) =>
                            onUpdateStatus(eng.id, e.target.value as EngagementStatus)
                          }
                          aria-label={`Delivery status for ${client.name}`}
                          className="rounded-lg border border-border bg-bg px-2.5 py-1 text-xs font-medium text-text"
                        >
                          <option value="In Progress">In Progress</option>
                          <option value="Implemented">Implemented</option>
                          <option value="Audit Completed">Audit Completed</option>
                          <option value="Certified">Graduate to Certified (Radar)</option>
                        </select>
                      ) : (
                        <span className="text-xs font-medium text-text-secondary">
                          {eng.status}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 align-top text-xs font-mono tabular-nums text-text-secondary">
                      {totalChk > 0 ? `${doneChk}/${totalChk} clauses` : 'No checklist'}
                    </td>

                    <td className="py-3.5 px-4 align-top text-xs text-text-secondary">
                      {owner ? owner.name : 'Unassigned'}
                    </td>

                    {showFinancials && (
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="font-mono text-xs font-medium text-text tabular-nums">
                          {formatINR(eng.contractValueINR)}
                        </div>
                        <div
                          className={`mt-0.5 text-[11px] ${
                            eng.paymentStatus === 'Overdue'
                              ? 'text-danger font-medium'
                              : 'text-muted'
                          }`}
                        >
                          {eng.paymentStatus}
                        </div>
                      </td>
                    )}

                    <td className="py-3.5 px-4 align-top text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setWorkroomEngId(eng.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-primary-line bg-primary-wash px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary-wash whitespace-nowrap"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          <span>Delivery Tools</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddNoteModal(eng.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-raised whitespace-nowrap"
                        >
                          <StickyNote className="h-3.5 w-3.5" />
                          <span>Note</span>
                        </button>
                        {canEdit && eng.status === 'Audit Completed' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(eng.id, 'Certified')}
                            className="inline-flex items-center gap-1 rounded-lg bg-success-strong hover:bg-success-strong px-2.5 py-1.5 text-xs font-medium text-on-primary whitespace-nowrap"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Certify</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Phase 2 Delivery Workroom Drawer: Site-Visit Checklists, Gap Analysis & Document Collection */}
      {workroomEng && workroomClient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-backdrop/50 backdrop-blur-[1px]">
          <div className="relative w-full max-w-2xl h-full bg-surface border-l border-border shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div>
                <div className="text-xs text-muted">
                  Delivery Workroom · {workroomEng.service} ({workroomEng.status})
                </div>
                <h3 className="mt-0.5 font-display text-lg font-semibold text-text">
                  {workroomClient.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWorkroomEngId(null)}
                className="rounded-lg p-1.5 text-muted hover:bg-raised"
                aria-label="Close delivery workroom"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-border px-6 flex items-center gap-6">
              {[
                { id: 'checklist', label: 'Site-Visit Checklist', icon: ClipboardCheck },
                { id: 'gaps', label: 'Gap-Analysis Matrix', icon: FileText },
                { id: 'docs', label: 'Document Collection', icon: FolderCheck },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setWorkroomTab(t.id as typeof workroomTab)}
                    className={`inline-flex items-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                      workroomTab === t.id
                        ? 'border-primary-line text-primary'
                        : 'border-transparent text-muted hover:text-text'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {workroomTab === 'checklist' && (
                <div className="space-y-2.5">
                  {(workroomEng.checklist || []).length === 0 ? (
                    <p className="text-xs text-muted">
                      No checklist items initialized for this engagement yet.
                    </p>
                  ) : (
                    (workroomEng.checklist || []).map((item) => (
                      <label
                        key={item.id}
                        className="flex items-start gap-3 rounded-xl border border-border p-3.5 cursor-pointer hover:bg-bg"
                      >
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => onToggleChecklistItem(workroomEng.id, item.id)}
                          className="mt-0.5 rounded border-border-strong"
                        />
                        <div className="text-xs">
                          <div className="font-mono text-[11px] text-muted">{item.clause}</div>
                          <div
                            className={`mt-0.5 font-medium ${
                              item.done ? 'line-through text-muted' : 'text-text'
                            }`}
                          >
                            {item.task}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                  <AddItemRow
                    labelHint="Clause (e.g. PP SP 2.1)"
                    detailHint="Task"
                    onAdd={(label, detail) => onAddItem(workroomEng.id, 'checklist', label, detail)}
                  />
                </div>
              )}

              {workroomTab === 'gaps' && (
                <AddItemRow
                  labelHint="Domain (e.g. A.8 Asset management)"
                  detailHint="Note"
                  onAdd={(label, detail) => onAddItem(workroomEng.id, 'gap', label, detail)}
                />
              )}
              {workroomTab === 'docs' && (
                <AddItemRow
                  labelHint="Document to collect"
                  onAdd={(label) => onAddItem(workroomEng.id, 'document', label, '')}
                />
              )}

              {workroomTab === 'gaps' && (
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {(workroomEng.gapAnalysis || []).map((gap) => (
                    <div
                      key={gap.id}
                      className="p-4 flex items-start justify-between gap-4 text-xs"
                    >
                      <div>
                        <div className="font-medium text-text">{gap.domain}</div>
                        <div className="mt-0.5 text-muted">{gap.ownerNote}</div>
                      </div>
                      <select
                        value={gap.currentState}
                        onChange={(e) =>
                          onUpdateGapStatus(
                            workroomEng.id,
                            gap.id,
                            e.target.value as 'Compliant' | 'Partial Gap' | 'Missing',
                          )
                        }
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                          gap.currentState === 'Compliant'
                            ? 'border-success-line bg-success-wash text-success'
                            : gap.currentState === 'Partial Gap'
                              ? 'border-warning-line bg-warning-wash text-warning'
                              : 'border-danger-line bg-danger-wash text-danger'
                        }`}
                      >
                        <option value="Compliant">Compliant</option>
                        <option value="Partial Gap">Partial Gap</option>
                        <option value="Missing">Missing</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {workroomTab === 'docs' && (
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {(workroomEng.documents || []).map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 flex items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <div className="font-mono font-medium text-text">{doc.docName}</div>
                        <div className="mt-0.5 text-muted">
                          Updated {formatDateDDMMMYYYY(doc.updatedAt)}
                        </div>
                      </div>
                      <select
                        value={doc.status}
                        onChange={(e) =>
                          onUpdateDocStatus(
                            workroomEng.id,
                            doc.id,
                            e.target.value as 'Collected' | 'Pending Client' | 'Under Review',
                          )
                        }
                        className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text"
                      >
                        <option value="Collected">Collected</option>
                        <option value="Under Review">Under Review</option>
                        <option value="Pending Client">Pending Client</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
