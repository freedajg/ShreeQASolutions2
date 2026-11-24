// Page addresses for the screens (PLAN Phase 2 "pages"): /today, /radar, /clients, … so the
// browser's Back button, reloads and shared links work. No router package: the app has one
// level of pages, and the address is only a pointer to a screen, never data.
import { useCallback, useEffect, useState } from 'react';
import type { AppView } from './types/crm';

export const VIEWS: readonly AppView[] = [
  'today',
  'dashboard',
  'radar',
  'pipeline',
  'delivery',
  'clients',
  'outreach',
  'invoicing',
  'webcapture',
  'import',
  'settings',
];

/** The screen named by an address like "/radar", or null for "/" and unknown paths. */
export function viewFromPath(pathname: string): AppView | null {
  const name = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  return (VIEWS as readonly string[]).includes(name) ? (name as AppView) : null;
}

export function useViewRoute(fallback: AppView): [AppView, (view: AppView) => void] {
  const [view, setViewState] = useState<AppView>(
    () => viewFromPath(window.location.pathname) ?? fallback,
  );

  useEffect(() => {
    const onPop = () => setViewState(viewFromPath(window.location.pathname) ?? fallback);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [fallback]);

  const setView = useCallback((next: AppView) => {
    setViewState(next);
    if (viewFromPath(window.location.pathname) !== next) {
      window.history.pushState({}, '', `/${next}`);
    }
  }, []);

  return [view, setView];
}
