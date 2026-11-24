import { describe, expect, it } from 'vitest';
import { createQueryClient, shouldRetry } from './queryClient';

const pg = (code: string, message: string) => ({ code, message, details: '', hint: '' });
const NETWORK = pg('', 'TypeError: Failed to fetch');

describe('shouldRetry', () => {
  it('retries a network error twice, then stops', () => {
    expect(shouldRetry(0, NETWORK)).toBe(true);
    expect(shouldRetry(1, NETWORK)).toBe(true);
    expect(shouldRetry(2, NETWORK)).toBe(false);
  });

  it('never retries an answer from the database', () => {
    for (const error of [
      pg('42501', "Engagement not found, or you can't change its status"),
      pg('22023', 'Unknown status'),
      pg('PGRST301', 'JWT expired'),
      pg('XX000', 'internal'),
      null,
    ]) {
      expect(shouldRetry(0, error)).toBe(false);
    }
  });
});

describe('createQueryClient', () => {
  it('sets the agreed defaults', () => {
    const { queries, mutations } = createQueryClient().getDefaultOptions();
    expect(queries?.retry).toBe(shouldRetry);
    expect(queries?.staleTime).toBe(30_000);
    expect(queries?.refetchOnWindowFocus).toBe(true);
    expect(mutations?.retry).toBe(0);
  });

  it('gives each call its own cache', () => {
    const first = createQueryClient();
    const second = createQueryClient();
    first.setQueryData(['pipeline', 'user-a'], [{ id: '1' }]);
    expect(second.getQueryData(['pipeline', 'user-a'])).toBeUndefined();
  });
});
