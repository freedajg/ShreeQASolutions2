import React, { useMemo, useState } from 'react';
import { AlertCircle, MailPlus, StickyNote } from 'lucide-react';
import {
  AppSettings,
  Client,
  ClientRating,
  Engagement,
  ServiceType,
  TeamMember,
} from '../types/crm';
import {
  canViewContractValues,
  computeRenewalInfo,
  formatDateDDMMMYYYY,
  formatINR,
  getStatusGroup,
  RadarBucket,
} from '../utils/formatters';

interface RenewalRadarViewProps {
  currentUser: TeamMember;
  referenceDate: string;
  clientsById: Record<string, Client>;
  engagements: Engagement[];
  membersById: Record<string, TeamMember>;
  settings: AppSettings;
  initialBucketFilter?: string;
  onOpenClient: (clientId: string, engagementId?: string) => void;
  onCreateRenewalDraft: (engagementId: string) => void;
  onAddNoteModal: (engagementId: string) => void;
}

const BUCKET_ORDER: RadarBucket[] = ['Overdue', 'Due in 30 days', '31–90 days', 'Later'];

export const RenewalRadarView: React.FC<RenewalRadarViewProps> = ({
  currentUser,
  referenceDate,
  clientsById,
  engagements,
  membersById,
  settings,
  initialBucketFilter,
  onOpenClient,
  onCreateRenewalDraft,
  onAddNoteModal,
}) => {
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [bucketFocus, setBucketFocus] = useState<string>(initialBucketFilter || 'all');

  const showFinancials = canViewContractValues(currentUser);

  const radarItems = useMemo(() => {
    return engagements
      .filter((e) => !e.archived && getStatusGroup(e.status) === 'Active client')
      .map((e) => {
        const client = clientsById[e.clientId];
        const renewal = computeRenewalInfo(e, referenceDate, settings);
        return { engagement: e, client, renewal };
      })
      .filter(({ engagement, client, renewal }) => {
        if (!client) return false;
        if (!renewal.bucket) return false;
        if (ownerFilter !== 'all' && engagement.ownerId !== ownerFilter) return false;
        if (serviceFilter !== 'all' && engagement.service !== serviceFilter) return false;
        if (priorityFilter !== 'all' && client.rating !== priorityFilter) return false;
        if (bucketFocus !== 'all' && renewal.bucket !== bucketFocus) return false;
        return true;
      })
      .sort((a, b) => (a.renewal.daysDelta ?? 9999) - (b.renewal.daysDelta ?? 9999));
  }, [
    engagements,
    clientsById,
    referenceDate,
    settings,
    ownerFilter,
    serviceFilter,
    priorityFilter,
    bucketFocus,
  ]);

  const activeServices = useMemo(() => {
    const set = new Set<ServiceType>();
    engagements
      .filter((e) => getStatusGroup(e.status) === 'Active client')
      .forEach((e) => set.add(e.service));
    return Array.from(set);
  }, [engagements]);

  const grouped = useMemo(() => {
    const map: Record<RadarBucket, typeof radarItems> = {
      Overdue: [],
      'Due in 30 days': [],
      '31–90 days': [],
      Later: [],
    };
    radarItems.forEach((item) => {
      if (item.renewal.bucket) {
        map[item.renewal.bucket].push(item);
      }
    });
    return map;
  }, [radarItems]);

  const visibleBuckets = bucketFocus === 'all' ? BUCKET_ORDER : [bucketFocus as RadarBucket];

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="font-display text-xl font-semibold text-text">Renewal Radar</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Every certified engagement tracked by Surveillance / Next Audit / Certificate Valid To —
            overdue renewals are isolated at the top.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            aria-label="Filter by owner"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary"
          >
            <option value="all">All Owners</option>
            {Object.values(membersById)
              .filter((m) => m.role !== 'Marketing')
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            aria-label="Filter by certification type"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary"
          >
            <option value="all">All Certifications</option>
            {activeServices.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            aria-label="Filter by priority"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary"
          >
            <option value="all">All Priorities</option>
            {(['High', 'Medium', 'Low'] as ClientRating[]).map((r) => (
              <option key={r} value={r}>
                {r} Priority
              </option>
            ))}
          </select>

          {bucketFocus !== 'all' && (
            <button
              type="button"
              onClick={() => setBucketFocus('all')}
              className="rounded-lg border border-primary-line bg-primary-wash px-2.5 py-1.5 text-xs font-medium text-primary"
            >
              Clear Window: {bucketFocus} ×
            </button>
          )}
        </div>
      </div>

      {/* Bucket Sections — Overdue ALWAYS first and strictly separated */}
      <div className="space-y-8">
        {visibleBuckets.map((bucket) => {
          const rows = grouped[bucket] || [];
          const isOverdue = bucket === 'Overdue';
          const isDue30 = bucket === 'Due in 30 days';

          return (
            <section key={bucket} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOverdue && <AlertCircle className="h-4 w-4 text-danger shrink-0" />}
                  <h3
                    className={`font-display text-sm font-semibold ${
                      isOverdue ? 'text-danger' : isDue30 ? 'text-warning' : 'text-text'
                    }`}
                  >
                    {bucket} ({rows.length})
                  </h3>
                  {isOverdue && (
                    <span className="text-xs text-muted">
                      · Shown separately from upcoming renewals
                    </span>
                  )}
                </div>
              </div>

              {rows.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface px-5 py-6 text-xs text-muted">
                  No engagements in "{bucket}" matching your filters.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[11px] font-medium text-muted">
                        <th className="py-3 px-4">Client & Standard</th>
                        <th className="py-3 px-4">Event Type</th>
                        <th className="py-3 px-4">Next Due Date</th>
                        <th className="py-3 px-4">Owner</th>
                        {showFinancials && <th className="py-3 px-4 text-right">Value</th>}
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {rows.map(({ engagement, client, renewal }) => {
                        const owner = membersById[engagement.ownerId];
                        const absDays = Math.abs(renewal.daysDelta || 0);

                        return (
                          <tr key={engagement.id} className="hover:bg-bg/80 transition-colors">
                            <td className="py-3.5 px-4 align-top">
                              <button
                                type="button"
                                onClick={() => onOpenClient(client.id, engagement.id)}
                                className="font-medium text-text hover:text-primary text-left"
                              >
                                {client.name}
                              </button>
                              <div className="mt-0.5 text-xs text-muted">
                                {engagement.service} · {engagement.standardFramework} · Priority:{' '}
                                {client.rating}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top text-xs text-text-secondary">
                              <div className="font-medium">{renewal.eventKind}</div>
                              <div className="text-[11px] text-muted mt-0.5">
                                {renewal.ruleUsed}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-mono text-xs font-medium text-text tabular-nums">
                                {formatDateDDMMMYYYY(renewal.dueDate || undefined)}
                              </div>
                              <div
                                className={`mt-0.5 text-xs tabular-nums ${
                                  isOverdue
                                    ? 'text-danger font-medium'
                                    : isDue30
                                      ? 'text-warning font-medium'
                                      : 'text-muted'
                                }`}
                              >
                                {isOverdue ? `${absDays} days overdue` : `In ${absDays} days`}
                              </div>
                              {renewal.isEstimated && (
                                <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-warning">
                                  <span>Estimated — please check</span>
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 align-top text-xs text-text-secondary">
                              {owner ? owner.name : 'Unassigned'}
                            </td>

                            {showFinancials && (
                              <td className="py-3.5 px-4 align-top text-right font-mono text-xs text-text tabular-nums">
                                {formatINR(engagement.contractValueINR)}
                              </td>
                            )}

                            <td className="py-3.5 px-4 align-top text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onCreateRenewalDraft(engagement.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-raised transition-colors whitespace-nowrap"
                                >
                                  <MailPlus className="h-3.5 w-3.5" />
                                  <span>Draft Renewal</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onAddNoteModal(engagement.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-raised transition-colors whitespace-nowrap"
                                >
                                  <StickyNote className="h-3.5 w-3.5" />
                                  <span>Note</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};
