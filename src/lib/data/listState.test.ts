import { describe, expect, it } from 'vitest';
import { LIST_MESSAGES, listState } from './listState';

const noData = { hasData: false, error: null };
const failed = { hasData: false, error: new Error('network') };
const loaded = { hasData: true, error: null };

describe('listState (step 2-g)', () => {
  it('is loading before the first read has answered', () => {
    expect(listState(noData, 0, 0)).toBe('loading');
  });

  it('is error when the first read failed', () => {
    expect(listState(failed, 0, 0)).toBe('error');
  });

  it('is empty when the read returned no rows, even with a search term', () => {
    expect(listState(loaded, 0, 0)).toBe('empty');
  });

  it('is no-match when rows exist but search or filters leave none', () => {
    expect(listState(loaded, 0, 7)).toBe('no-match');
  });

  it('is rows when some rows are shown', () => {
    expect(listState(loaded, 3, 7)).toBe('rows');
    expect(listState(loaded, 7, 7)).toBe('rows');
  });

  it('keeps showing rows when a background refetch fails after data arrived', () => {
    expect(listState({ hasData: true, error: new Error('network') }, 7, 7)).toBe('rows');
  });

  it('is empty, not error, when a refetch fails after an empty read', () => {
    expect(listState({ hasData: true, error: new Error('network') }, 0, 0)).toBe('empty');
  });
});

describe('LIST_MESSAGES (step 2-g)', () => {
  it('are the agreed texts, word for word, and nothing else', () => {
    // New in 2-g (agreed 22-Nov-2026), then the texts the screens already showed before 2-g.
    expect(LIST_MESSAGES).toEqual({
      pipelineEmpty: 'No open deals yet.',
      pipelineNoMatch: 'No deals match your search.',
      clearSearch: 'Clear search',
      clientsNoMatch: 'No clients match your search or filters.',
      clearSearchAndFilters: 'Clear search and filters',
      pipelineLoading: 'Loading pipeline…',
      clientsLoading: 'Loading clients…',
      clientsEmpty: 'No certified clients yet.',
      clientsEmptyMarketing: 'Certified clients are shown to Owners and Consultants.',
      tryAgain: 'Try again',
    });
  });
});
