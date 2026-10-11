// When to empty the query cache (Phase 2, step 2-a), so one user's data never shows to the
// next person who signs in on this browser.
import type { QueryClient } from '@tanstack/react-query';
import type { AuthState } from '../auth/context';

/**
 * The signed-in user's id, null when nobody is signed in, or undefined while the first
 * sign-in check is still running (no decision yet).
 */
export function userIdOf(state: AuthState): string | null | undefined {
  if (state.status === 'loading') return undefined;
  return state.status === 'signed-in' ? state.user.id : null;
}

/**
 * `previous` is undefined before any decision has been seen. Clears on sign-out (A → null),
 * on sign-in after a sign-out (null → B) and when another user takes over (A → B).
 */
export function shouldClearCache(
  previous: string | null | undefined,
  next: string | null,
): boolean {
  return previous !== undefined && previous !== next;
}

/** Stops requests in flight, then removes every cached entry (no refetch under the old key). */
export async function clearQueryCache(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
}
