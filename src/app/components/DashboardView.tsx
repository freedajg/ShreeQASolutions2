import React, { useMemo } from 'react';
import { ArrowUpRight, Lock } from 'lucide-react';
import {
  AppSettings,
  AppView,
  Client,
  Engagement,
  FollowUpDraft,
  LeadSource,
  TeamMember,
} from '../types/crm';
import {
  canSeeEngagement,
  canViewContractValues,
  computeRenewalInfo,
  formatINR,
  getStatusGroup,
  isLeadQuiet,
} from '../utils/formatters';

interface DashboardViewProps {
  currentUser: TeamMember;
  referenceDate: string;
  clients: Client[];
  engagements: Engagement[];
  drafts: FollowUpDraft[];
  membersById: Record<string, TeamMember>;
  settings: AppSettings;
  onNavigate: (view: AppView, filterHint?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  referenceDate,
  clients,
  engagements,
  drafts,
  membersById,
  settings,
  onNavigate,
}) => {
  const showFinancials = canViewContractValues(currentUser);
  const isMarketing = currentUser.role === 'Marketing';

  const visibleEngagements = useMemo(
    () => engagements.filter((e) => canSeeEngagement(currentUser, e)),
    [engagements, currentUser],
  );

  const clientsById = useMemo(() => {
    const map: Record<string, Client> = {};
    clients.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [clients]);

  const pipelineEngagements = useMemo(
    () =>
      visibleEngagements.filter(
        (e) => e.status === 'Lead' || e.status === 'Proposal' || e.status === 'On Hold',
      ),
    [visibleEngagements],
  );

  const pipelineByStage = useMemo(() => {
    const stages: ('Lead' | 'Proposal' | 'On Hold')[] = ['Lead', 'Proposal', 'On Hold'];
    return stages.map((stage) => {
      const items = pipelineEngagements.filter((e) => e.status === stage);
      const value = items.reduce((acc, e) => acc + (e.contractValueINR || 0), 0);
      return { stage, count: items.length, value };
    });
  }, [pipelineEngagements]);

  const pipelineByOwner = useMemo(() => {
    const map: Record<string, { name: string; count: number; value: number }> = {};
    pipelineEngagements.forEach((e) => {
      const key = e.ownerId || 'unassigned';
      const label = e.ownerId ? membersById[e.ownerId]?.name || 'Unknown' : 'Unassigned';
      if (!map[key]) map[key] = { name: label, count: 0, value: 0 };
      map[key].count += 1;
      map[key].value += e.contractValueINR || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].value - a[1].value);
  }, [pipelineEngagements, membersById]);

  const renewalStats = useMemo(() => {
    let overdue = 0;
    let due30 = 0;
    let due60 = 0;
    let due90 = 0;

    visibleEngagements
      .filter((e) => getStatusGroup(e.status) === 'Active client')
      .forEach((e) => {
        const info = computeRenewalInfo(e, referenceDate, settings);
        if (info.daysDelta === null) return;
        if (info.daysDelta < 0) overdue += 1;
        else if (info.daysDelta <= 30) due30 += 1;
        else if (info.daysDelta <= 60) due60 += 1;
        else if (info.daysDelta <= 90) due90 += 1;
      });

    return { overdue, due30, due60, due90 };
  }, [visibleEngagements, referenceDate, settings]);

  const leadsBySource = useMemo(() => {
    const currentMonthPrefix = referenceDate.slice(0, 7);
    const counts: Record<string, number> = {};
    settings.leadSources.forEach((s) => {
      counts[s] = 0;
    });

    visibleEngagements
      .filter((e) => {
        const date = e.initialEngagementDate || clientsById[e.clientId]?.createdAt || '';
        return (
          (e.status === 'Lead' || e.status === 'Proposal') && date.startsWith(currentMonthPrefix)
        );
      })
      .forEach((e) => {
        const src: LeadSource = clientsById[e.clientId]?.leadSource || 'Other';
        counts[src] = (counts[src] || 0) + 1;
      });

    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [visibleEngagements, clientsById, referenceDate, settings.leadSources]);

  const quietLeadsCount = useMemo(
    () =>
      visibleEngagements.filter((e) => isLeadQuiet(e, referenceDate, settings.followUpIntervalDays))
        .length,
    [visibleEngagements, referenceDate, settings.followUpIntervalDays],
  );

  const waitingDraftsCount = useMemo(
    () => drafts.filter((d) => d.status === 'waiting').length,
    [drafts],
  );

  const totalPipelineValue = pipelineByStage.reduce((sum, s) => sum + s.value, 0);
  const totalLeadsThisMonth = leadsBySource.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-text">
            {isMarketing ? 'Lead Source & Pipeline Overview' : 'Practice Overview'}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Click any metric to inspect the underlying clients and engagements.
          </p>
        </div>
        {!showFinancials && (
          <div className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Lock className="h-3.5 w-3.5" />
            <span>Contract values hidden for {currentUser.role}</span>
          </div>
        )}
      </div>

      {/* Unified Mercury-style KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border rounded-xl border border-border bg-surface overflow-hidden">
        {showFinancials ? (
          <button
            type="button"
            onClick={() => onNavigate('pipeline')}
            className="group text-left p-5 hover:bg-bg/80 transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Active Pipeline Value</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-1.5 font-mono text-2xl font-semibold text-text tabular-nums">
              {formatINR(totalPipelineValue)}
            </div>
            <div className="mt-1 text-xs text-muted tabular-nums">
              {pipelineEngagements.length} open engagements
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('pipeline')}
            className="group text-left p-5 hover:bg-bg/80 transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Open Leads & Proposals</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-1.5 font-mono text-2xl font-semibold text-text tabular-nums">
              {pipelineEngagements.length}
            </div>
            <div className="mt-1 text-xs text-muted">Active opportunities</div>
          </button>
        )}

        {!isMarketing && (
          <button
            type="button"
            onClick={() => onNavigate('radar', 'Overdue')}
            className="group text-left p-5 hover:bg-bg/80 transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Renewals Overdue</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-1.5 font-mono text-2xl font-semibold text-danger tabular-nums">
              {renewalStats.overdue}
            </div>
            <div className="mt-1 text-xs text-muted tabular-nums">
              +{renewalStats.due30} due in 30 days
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={() => onNavigate('pipeline', 'quiet')}
          className="group text-left p-5 hover:bg-bg/80 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Quiet Leads</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-warning tabular-nums">
            {quietLeadsCount}
          </div>
          <div className="mt-1 text-xs text-muted">
            &gt;{settings.followUpIntervalDays} days without contact
          </div>
        </button>

        {!isMarketing ? (
          <button
            type="button"
            onClick={() => onNavigate('today')}
            className="group text-left p-5 hover:bg-bg/80 transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Drafts Waiting Review</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-1.5 font-mono text-2xl font-semibold text-primary tabular-nums">
              {waitingDraftsCount}
            </div>
            <div className="mt-1 text-xs text-muted">Ready in Today queue</div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('clients')}
            className="group text-left p-5 hover:bg-bg/80 transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Leads Added This Month</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-1.5 font-mono text-2xl font-semibold text-primary tabular-nums">
              {totalLeadsThisMonth}
            </div>
            <div className="mt-1 text-xs text-muted">Across {leadsBySource.length} sources</div>
          </button>
        )}
      </div>

      {/* Analytical Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-border bg-surface p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-text">Pipeline by Stage</h3>
            <button
              type="button"
              onClick={() => onNavigate('pipeline')}
              className="text-xs font-medium text-primary hover:underline"
            >
              Open Board
            </button>
          </div>

          <div className="space-y-3.5">
            {pipelineByStage.map((row) => {
              const pct =
                pipelineEngagements.length > 0
                  ? Math.round((row.count / pipelineEngagements.length) * 100)
                  : 0;
              return (
                <button
                  key={row.stage}
                  type="button"
                  onClick={() => onNavigate('pipeline')}
                  className="w-full text-left group"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-text group-hover:text-primary">
                      {row.stage}
                    </span>
                    <span className="font-mono tabular-nums text-muted">
                      {row.count} leads{showFinancials ? ` · ${formatINR(row.value)}` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-raised overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary-strong transition-all"
                      style={{ width: `${Math.max(pct, 6)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="text-xs font-medium text-muted mb-3">Pipeline by Relationship Owner</h4>
            <div className="divide-y divide-border">
              {pipelineByOwner.map(([ownerKey, stats]) => (
                <button
                  key={ownerKey}
                  type="button"
                  onClick={() => onNavigate('pipeline', ownerKey)}
                  className="w-full flex items-center justify-between py-2.5 text-xs hover:bg-bg px-1.5 rounded transition-colors"
                >
                  <span
                    className={`font-medium ${
                      ownerKey === 'unassigned' ? 'text-danger' : 'text-text'
                    }`}
                  >
                    {stats.name}
                  </span>
                  <span className="font-mono tabular-nums text-muted">
                    {stats.count} {showFinancials ? `· ${formatINR(stats.value)}` : 'leads'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="space-y-6">
          {!isMarketing && (
            <section className="rounded-xl border border-border bg-surface p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-sm font-semibold text-text">Renewals Horizon</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('radar')}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Open Radar
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border rounded-lg border border-border">
                {[
                  {
                    label: 'Overdue',
                    count: renewalStats.overdue,
                    tone: 'text-danger',
                    target: 'Overdue',
                  },
                  {
                    label: 'Due in 30d',
                    count: renewalStats.due30,
                    tone: 'text-warning',
                    target: 'Due in 30 days',
                  },
                  {
                    label: '31–60d',
                    count: renewalStats.due60,
                    tone: 'text-text',
                    target: '31–90 days',
                  },
                  {
                    label: '61–90d',
                    count: renewalStats.due90,
                    tone: 'text-text',
                    target: '31–90 days',
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onNavigate('radar', item.target)}
                    className="p-3.5 text-left hover:bg-bg transition-colors"
                  >
                    <div className="text-[11px] text-muted">{item.label}</div>
                    <div
                      className={`mt-1 font-mono text-xl font-semibold tabular-nums ${item.tone}`}
                    >
                      {item.count}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-text">
                  Leads This Month by Source
                </h3>
                <p className="text-xs text-muted">Sep 2026 · {totalLeadsThisMonth} inbound leads</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('clients')}
                className="text-xs font-medium text-primary hover:underline"
              >
                View Leads
              </button>
            </div>

            {leadsBySource.length === 0 ? (
              <p className="text-xs text-muted py-4">No new leads recorded for this month yet.</p>
            ) : (
              <div className="space-y-3">
                {leadsBySource.map(([source, count]) => {
                  const pct =
                    totalLeadsThisMonth > 0 ? Math.round((count / totalLeadsThisMonth) * 100) : 0;
                  return (
                    <button
                      key={source}
                      type="button"
                      onClick={() => onNavigate('pipeline', `source:${source}`)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-text group-hover:text-primary">
                          {source}
                        </span>
                        <span className="font-mono tabular-nums text-muted">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-raised overflow-hidden">
                        <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
