// Query keys (Phase 2, step 2-a). Every key holds the signed-in user's id: row-level security
// gives each user different rows for the same query, so a cached list must say whose it is.
// The cache is also cleared whenever the user changes (QueryCacheGuard).

export const STATUS_VIEWS = [
  'pipeline',
  'delivery',
  'active_clients',
  'closed',
  'needs_review',
] as const;

export type StatusView = (typeof STATUS_VIEWS)[number];

export const queryKeys = {
  statusView: (view: StatusView, userId: string) => [view, userId] as const,
  pipeline: (userId: string) => queryKeys.statusView('pipeline', userId),
  activeClients: (userId: string) => queryKeys.statusView('active_clients', userId),
  engagementFinancials: (userId: string, engagementIds?: readonly string[]) =>
    engagementIds
      ? (['engagement_financials', userId, [...engagementIds].sort()] as const)
      : (['engagement_financials', userId] as const),
  teamMembers: (userId: string) => ['team_members', userId] as const,
};
