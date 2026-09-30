import React, { useState } from 'react';
import { ShieldAlert, Clock, Calendar, CheckCircle, Mail, Search, ArrowRight } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import {
  getDaysUntilRenewal,
  getRenewalDate,
  formatStandardDate,
  getRenewalCycleYears,
} from '../utils/dateUtils';
import { formatINR } from '../utils/currency';
import { Client, ServiceKind } from '../types';

export function RenewalRadarView() {
  const { clients, openDraftModal, setActiveTab } = useCrm();
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');

  const now = new Date();

  // Band calculations
  const overdueList: Client[] = [];
  const dueSoonList: Client[] = [];
  const upcomingList: Client[] = [];
  const laterList: Client[] = [];

  clients.forEach((client) => {
    // Filter matching
    const matchesSearch =
      client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.level || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesService = serviceFilter === 'ALL' || client.service === serviceFilter;
    const matchesOwner =
      ownerFilter === 'ALL' || client.owner.toLowerCase() === ownerFilter.toLowerCase();

    if (!matchesSearch || !matchesService || !matchesOwner) return;

    const days = getDaysUntilRenewal(client, now);
    if (days < 0) {
      overdueList.push(client);
    } else if (days <= 90) {
      dueSoonList.push(client);
    } else if (days <= 180) {
      upcomingList.push(client);
    } else {
      laterList.push(client);
    }
  });

  // Sort each band: closest deadline first
  overdueList.sort((a, b) => getDaysUntilRenewal(a, now) - getDaysUntilRenewal(b, now));
  dueSoonList.sort((a, b) => getDaysUntilRenewal(a, now) - getDaysUntilRenewal(b, now));
  upcomingList.sort((a, b) => getDaysUntilRenewal(a, now) - getDaysUntilRenewal(b, now));
  laterList.sort((a, b) => getDaysUntilRenewal(a, now) - getDaysUntilRenewal(b, now));

  const totalOverdueVal = overdueList.reduce((s, c) => s + c.contractValue, 0);
  const totalDueSoonVal = dueSoonList.reduce((s, c) => s + c.contractValue, 0);
  const totalUpcomingVal = upcomingList.reduce((s, c) => s + c.contractValue, 0);
  const totalLaterVal = laterList.reduce((s, c) => s + c.contractValue, 0);

  const bands = [
    {
      id: 'overdue',
      title: 'Overdue Certifications',
      subtitle: 'Process renewal window has elapsed. Immediate re-engagement critical.',
      count: overdueList.length,
      totalValue: totalOverdueVal,
      clients: overdueList,
      color: 'rose',
      borderClass: 'border-[#fb7185]/35 bg-[#fb7185]/5',
      badgeClass: 'bg-[#fb7185]/20 text-[#fb7185] border-[#fb7185]/40',
      icon: ShieldAlert,
    },
    {
      id: 'due_soon',
      title: 'Due Soon (Within 90 Days)',
      subtitle: 'Audit window approaching. Initiate Stage 1 preparation & documentation reviews.',
      count: dueSoonList.length,
      totalValue: totalDueSoonVal,
      clients: dueSoonList,
      color: 'amber',
      borderClass: 'border-[#fbbf24]/35 bg-[#fbbf24]/5',
      badgeClass: 'bg-[#fbbf24]/20 text-[#fbbf24] border-[#fbbf24]/40',
      icon: Clock,
    },
    {
      id: 'upcoming',
      title: 'Upcoming (91 - 180 Days)',
      subtitle: 'Schedule mid-term hygiene check and preliminary audit scope.',
      count: upcomingList.length,
      totalValue: totalUpcomingVal,
      clients: upcomingList,
      color: 'cyan',
      borderClass: 'border-[#22d3ee]/35 bg-[#22d3ee]/5',
      badgeClass: 'bg-[#22d3ee]/20 text-[#22d3ee] border-[#22d3ee]/40',
      icon: Calendar,
    },
    {
      id: 'later',
      title: 'Later (180+ Days)',
      subtitle: 'Healthy standing. Mid-cycle surveillance scheduled according to standard.',
      count: laterList.length,
      totalValue: totalLaterVal,
      clients: laterList,
      color: 'brand',
      borderClass: 'border-[#818cf8]/25 bg-[#111828]',
      badgeClass: 'bg-[#818cf8]/15 text-[#818cf8] border-[#818cf8]/30',
      icon: CheckCircle,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#e9eefb]">
              Renewal Radar
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fb7185]/15 text-[#fb7185] border border-[#fb7185]/30">
              {overdueList.length} Overdue
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#9aabcc] mt-0.5">
            Deterministic calendar arithmetic (CMMI = 3 years, ISO/IPA = 1 year). Zero model
            dependency.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#111828] p-3 rounded-2xl border border-[rgba(148,175,235,0.16)]">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6d7c9c]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search company, contact, or standard level..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.14)] text-sm text-[#e9eefb] placeholder-[#6d7c9c] focus:outline-none focus:border-[#818cf8]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.14)] text-xs text-[#e9eefb] focus:outline-none focus:border-[#818cf8]"
          >
            <option value="ALL">All Standards</option>
            <option value="CMMI">CMMI (3 Years)</option>
            <option value="ISO">ISO (1 Year)</option>
            <option value="IPA">IPA (1 Year)</option>
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.14)] text-xs text-[#e9eefb] focus:outline-none focus:border-[#818cf8]"
          >
            <option value="ALL">All Owners</option>
            <option value="Ramesh">Ramesh</option>
            <option value="Pramila">Pramila</option>
            <option value="Mahesh">Mahesh</option>
            <option value="Sunita">Sunita</option>
          </select>
        </div>
      </div>

      {/* 4 Bands in Vertical Stack */}
      <div className="space-y-6">
        {bands.map((band) => {
          const Icon = band.icon;
          return (
            <div
              key={band.id}
              className={`rounded-2xl border p-5 shadow-lg space-y-4 ${band.borderClass}`}
            >
              {/* Band Summary Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[rgba(148,175,235,0.1)]">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl border ${band.badgeClass}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-[#e9eefb]">{band.title}</h2>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border ${band.badgeClass}`}
                      >
                        {band.count} {band.count === 1 ? 'client' : 'clients'}
                      </span>
                    </div>
                    <p className="text-xs text-[#9aabcc]">{band.subtitle}</p>
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className="text-xs text-[#6d7c9c] block uppercase font-semibold">
                    Value at stake
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-[#e9eefb] tabular-nums">
                    {formatINR(band.totalValue)}
                  </span>
                </div>
              </div>

              {/* Band Client Cards Grid */}
              {band.clients.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#6d7c9c]">
                  No clients currently in this band.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {band.clients.map((client) => {
                    const days = getDaysUntilRenewal(client, now);
                    const renewalDate = getRenewalDate(client);
                    const cycleYears = getRenewalCycleYears(client.service);

                    return (
                      <div
                        key={client.id}
                        className="bg-[#111828] border border-[rgba(148,175,235,0.16)] hover:border-[rgba(148,175,235,0.3)] rounded-xl p-4 shadow-md flex flex-col justify-between space-y-3 transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-sm text-[#e9eefb] line-clamp-2">
                              {client.company}
                            </h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#18213a] text-[#818cf8] border border-[#818cf8]/20 shrink-0">
                              {client.service} {client.level || ''}
                            </span>
                          </div>

                          {/* Contact Info */}
                          <div className="text-xs text-[#9aabcc]">
                            <div>{client.contactName}</div>
                            <div className="text-[11px] text-[#6d7c9c] truncate">
                              {client.email}
                            </div>
                          </div>

                          {/* Renewal Date & Countdown pill */}
                          <div className="pt-2 border-t border-[rgba(148,175,235,0.1)] space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-[#9aabcc]">
                              <span>Last Audit:</span>
                              <span className="font-mono text-[#e9eefb]">
                                {formatStandardDate(client.lastAppraisalDate)} ({cycleYears}y cycle)
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-[#9aabcc]">Renewal Due:</span>
                              <span className="font-mono font-semibold text-[#e9eefb]">
                                {formatStandardDate(renewalDate)}
                              </span>
                            </div>

                            {/* Status pill */}
                            <div className="pt-1">
                              {days < 0 ? (
                                <div className="px-2.5 py-1 rounded-lg bg-[#fb7185]/15 border border-[#fb7185]/30 text-[#fb7185] font-bold text-xs flex items-center justify-between">
                                  <span>Lapsed / Overdue</span>
                                  <span className="font-mono tabular-nums">
                                    {Math.abs(days)} days ago
                                  </span>
                                </div>
                              ) : days <= 90 ? (
                                <div className="px-2.5 py-1 rounded-lg bg-[#fbbf24]/15 border border-[#fbbf24]/30 text-[#fbbf24] font-bold text-xs flex items-center justify-between">
                                  <span>Due Soon</span>
                                  <span className="font-mono tabular-nums">
                                    {days} days remaining
                                  </span>
                                </div>
                              ) : days <= 180 ? (
                                <div className="px-2.5 py-1 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/20 text-[#22d3ee] font-medium text-xs flex items-center justify-between">
                                  <span>Upcoming</span>
                                  <span className="font-mono tabular-nums">{days} days left</span>
                                </div>
                              ) : (
                                <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-xs flex items-center justify-between">
                                  <span>Active & Compliant</span>
                                  <span className="font-mono tabular-nums">{days} days left</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card Bottom: Owner, Value, Action */}
                        <div className="pt-2.5 border-t border-[rgba(148,175,235,0.1)] flex items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-[#6d7c9c] block">
                              Owner: {client.owner}
                            </span>
                            <span className="font-bold font-mono text-[#e9eefb]">
                              {formatINR(client.contractValue)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openDraftModal({ type: 'client', entity: client })}
                              className="px-2.5 py-1.5 rounded-lg bg-[#18213a] hover:bg-indigo-500/20 text-[#818cf8] hover:text-[#e9eefb] border border-[rgba(148,175,235,0.15)] font-semibold transition-colors flex items-center gap-1"
                              title="Draft renewal reminder email"
                            >
                              <Mail size={13} />
                              <span>Draft</span>
                            </button>
                            <button
                              onClick={() => setActiveTab('clients')}
                              className="p-1.5 rounded-lg bg-[#18213a] text-[#9aabcc] hover:text-white transition-colors"
                              title="View client record"
                            >
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
