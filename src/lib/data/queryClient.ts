// TanStack Query settings for the whole app (Phase 2, step 2-a). TanStack is the only retry
// layer: every data call turns supabase-js's own retries off with `.retry(false)`.
import { QueryClient } from '@tanstack/react-query';
import { isNetworkError } from './errors';

// 2 retries = 3 tries in total, about 3 s before the screen shows the error.
const MAX_NETWORK_RETRIES = 2;

/**
 * Retries only when the server couldn't be reached. A database answer (42501, 22023, any
 * code) is a decision: asking again gets the same answer, just later.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return isNetworkError(error) && failureCount < MAX_NETWORK_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        // Lists change rarely and only through the app; status changes invalidate at once.
        staleTime: 30_000,
        // Realtime is off: coming back to a window is how a second browser sees changes.
        refetchOnWindowFocus: true,
      },
      mutations: {
        // Never repeat a change blindly: a retry after a lost response would report
        // "already has that status" for a move that worked.
        retry: 0,
      },
    },
  });
}
