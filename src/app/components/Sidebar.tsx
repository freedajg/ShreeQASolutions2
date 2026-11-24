import React from 'react';
import {
  Briefcase,
  Building2,
  FileSpreadsheet,
  Globe,
  Kanban,
  LayoutDashboard,
  MessageSquareMore,
  Radar,
  ReceiptIndianRupee,
  Settings,
  SunMedium,
  X,
} from 'lucide-react';
import { AppView, TeamMember } from '../types/crm';
import { OUTREACH_LABEL } from '../features';
import { DrishtiEye } from '../../components/DrishtiEye';

interface SidebarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  currentUser: TeamMember;
  waitingDraftsCount: number;
  overdueRenewalsCount: number;
  quietLeadsCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeTone?: 'danger' | 'warn' | 'neutral';
  hidden?: boolean;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  currentUser,
  waitingDraftsCount,
  overdueRenewalsCount,
  quietLeadsCount,
  mobileOpen,
  onCloseMobile,
}) => {
  const isAdmin = currentUser.role === 'Owner/Admin';
  const isMarketing = currentUser.role === 'Marketing';
  const canSeeFinance =
    isAdmin || (currentUser.role === 'Consultant' && currentUser.canViewContractValues);

  const groups: NavGroup[] = [
    {
      heading: 'Workspace',
      items: [
        {
          id: 'today',
          label: 'Today',
          icon: SunMedium,
          badge: waitingDraftsCount,
          badgeTone: 'neutral',
          hidden: isMarketing,
        },
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
        },
        {
          id: 'radar',
          label: 'Renewal Radar',
          icon: Radar,
          badge: overdueRenewalsCount > 0 ? overdueRenewalsCount : undefined,
          badgeTone: 'danger',
          hidden: isMarketing,
        },
      ],
    },
    {
      heading: 'Pipeline & Outreach',
      items: [
        {
          id: 'pipeline',
          label: 'Sales Pipeline',
          icon: Kanban,
          badge: quietLeadsCount > 0 ? quietLeadsCount : undefined,
          badgeTone: 'warn',
        },
        {
          id: 'outreach',
          label: OUTREACH_LABEL,
          icon: MessageSquareMore,
          hidden: isMarketing,
        },
        {
          id: 'webcapture',
          label: 'Web Lead Form',
          icon: Globe,
        },
      ],
    },
    {
      heading: 'Delivery & Accounts',
      items: [
        {
          id: 'delivery',
          label: 'Delivery & Audits',
          icon: Briefcase,
          hidden: isMarketing,
        },
        {
          id: 'clients',
          label: isMarketing ? 'Leads Directory' : 'Clients & 30-Col DB',
          icon: Building2,
        },
        {
          id: 'invoicing',
          label: 'Invoicing',
          icon: ReceiptIndianRupee,
          hidden: !canSeeFinance,
        },
      ],
    },
    {
      heading: 'Administration',
      items: [
        {
          id: 'import',
          label: 'Excel Import',
          icon: FileSpreadsheet,
          hidden: !isAdmin,
        },
        {
          id: 'settings',
          label: 'Settings & Audit',
          icon: Settings,
          hidden: !isAdmin,
        },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col bg-surface border-r border-border">
      {/* Clean Brand Wordmark */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-wash">
            <DrishtiEye size={24} radar={false} />
          </div>
          <span className="font-display text-sm font-semibold tracking-tight text-text whitespace-nowrap">
            Drishti
          </span>
          <span className="text-muted text-xs" aria-hidden="true">
            /
          </span>
          <span className="text-xs text-muted truncate">SQAS</span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden rounded-md p-1.5 text-muted hover:bg-raised"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Grouped Minimal Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Main navigation">
        {groups.map((group) => {
          const visible = group.items.filter((i) => !i.hidden);
          if (visible.length === 0) return null;

          return (
            <div key={group.heading}>
              <div className="px-2.5 mb-1.5 text-[11px] font-medium text-muted">
                {group.heading}
              </div>
              <div className="space-y-0.5">
                {visible.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectView(item.id);
                        onCloseMobile();
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-raised text-text'
                          : 'text-text-secondary hover:bg-bg hover:text-text'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted'}`}
                        />
                        <span className="truncate whitespace-nowrap">{item.label}</span>
                      </span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`font-mono tabular-nums text-[11px] font-medium ${
                            item.badgeTone === 'danger'
                              ? 'text-danger'
                              : item.badgeTone === 'warn'
                                ? 'text-warning'
                                : 'text-muted'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Quiet Role Scope Summary */}
      <div className="border-t border-border px-4 py-3 text-[11px] text-muted">
        <div className="font-medium text-text-secondary">{currentUser.role}</div>
        <div className="mt-0.5 truncate">
          {currentUser.role === 'Marketing'
            ? 'Leads only · Values hidden'
            : currentUser.role === 'Consultant'
              ? currentUser.canViewContractValues
                ? 'Clients · Values enabled'
                : 'Clients · Values restricted'
              : 'Full access · Human send'}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-60 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-backdrop/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10">{sidebarContent}</aside>
        </div>
      )}
    </>
  );
};
