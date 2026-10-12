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
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';
import { TabKey, UserProfile } from '../types';
import { TEAM_MEMBERS } from '../utils/seedData';
import { useCrm } from '../context/CrmContext';
import { useAuth, useSignedInUser } from '../lib/auth/context';
import { useTheme } from '../lib/useTheme';
import { LANDING_SCREEN, isScreenEnabled } from '../lib/screens';
import { countOnBoard } from '../lib/data/mappers';
import { useActiveClients, usePipelineEngagements } from '../lib/data/hooks';
import type { ThemePreference } from '../lib/theme';
import { DrishtiFace } from './DrishtiFace';

interface NavItem {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

// Light / Dark / System picker, used in the user dropdown and the phone menu.
function ThemeChoice({
  preference,
  onChange,
  buttonClassName,
}: {
  preference: ThemePreference;
  onChange: (value: ThemePreference) => void;
  buttonClassName: string;
}) {
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1">
      {THEME_OPTIONS.map((option) => {
        const isActive = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={`${buttonClassName} rounded-lg border transition-colors ${
              isActive
                ? 'bg-primary-tint/20 text-text border-primary-tint/40 font-semibold'
                : 'bg-surface text-text-secondary border-line/14 hover:text-text'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Navbar() {
  const { activeTab, setActiveTab, activeUser, setActiveUser, clients, isAiLoading } = useCrm();
  // Pipeline and Clients badges count the same rows as those screens (step 2-b). No Pipeline
  // badge while the board is loading or couldn't be read (step 2-c); the same for Clients (2-d).
  const { data: onBoard } = usePipelineEngagements();
  const pipelineCount = onBoard ? countOnBoard(onBoard) : undefined;
  const { data: activeClients } = useActiveClients();
  const activeClientCount = activeClients?.length;
  const { preference, theme, setPreference, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const signedInUser = useSignedInUser();
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

  // Hidden screens (src/lib/screens.ts) get no nav item anywhere.
  const shown = (item: NavItem) => isScreenEnabled(item.key);

  const navItems: NavItem[] = (
    [
      { key: 'drishti', label: 'Drishti', icon: Sparkles },
      { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
      { key: 'radar', label: 'Renewal Radar', icon: Radar, badge: radarAlertCount },
      {
        key: 'pipeline',
        label: 'Pipeline',
        icon: Kanban,
        badge: pipelineCount,
      },
      { key: 'clients', label: 'Clients', icon: Building2, badge: activeClientCount },
      { key: 'import', label: 'Import', icon: FileSpreadsheet },
      { key: 'settings', label: 'Settings', icon: SettingsIcon },
    ] satisfies NavItem[]
  ).filter(shown);

  const mobilePrimaryItems: NavItem[] = (
    [
      { key: 'drishti', label: 'Drishti', icon: Sparkles },
      { key: 'radar', label: 'Radar', icon: Radar, badge: radarAlertCount },
      { key: 'pipeline', label: 'Pipeline', icon: Kanban },
      { key: 'clients', label: 'Clients', icon: Building2 },
    ] satisfies NavItem[]
  ).filter(shown);

  const mobileMoreItems: NavItem[] = (
    [
      { key: 'dashboard', label: 'Executive Dashboard', icon: BarChart3 },
      { key: 'import', label: 'Import Excel / CSV', icon: FileSpreadsheet },
      { key: 'settings', label: 'API Keys & Settings', icon: SettingsIcon },
    ] satisfies NavItem[]
  ).filter(shown);

  return (
    <>
      {/* Desktop Header Rail */}
      <header className="sticky top-0 z-40 w-full bg-bg/90 backdrop-blur-md border-b border-line/14">
        {/* Glow indicator line at top */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Assistant Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setActiveTab(LANDING_SCREEN)}
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              <DrishtiFace
                state={isAiLoading ? 'thinking' : 'idle'}
                size="sm"
                className="transition-transform group-hover:scale-105"
              />
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base tracking-tight text-text group-hover:text-text-strong">
                    Drishti
                  </span>
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-primary-tint/20 text-primary border border-primary-tint/30">
                    CRM Partner
                  </span>
                </div>
                <p className="text-[11px] text-muted truncate hidden sm:block">
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
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveTab(item.key)}
                  className={`relative px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-2 min-h-[38px] ${
                    isActive
                      ? 'text-text bg-raised shadow-inner font-semibold'
                      : 'text-text-secondary hover:text-text hover:bg-surface'
                  }`}
                >
                  <Icon
                    size={15}
                    className={
                      isActive
                        ? item.key === 'drishti'
                          ? 'text-primary-soft'
                          : 'text-primary'
                        : 'text-muted'
                    }
                  />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] rounded-full tabular-nums ${
                        item.key === 'radar' && radarAlertCount > 0
                          ? 'bg-danger/20 text-danger border border-danger/30'
                          : 'bg-raised text-text-secondary'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Active lit underline */}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-primary to-info rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {/* Theme toggle: one click switches Light <-> Dark */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface border border-line/14 hover:border-line/30 text-text-secondary hover:text-text transition-colors"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Active User Switcher */}
            <div className="relative">
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-line/14 hover:border-line/30 transition-colors text-xs text-text"
                aria-label="Switch active user"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-info flex items-center justify-center text-[11px] font-bold text-on-primary">
                  {activeUser.name[0]}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="font-semibold">{activeUser.name}</span>
                  <span className="text-[10px] text-muted ml-1.5">({activeUser.role})</span>
                </div>
                <ChevronDown size={13} className="text-muted" />
              </button>

              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-raised border border-line/20 rounded-xl shadow-2xl z-50 p-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
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
                          ? 'bg-primary-tint/20 text-text font-semibold'
                          : 'text-text-secondary hover:bg-surface hover:text-text'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-surface border border-line/20 flex items-center justify-center text-[10px]">
                          {member.name[0]}
                        </div>
                        <span>{member.name}</span>
                      </div>
                      <span className="text-[10px] text-muted">{member.role}</span>
                    </button>
                  ))}

                  <div className="mt-1 pt-1 border-t border-line/14">
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Theme
                    </div>
                    <div className="px-1 pb-1">
                      <ThemeChoice
                        preference={preference}
                        onChange={setPreference}
                        buttonClassName="py-1.5 text-[11px]"
                      />
                    </div>
                  </div>

                  {/* Signed-in account (step 12) */}
                  <div className="mt-1 pt-1 border-t border-line/14">
                    <div className="px-3 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Signed in as
                    </div>
                    <div className="px-3 pb-1 text-xs text-text truncate">
                      {signedInUser.fullName}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        void signOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-secondary hover:bg-surface hover:text-text transition-colors"
                    >
                      <LogOut size={13} className="text-muted" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar (<768px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg/95 backdrop-blur-lg border-t border-line/14 pb-[env(safe-area-inset-bottom)]">
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
                  isActive ? 'text-primary font-bold' : 'text-muted'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-primary' : 'text-muted'} />
                <span className="mt-0.5">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute top-1 right-2.5 px-1 py-0.2 text-[9px] font-bold rounded-full bg-danger text-on-primary tabular-nums">
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
              mobileMoreItems.some((item) => item.key === activeTab) || isMoreOpen
                ? 'text-primary font-bold'
                : 'text-muted'
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
          className="md:hidden fixed inset-0 z-50 bg-backdrop/70 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="bg-surface border-t border-line/20 rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-line/14">
              <span className="text-sm font-bold text-text">Navigation & Options</span>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 text-muted hover:text-text-strong rounded-lg bg-raised"
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
                        ? 'bg-primary-tint/20 text-primary font-bold'
                        : 'text-text-secondary hover:bg-raised hover:text-text'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-primary' : 'text-muted'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active User in Mobile Sheet */}
            <div className="mt-6 pt-4 border-t border-line/14">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
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
                        ? 'bg-primary-tint/20 text-text border-primary-tint/40 font-bold'
                        : 'bg-raised text-text-secondary border-transparent'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-avatar flex items-center justify-center font-bold text-[10px]">
                      {member.name[0]}
                    </div>
                    <span>{member.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme in Mobile Sheet */}
            <div className="mt-6 pt-4 border-t border-line/14">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Theme
              </div>
              <ThemeChoice
                preference={preference}
                onChange={setPreference}
                buttonClassName="min-h-[44px] text-xs"
              />
            </div>

            {/* Signed-in account in Mobile Sheet (step 12) */}
            <div className="mt-6 pt-4 border-t border-line/14">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Signed in as
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-text truncate">{signedInUser.fullName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    void signOut();
                  }}
                  className="min-h-[44px] flex items-center gap-2 px-4 rounded-xl text-xs font-medium bg-raised text-text-secondary hover:text-text transition-colors"
                >
                  <LogOut size={15} className="text-muted" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
