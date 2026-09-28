import React, { useState } from 'react';
import {
  Sparkles,
  BarChart3,
  Radar,
  Kanban,
  Building2,
  FileSpreadsheet,
  Settings as SettingsIcon,
  Menu,
  X,
  UserCheck,
  ChevronDown,
} from 'lucide-react';
import { TabKey, UserProfile } from '../types';
import { TEAM_MEMBERS } from '../utils/seedData';
import { useCrm } from '../context/CrmContext';
import { DrishtiFace } from './DrishtiFace';

interface NavItem {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
}

export function Navbar() {
  const { activeTab, setActiveTab, activeUser, setActiveUser, clients, leads, isAiLoading } =
    useCrm();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  // Count overdue + due soon clients for radar badge
  const now = new Date();
  const radarAlertCount = clients.filter((c) => {
    const d = new Date(c.lastAppraisalDate);
    const cycle = c.service === 'CMMI' ? 3 : 1;
    d.setFullYear(d.getFullYear() + cycle);
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days <= 90;
  }).length;

  const navItems: NavItem[] = [
    { key: 'drishti', label: 'Drishti', icon: Sparkles },
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'radar', label: 'Renewal Radar', icon: Radar, badge: radarAlertCount },
    { key: 'pipeline', label: 'Pipeline', icon: Kanban, badge: leads.filter((l) => l.stage !== 'Won' && l.stage !== 'Lost').length },
    { key: 'clients', label: 'Clients', icon: Building2, badge: clients.length },
    { key: 'import', label: 'Import', icon: FileSpreadsheet },
    { key: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const mobilePrimaryItems: NavItem[] = [
    { key: 'drishti', label: 'Drishti', icon: Sparkles },
    { key: 'radar', label: 'Radar', icon: Radar, badge: radarAlertCount },
    { key: 'pipeline', label: 'Pipeline', icon: Kanban },
    { key: 'clients', label: 'Clients', icon: Building2 },
  ];

  const mobileMoreItems: NavItem[] = [
    { key: 'dashboard', label: 'Executive Dashboard', icon: BarChart3 },
    { key: 'import', label: 'Import Excel / CSV', icon: FileSpreadsheet },
    { key: 'settings', label: 'API Keys & Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Desktop Header Rail */}
      <header className="sticky top-0 z-40 w-full bg-[#080c16]/90 backdrop-blur-md border-b border-[rgba(148,175,235,0.14)]">
        {/* Glow indicator line at top */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#818cf8]/50 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Assistant Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setActiveTab('drishti')}
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              <DrishtiFace
                state={isAiLoading ? 'thinking' : 'idle'}
                size="sm"
                className="transition-transform group-hover:scale-105"
              />
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base tracking-tight text-[#e9eefb] group-hover:text-white">
                    Drishti
                  </span>
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-indigo-500/20 text-[#818cf8] border border-indigo-500/30">
                    CRM Partner
                  </span>
                </div>
                <p className="text-[11px] text-[#6d7c9c] truncate hidden sm:block">
                  Process Standards Consulting
                </p>
              </div>
            </button>
          </div>

          {/* Desktop Navigation Tabs (Hidden <768px) */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  id={`nav-tab-${item.key}`}
                  onClick={() => setActiveTab(item.key)}
                  className={`relative px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-2 min-h-[38px] ${
                    isActive
                      ? 'text-[#e9eefb] bg-[#18213a] shadow-inner font-semibold'
                      : 'text-[#9aabcc] hover:text-[#e9eefb] hover:bg-[#111828]'
                  }`}
                >
                  <Icon
                    size={15}
                    className={
                      isActive
                        ? item.key === 'drishti'
                          ? 'text-[#a78bfa]'
                          : 'text-[#818cf8]'
                        : 'text-[#6d7c9c]'
                    }
                  />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] rounded-full tabular-nums ${
                        item.key === 'radar' && radarAlertCount > 0
                          ? 'bg-[#fb7185]/20 text-[#fb7185] border border-[#fb7185]/30'
                          : 'bg-[#18213a] text-[#9aabcc]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Active lit underline */}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-[#818cf8] to-[#22d3ee] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Active User Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111828] border border-[rgba(148,175,235,0.14)] hover:border-[rgba(148,175,235,0.3)] transition-colors text-xs text-[#e9eefb]"
              aria-label="Switch active user"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#818cf8] to-[#22d3ee] flex items-center justify-center text-[11px] font-bold text-slate-950">
                {activeUser.name[0]}
              </div>
              <div className="text-left hidden sm:block">
                <span className="font-semibold">{activeUser.name}</span>
                <span className="text-[10px] text-[#6d7c9c] ml-1.5">({activeUser.role})</span>
              </div>
              <ChevronDown size={13} className="text-[#6d7c9c]" />
            </button>

            {isUserDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#18213a] border border-[rgba(148,175,235,0.2)] rounded-xl shadow-2xl z-50 p-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6d7c9c]">
                  Active Team Member
                </div>
                {TEAM_MEMBERS.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      setActiveUser(member);
                      setIsUserDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                      activeUser.id === member.id
                        ? 'bg-indigo-500/20 text-[#e9eefb] font-semibold'
                        : 'text-[#9aabcc] hover:bg-[#111828] hover:text-[#e9eefb]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#111828] border border-[rgba(148,175,235,0.2)] flex items-center justify-center text-[10px]">
                        {member.name[0]}
                      </div>
                      <span>{member.name}</span>
                    </div>
                    <span className="text-[10px] text-[#6d7c9c]">{member.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar (<768px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#080c16]/95 backdrop-blur-lg border-t border-[rgba(148,175,235,0.14)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around px-2 py-1">
          {mobilePrimaryItems.map((item) => {
            const isActive = activeTab === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  setIsMoreOpen(false);
                }}
                className={`relative flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-2 py-1 rounded-xl text-[11px] transition-all ${
                  isActive ? 'text-[#818cf8] font-bold' : 'text-[#6d7c9c]'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-[#818cf8]' : 'text-[#6d7c9c]'} />
                <span className="mt-0.5">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute top-1 right-2.5 px-1 py-0.2 text-[9px] font-bold rounded-full bg-[#fb7185] text-slate-950 tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* More Sheet Trigger */}
          <button
            onClick={() => setIsMoreOpen(true)}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-2 py-1 rounded-xl text-[11px] ${
              ['dashboard', 'import', 'settings'].includes(activeTab) || isMoreOpen
                ? 'text-[#818cf8] font-bold'
                : 'text-[#6d7c9c]'
            }`}
          >
            <Menu size={18} />
            <span className="mt-0.5">More</span>
          </button>
        </div>
      </div>

      {/* Mobile More Sheet Drawer */}
      {isMoreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="bg-[#111828] border-t border-[rgba(148,175,235,0.2)] rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(148,175,235,0.14)]">
              <span className="text-sm font-bold text-[#e9eefb]">Navigation & Options</span>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 text-[#6d7c9c] hover:text-white rounded-lg bg-[#18213a]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-1.5">
              {mobileMoreItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActiveTab(item.key);
                      setIsMoreOpen(false);
                    }}
                    className={`w-full min-h-[52px] flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-500/20 text-[#818cf8] font-bold'
                        : 'text-[#9aabcc] hover:bg-[#18213a] hover:text-[#e9eefb]'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-[#818cf8]' : 'text-[#6d7c9c]'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active User in Mobile Sheet */}
            <div className="mt-6 pt-4 border-t border-[rgba(148,175,235,0.14)]">
              <div className="text-xs font-semibold text-[#6d7c9c] uppercase tracking-wider mb-2">
                Viewing as
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TEAM_MEMBERS.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      setActiveUser(member);
                    }}
                    className={`min-h-[44px] flex items-center gap-2 p-2.5 rounded-xl text-xs transition-colors border ${
                      activeUser.id === member.id
                        ? 'bg-indigo-500/20 text-[#e9eefb] border-indigo-500/40 font-bold'
                        : 'bg-[#18213a] text-[#9aabcc] border-transparent'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center font-bold text-[10px]">
                      {member.name[0]}
                    </div>
                    <span>{member.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
