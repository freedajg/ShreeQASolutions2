// Which state a list screen (Pipeline, Clients) is in, and the texts it shows (step 2-g).
// Error texts stay in ./errors.ts; these are the non-error states.
//
// No "retrying" state: when a query that has no data is fetched again (Try again), TanStack
// Query v5 clears its error and puts it back to pending (query-core `fetchState`), so the
// screen shows its loading line again by itself.

export type ListState = 'loading' | 'error' | 'empty' | 'no-match' | 'rows';

export interface ListQuery {
  /** The first read has succeeded (data kept even if a later refetch fails). */
  hasData: boolean;
  /** The query's error, if any. */
  error: unknown;
}

/**
 * `totalCount`: rows the read returned; `shownCount`: rows left after search and filters.
 * Once data has arrived, a failed background refetch keeps the old rows on screen ('rows');
 * nothing is shown about it in 2-g (later list).
 */
export function listState(query: ListQuery, shownCount: number, totalCount: number): ListState {
  if (!query.hasData) return query.error ? 'error' : 'loading';
  if (totalCount === 0) return 'empty';
  if (shownCount === 0) return 'no-match';
  return 'rows';
}

export const LIST_MESSAGES = {
  pipelineLoading: 'Loading pipeline…',
  pipelineEmpty: 'No open deals yet.',
  pipelineNoMatch: 'No deals match your search.',
  clearSearch: 'Clear search',
  clientsLoading: 'Loading clients…',
  clientsEmpty: 'No certified clients yet.',
  clientsEmptyMarketing: 'Certified clients are shown to Owners and Consultants.',
  clientsNoMatch: 'No clients match your search or filters.',
  clearSearchAndFilters: 'Clear search and filters',
  tryAgain: 'Try again',
} as const;
