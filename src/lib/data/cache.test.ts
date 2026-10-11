import { describe, expect, it } from 'vitest';
import { clearQueryCache, shouldClearCache, userIdOf } from './cache';
import { createQueryClient } from './queryClient';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';

describe('shouldClearCache', () => {
  it('does nothing on the first decision or when the user stays the same', () => {
    expect(shouldClearCache(undefined, A)).toBe(false);
    expect(shouldClearCache(undefined, null)).toBe(false);
    expect(shouldClearCache(A, A)).toBe(false);
    expect(shouldClearCache(null, null)).toBe(false);
  });

  it('clears on sign-out, on sign-in after a sign-out and when another user takes over', () => {
    expect(shouldClearCache(A, null)).toBe(true);
    expect(shouldClearCache(null, B)).toBe(true);
    expect(shouldClearCache(A, B)).toBe(true);
  });
});

describe('userIdOf', () => {
  it('reads the user id only when signed in', () => {
    const user = { id: A, fullName: 'Demo Owner 1', role: 'owner' as const, canSeeValues: true };
    expect(userIdOf({ status: 'signed-in', user })).toBe(A);
    expect(userIdOf({ status: 'signed-out' })).toBeNull();
    expect(userIdOf({ status: 'signed-out', notice: 'x' })).toBeNull();
    expect(userIdOf({ status: 'not-configured', problem: 'x' })).toBeNull();
    expect(userIdOf({ status: 'loading' })).toBeUndefined();
  });
});

describe('clearQueryCache', () => {
  it('removes every cached entry', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['pipeline', A], [{ id: '1' }]);
    queryClient.setQueryData(['team_members', A], [{ id: A }]);
    await clearQueryCache(queryClient);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(queryClient.getQueryData(['pipeline', A])).toBeUndefined();
  });
});
