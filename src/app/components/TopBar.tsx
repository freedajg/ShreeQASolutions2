import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Command, LogOut, Mail, Menu, Monitor, Moon, Sun } from 'lucide-react';
import { AppView, TeamMember, ThemePreference } from '../types/crm';
import { formatDateDDMMMYYYY } from '../utils/formatters';

interface TopBarProps {
  activeView: AppView;
  referenceDate: string;
  currentUser: TeamMember;
  themePref: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  onChangeTheme: (pref: ThemePreference) => void;
  onOpenMobileMenu: () => void;
  onOpenProfile: () => void;
  onOpenCommandPalette: () => void;
  onSignOut: () => void;
}

const VIEW_TITLES: Record<AppView, string> = {
  today: 'Today Queue',
  dashboard: 'Executive Dashboard',
  radar: 'Renewal Radar',
  pipeline: 'Sales Pipeline',
  outreach: 'WhatsApp & Calls',
  webcapture: 'Website Lead Intake',
  delivery: 'Delivery & Audit Workroom',
  clients: 'Clients & 30-Col Database',
  invoicing: 'Invoicing',
  import: 'Excel Import',
  settings: 'Settings & Audit Log',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  referenceDate,
  currentUser,
  themePref,
  resolvedTheme,
  onChangeTheme,
  onOpenMobileMenu,
  onOpenProfile,
  onOpenCommandPalette,
  onSignOut,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOneClickThemeToggle = () => {
    onChangeTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/90 backdrop-blur-md px-4 lg:px-6">
      {/* Left: Mobile Trigger + Clean Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden rounded-lg p-1.5 text-text-secondary hover:bg-raised"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-display text-[15px] font-semibold text-text truncate">
            {VIEW_TITLES[activeView]}
          </h1>
          <span className="hidden sm:inline text-xs font-mono tabular-nums text-muted whitespace-nowrap">
            · {formatDateDDMMMYYYY(referenceDate)} IST
          </span>
        </div>
      </div>

      {/* Right: Quick Search (Cmd+K), Theme Toggle, Profile */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden md:inline-flex items-center gap-2 rounded-lg border border-border bg-bg/70 px-3 py-1.5 text-xs text-muted hover:text-text hover:border-border-strong transition-colors whitespace-nowrap"
        >
          <span>Quick jump...</span>
          <kbd className="inline-flex items-center gap-0.5 font-mono text-[10px] text-muted">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        <button
          type="button"
          onClick={handleOneClickThemeToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-bg hover:text-text transition-colors shrink-0"
          aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={`Theme: ${themePref} (click to toggle)`}
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1 text-left hover:bg-bg transition-colors shrink-0"
            aria-expanded={menuOpen}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-on-primary font-display text-[11px] font-semibold shrink-0">
              {currentUser.initials}
            </span>
            <span className="hidden sm:block text-xs font-medium text-text whitespace-nowrap">
              {currentUser.name.split(' ')[0]}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-surface shadow-xl py-2 z-50">
              <div className="px-3.5 py-2 border-b border-border">
                <div className="text-sm font-semibold text-text">{currentUser.name}</div>
                <div className="text-xs text-muted truncate">
                  {currentUser.role} · {currentUser.email}
                </div>
              </div>

              <div className="px-3.5 py-2.5 border-b border-border">
                <div className="text-[11px] font-medium text-muted mb-1.5">Theme Preference</div>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-raised p-1">
                  {(['light', 'dark', 'system'] as ThemePreference[]).map((opt) => {
                    const Icon = opt === 'light' ? Sun : opt === 'dark' ? Moon : Monitor;
                    const active = themePref === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onChangeTheme(opt)}
                        className={`flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors ${
                          active
                            ? 'bg-surface text-text shadow-xs'
                            : 'text-text-secondary hover:text-text'
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-2 pt-1.5 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-text-secondary hover:bg-raised transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted" />
                    <span>My Profile & Outlook</span>
                  </span>
                  {currentUser.role !== 'Marketing' && (
                    <span
                      className={`text-[11px] font-medium ${
                        currentUser.outlookConnected ? 'text-success' : 'text-warning'
                      }`}
                    >
                      {currentUser.outlookConnected ? 'Connected' : 'Connect'}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-text-secondary hover:bg-raised transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5 text-muted" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
