// Empties the query cache whenever the signed-in user changes, including sign-out (Phase 2,
// step 2-a). Renders nothing; sits inside both QueryClientProvider and AuthProvider.
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/context';
import { clearQueryCache, shouldClearCache, userIdOf } from './cache';

export function QueryCacheGuard() {
  const queryClient = useQueryClient();
  const { state } = useAuth();
  const lastUserId = useRef<string | null | undefined>(undefined);
  const userId = userIdOf(state);

  useEffect(() => {
    if (userId === undefined) return;
    if (shouldClearCache(lastUserId.current, userId)) {
      // Started, not awaited: nothing waits on it, and clearing can't fail in a way to show.
      void clearQueryCache(queryClient);
    }
    lastUserId.current = userId;
  }, [userId, queryClient]);

  return null;
}
