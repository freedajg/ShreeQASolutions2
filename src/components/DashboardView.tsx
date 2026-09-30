import React from 'react';
import { useCrm } from '../context/CrmContext';
import { formatINR } from '../utils/currency';
import { getDaysUntilRenewal, getRenewalDate } from '../utils/dateUtils';
import { MetricInfo } from './MetricInfoModal';

export function DashboardView() {
  const { clients, leads } = useCrm();
  const now = new Date();

  // 1. Money you have (certified book)
  const totalCertifiedValue = clients.reduce((acc, c) => acc + c.contractValue, 0);

  // 2. Money you could win (open leads: not Won, not Lost)
  const openLeads = leads.filter((l) => l.stage !== 'Won' && l.stage !== 'Lost');
  const totalOpenPipelineValue = openLeads.reduce((acc, l) => acc + l.value, 0);

  // 3. Money at risk (lapsed or due within 90 days)
  const riskClients = clients.filter((c) => getDaysUntilRenewal(c, now) <= 90);
  const totalRiskValue = riskClients.reduce((acc, c) => acc + c.contractValue, 0);
  const riskPercent =
    totalCertifiedValue > 0 ? Math.round((totalRiskValue / totalCertifiedValue) * 100) : 0;

  // 4. Money won
  const wonLeads = leads.filter((l) => l.stage === 'Won');
  const lostLeads = leads.filter((l) => l.stage === 'Lost');
  const totalWonValue = wonLeads.reduce((acc, l) => acc + l.value, 0);
  const closedCount = wonLeads.length + lostLeads.length;
  const winRate = closedCount > 0 ? Math.round((wonLeads.length / closedCount) * 100) : 0;

  // Chart 1: Renewals in next 12 months (month by month)
  const monthsList: Array<{
    key: string;
    label: string;
    monthIndex: number;
    year: number;
    clients: Array<{ company: string; value: number; service: string }>;
    totalValue: number;
  }> = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthIndex = d.getMonth();
    const year = d.getFullYear();
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    const key = `${year}-${monthIndex}`;

    // Find clients renewing in this calendar month
    const matched = clients.filter((c) => {
      const renewal = getRenewalDate(c);
      return renewal.getFullYear() === year && renewal.getMonth() === monthIndex;
    });

    const totalVal = matched.reduce((s, c) => s + c.contractValue, 0);

    monthsList.push({
      key,
      label,
      monthIndex,
      year,
      clients: matched.map((c) => ({
        company: c.company,
        value: c.contractValue,
        service: c.service,
      })),
      totalValue: totalVal,
    });
  }

  const maxMonthVal = Math.max(...monthsList.map((m) => m.totalValue), 1000000);

  // Chart 2: Pipeline by stage
  const stages = ['New', 'Contacted', 'Demo scheduled', 'Demo done', 'Proposal sent'] as const;

  const stageData = stages.map((stage) => {
    const stageLeads = leads.filter((l) => l.stage === stage);
    const val = stageLeads.reduce((s, l) => s + l.value, 0);
    return { stage, count: stageLeads.length, value: val };
  });
  const maxStageVal = Math.max(...stageData.map((s) => s.value), 500000);

  // Chart 3: Client ownership breakdown
  const owners = ['Ramesh', 'Pramila', 'Mahesh', 'Sunita'];
  const ownerData = owners.map((owner) => {
    const ownerClients = clients.filter((c) => c.owner.toLowerCase() === owner.toLowerCase());
    const totalVal = ownerClients.reduce((s, c) => s + c.contractValue, 0);
    return { owner, count: ownerClients.length, value: totalVal };
  });
  const maxOwnerVal = Math.max(...ownerData.map((o) => o.value), 500000);

  // Chart 4: Delivered work by quarter (last 8 quarters)
  const quartersList: Array<{ label: string; count: number; value: number }> = [];
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const currentYear = now.getFullYear();

  for (let q = 7; q >= 0; q--) {
    let targetQ = currentQuarter - q;
    let targetY = currentYear;
    while (targetQ < 0) {
      targetQ += 4;
      targetY -= 1;
    }
    const qLabel = `Q${targetQ + 1} '${String(targetY).slice(2)}`;

    // Match clients whose lastAppraisalDate fell in this quarter
    const matched = clients.filter((c) => {
      const ad = new Date(c.lastAppraisalDate);
      if (isNaN(ad.getTime())) return false;
      const appQ = Math.floor(ad.getMonth() / 3);
      const appY = ad.getFullYear();
      return appQ === targetQ && appY === targetY;
    });

    quartersList.push({
      label: qLabel,
      count: matched.length,
      value: matched.reduce((s, c) => s + c.contractValue, 0),
    });
  }
  const maxQuarterVal = Math.max(...quartersList.map((q) => q.value), 500000);

  // Chart 5: Revenue by standard
  const standards = ['CMMI', 'ISO', 'IPA', 'Other'] as const;
  const standardData = standards.map((std) => {
    const stdClients = clients.filter((c) => c.service === std);
    const val = stdClients.reduce((s, c) => s + c.contractValue, 0);
    return {
      standard: std,
      count: stdClients.length,
      value: val,
      percent: totalCertifiedValue > 0 ? Math.round((val / totalCertifiedValue) * 100) : 0,
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">
      {/* Executive Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#e9eefb]">
          Executive Dashboard
        </h1>
        <p className="text-xs sm:text-sm text-[#9aabcc]">
          High-level view of active contracts, renewal risks, pipeline bottlenecks, and team
          portfolios.
        </p>
      </div>

      {/* 4 Primary Figures (Client's plain words) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Figure 1: Money you have */}
        <div className="bg-[#111828] border border-[rgba(148,175,235,0.16)] rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#9aabcc] uppercase tracking-wider">
              Money you have
            </span>
            <MetricInfo
              title="Money You Have"
              explanation="Total active certified contract value currently in your client book across CMMI, ISO, and IPA standards."
              formula={`Sum of all ${clients.length} active client contract values`}
            />
          </div>

          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-[#e9eefb] font-mono tabular-nums tracking-tight">
              {formatINR(totalCertifiedValue)}
            </span>
            <p className="mt-1 text-xs text-[#6d7c9c]">{clients.length} active certified clients</p>
          </div>
        </div>

        {/* Figure 2: Money you could win */}
        <div className="bg-[#111828] border border-[rgba(148,175,235,0.16)] rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#9aabcc] uppercase tracking-wider">
              Money you could win
            </span>
            <MetricInfo
              title="Money You Could Win"
              explanation="Cumulative potential value of all open deals currently in the pipeline (New, Contacted, Demo, Proposal)."
              formula={`Sum of all ${openLeads.length} open pipeline lead values`}
            />
          </div>

          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-[#22d3ee] font-mono tabular-nums tracking-tight">
              {formatINR(totalOpenPipelineValue)}
            </span>
            <p className="mt-1 text-xs text-[#6d7c9c]">{openLeads.length} open deals in pipeline</p>
          </div>
        </div>

        {/* Figure 3: Money at risk (With Ring: share of book) */}
        <div className="bg-[#111828] border border-[#fb7185]/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#fb7185] uppercase tracking-wider">
              Money at risk
            </span>
            <MetricInfo
              title="Money At Risk"
              explanation="Value of clients whose process certifications are already lapsed or due to lapse within the next 90 days."
              formula="Lapsed (<0d) + Due Soon (<=90d) contract value"
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <span className="text-2xl sm:text-3xl font-bold text-[#fb7185] font-mono tabular-nums tracking-tight">
                {formatINR(totalRiskValue)}
              </span>
              <p className="mt-1 text-xs text-[#fb7185]/80">
                {riskClients.length} clients lapsed or due within 90 days
              </p>
            </div>

            {/* Circular Gauge */}
            <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
              <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#18213a]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#fb7185]"
                  strokeDasharray={`${riskPercent}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-bold font-mono text-[#fb7185] tabular-nums leading-none">
                  {riskPercent}%
                </span>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-[#6d7c9c] italic border-t border-[rgba(148,175,235,0.08)] pt-1.5">
            Share of certified book ({riskPercent}% of {formatINR(totalCertifiedValue, true)})
          </p>
        </div>

        {/* Figure 4: Money won (With Ring: win rate) */}
        <div className="bg-[#111828] border border-[#2dd4bf]/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#2dd4bf] uppercase tracking-wider">
              Money won
            </span>
            <MetricInfo
              title="Money Won & Win Rate"
              explanation="Revenue closed in stage Won, and the win rate percentage of all finalized decisions."
              formula="Won / (Won + Lost deals)"
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <span className="text-2xl sm:text-3xl font-bold text-[#2dd4bf] font-mono tabular-nums tracking-tight">
                {formatINR(totalWonValue)}
              </span>
              <p className="mt-1 text-xs text-[#2dd4bf]/80">
                {wonLeads.length} deals won ({closedCount} closed)
              </p>
            </div>

            {/* Circular Gauge */}
            <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
              <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#18213a]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#2dd4bf]"
                  strokeDasharray={`${winRate}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-bold font-mono text-[#2dd4bf] tabular-nums leading-none">
                  {winRate}%
                </span>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-[#6d7c9c] italic border-t border-[rgba(148,175,235,0.08)] pt-1.5">
            Win rate of closed deals (Won / (Won + Lost))
          </p>
        </div>
      </div>

      {/* Primary Chart: When your renewals are due (Next 12 Months) - The chart that earns the app! */}
      <div className="bg-[#111828] border border-[rgba(148,175,235,0.18)] rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-[rgba(148,175,235,0.12)]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#e9eefb]">
                When your renewals are due
              </h2>
              <MetricInfo
                title="12-Month Renewal Schedule"
                explanation="Shows which clients need renewals across each of the upcoming 12 months based on their 3-year (CMMI) or 1-year (ISO/IPA) audit cycles."
              />
            </div>
            <p className="text-xs text-[#9aabcc] mt-0.5">
              Client certification expiry projected across the next 12 months
            </p>
          </div>
          <span className="text-xs font-mono text-[#818cf8] hidden sm:block">
            Next 12 Months Projection
          </span>
        </div>

        {/* 12-Month Bar Chart */}
        <div className="mt-6 overflow-x-auto pb-2">
          <div className="min-w-[650px] space-y-4">
            <div className="grid grid-cols-12 gap-2 text-center">
              {monthsList.map((m, idx) => {
                const heightPercent =
                  m.totalValue > 0
                    ? Math.max(15, Math.round((m.totalValue / maxMonthVal) * 100))
                    : 4;
                const hasClients = m.clients.length > 0;
                const isImmediate = idx < 3; // within 90 days

                return (
                  <div
                    key={m.key}
                    className="flex flex-col items-center justify-end h-56 group relative"
                  >
                    {/* Tooltip on hover */}
                    {hasClients && (
                      <div className="absolute bottom-full mb-2 hidden group-hover:block z-30 p-2.5 bg-[#18213a] border border-[rgba(148,175,235,0.25)] rounded-xl shadow-2xl text-left w-48 text-xs pointer-events-none">
                        <div className="font-bold text-[#e9eefb] border-b border-[rgba(148,175,235,0.1)] pb-1 mb-1">
                          {m.label} · {formatINR(m.totalValue)}
                        </div>
                        {m.clients.map((c, i) => (
                          <div key={i} className="text-[#9aabcc] py-0.5 truncate">
                            • {c.company} ({c.service})
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Value label */}
                    <span className="text-[10px] font-mono text-[#9aabcc] mb-1 tabular-nums truncate w-full text-center">
                      {m.totalValue > 0 ? formatINR(m.totalValue, true) : '—'}
                    </span>

                    {/* Bar Pillar */}
                    <div className="w-full bg-[#18213a] rounded-t-lg h-40 flex items-end p-1">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          !hasClients
                            ? 'bg-[#18213a]'
                            : isImmediate
                              ? 'bg-gradient-to-t from-[#fb7185] to-[#fbbf24]'
                              : 'bg-gradient-to-t from-[#6366f1] to-[#22d3ee]'
                        }`}
                      />
                    </div>

                    {/* Month Label */}
                    <span
                      className={`text-xs mt-2 font-medium ${
                        hasClients ? 'text-[#e9eefb] font-semibold' : 'text-[#6d7c9c]'
                      }`}
                    >
                      {m.label}
                    </span>
                    <span className="text-[10px] text-[#6d7c9c]">
                      {m.clients.length > 0 ? `${m.clients.length} due` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Grid of 4 analytical charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 2: Where open deals are stuck */}
        <div className="bg-[#111828] border border-[rgba(148,175,235,0.16)] rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[rgba(148,175,235,0.1)]">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[#e9eefb]">Where your open deals are stuck</h3>
              <MetricInfo
                title="Deals Stuck by Stage"
                explanation="Total potential pipeline value waiting at each qualification stage before closing."
              />
            </div>
            <span className="text-xs font-mono text-[#22d3ee]">
              {formatINR(totalOpenPipelineValue)} Total
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {stageData.map((item) => {
              const widthPct = maxStageVal > 0 ? Math.round((item.value / maxStageVal) * 100) : 0;
              return (
                <div key={item.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#e9eefb] font-medium">{item.stage}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-[#6d7c9c] text-[11px]">
                        ({item.count} {item.count === 1 ? 'deal' : 'deals'})
                      </span>
                      <span className="text-[#22d3ee] font-semibold">{formatINR(item.value)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-[#18213a] rounded-full h-2.5 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(widthPct, 2)}%` }}
                      className="bg-gradient-to-r from-[#818cf8] to-[#22d3ee] h-full rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 3: Who owns which clients */}
        <div className="bg-[#111828] border border-[rgba(148,175,235,0.16)] rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[rgba(148,175,235,0.1)]">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[#e9eefb]">Who owns which clients</h3>
              <MetricInfo
                title="Client Ownership Distribution"
                explanation="Breakdown of existing certified client book value and count across the 4 team members."
              />
            </div>
            <span className="text-xs font-mono text-[#818cf8]">4 Team Members</span>
          </div>

          <div className="space-y-3 pt-2">
            {ownerData.map((item) => {
              const widthPct = maxOwnerVal > 0 ? Math.round((item.value / maxOwnerVal) * 100) : 0;
              return (
                <div key={item.owner} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#e9eefb] font-semibold">{item.owner}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-[#6d7c9c] text-[11px]">
                        ({item.count} {item.count === 1 ? 'client' : 'clients'})
                      </span>
                      <span className="text-[#a78bfa] font-semibold">{formatINR(item.value)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-[#18213a] rounded-full h-2.5 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(widthPct, 2)}%` }}
                      className="bg-gradient-to-r from-[#6366f1] to-[#a78bfa] h-full rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 4: Work delivered by quarter */}
        <div className="bg-[#111828] border border-[rgba(148,175,235,0.16)] rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[rgba(148,175,235,0.1)]">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[#e9eefb]">Work you delivered, by quarter</h3>
              <MetricInfo
                title="Historical Appraisal Delivery"
                explanation="Value of process certifications completed across the last 8 quarters, calculated directly from client last appraisal dates."
              />
            </div>
            <span className="text-xs font-mono text-[#2dd4bf]">Last 8 Quarters</span>
          </div>

          <div className="grid grid-cols-8 gap-1.5 pt-4 text-center">
            {quartersList.map((q) => {
              const hPct =
                maxQuarterVal > 0 && q.value > 0
                  ? Math.max(15, Math.round((q.value / maxQuarterVal) * 100))
                  : 4;
              return (
                <div
                  key={q.label}
                  className="flex flex-col items-center justify-end h-36 group relative"
                >
                  {/* Tooltip */}
                  {q.count > 0 && (
                    <div className="absolute bottom-full mb-1 hidden group-hover:block z-30 p-2 bg-[#18213a] border border-[rgba(148,175,235,0.2)] rounded-lg text-xs w-28 text-left pointer-events-none">
                      <div className="font-bold text-[#e9eefb]">{q.label}</div>
                      <div className="text-[#2dd4bf] font-mono">{formatINR(q.value)}</div>
                      <div className="text-[#9aabcc] text-[10px]">{q.count} audits delivered</div>
                    </div>
                  )}

                  <div className="w-full bg-[#18213a] rounded-t h-24 flex items-end p-0.5">
                    <div
                      style={{ height: `${hPct}%` }}
                      className={`w-full rounded-t transition-all duration-300 ${
                        q.count > 0 ? 'bg-[#2dd4bf]' : 'bg-[#18213a]'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] text-[#9aabcc] mt-1 font-medium truncate w-full">
                    {q.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[#6d7c9c] italic">
            *Derived from recorded appraisal completion dates in active client ledger.
          </p>
        </div>

        {/* Chart 5: Standard revenue breakdown */}
        <div className="bg-[#111828] border border-[rgba(148,175,235,0.16)] rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[rgba(148,175,235,0.1)]">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[#e9eefb]">
                Which standard your revenue comes from
              </h3>
              <MetricInfo
                title="Revenue by Standard"
                explanation="Share of total certified revenue generated by CMMI appraisals vs ISO vs IPA certifications."
              />
            </div>
            <span className="text-xs font-mono text-[#818cf8]">Standards Share</span>
          </div>

          <div className="space-y-3 pt-2">
            {standardData.map((std) => (
              <div key={std.standard} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[#e9eefb] font-semibold">{std.standard}</span>
                    <span className="text-[11px] text-[#6d7c9c]">({std.count} clients)</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-[#818cf8] font-bold">{std.percent}%</span>
                    <span className="text-[#9aabcc] text-[11px]">({formatINR(std.value)})</span>
                  </div>
                </div>
                <div className="w-full bg-[#18213a] rounded-full h-2.5 overflow-hidden">
                  <div
                    style={{ width: `${Math.max(std.percent, 2)}%` }}
                    className="bg-gradient-to-r from-[#6366f1] to-[#818cf8] h-full rounded-full transition-all duration-300"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
