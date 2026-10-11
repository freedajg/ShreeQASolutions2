import { describe, expect, it } from 'vitest';
import { DATA_MESSAGES, DataError, dataErrorMessage, isNetworkError, toDataError } from './errors';

// The exact texts raised by change_engagement_status() and the step 8 row rules.
const pg = (code: string, message: string) => ({ code, message, details: '', hint: '' });

describe('toDataError: change_engagement_status cases (step 14)', () => {
  it('maps the five database refusals to their own kind and message', () => {
    const cases: [ReturnType<typeof pg>, string][] = [
      [pg('42501', "You don't have access to change statuses"), 'no-access'],
      [pg('22023', 'Unknown status'), 'unknown-status'],
      [pg('42501', "Engagement not found, or you can't change its status"), 'not-allowed'],
      [pg('22023', 'The engagement already has that status'), 'same-status'],
      [pg('42501', 'new row violates row-level security policy for table "engagements"'), 'rls'],
    ];
    for (const [input, kind] of cases) {
      const error = toDataError(input);
      expect(error).toBeInstanceOf(DataError);
      expect(error.kind).toBe(kind);
      expect(error.code).toBe(input.code);
      expect(error.message).toBe(DATA_MESSAGES[error.kind]);
    }
  });

  it('uses general wording for a row-level security refusal', () => {
    expect(dataErrorMessage(pg('42501', 'new row violates row-level security policy'))).toBe(
      "You can't move this engagement to that status.",
    );
  });

  it('falls back to the per-code message for other 42501 and 22023 errors', () => {
    expect(toDataError(pg('42501', 'permission denied for table clients')).kind).toBe('forbidden');
    expect(toDataError(pg('22023', 'something else')).kind).toBe('invalid');
  });
});

describe('toDataError: session, network and unknown', () => {
  it('treats an expired login as a session error', () => {
    expect(toDataError(pg('PGRST301', 'JWSError')).kind).toBe('session');
    expect(toDataError(pg('PGRST303', 'JWT expired')).kind).toBe('session');
    expect(toDataError(pg('', 'Unauthorized'), 401).kind).toBe('session');
  });

  it('recognises network failures, thrown or reported by supabase-js', () => {
    expect(toDataError(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(toDataError(new TypeError('NetworkError when attempting to fetch resource.')).kind).toBe(
      'network',
    );
    expect(toDataError(new TypeError('Load failed')).kind).toBe('network');
    expect(toDataError(pg('', 'TypeError: Failed to fetch')).kind).toBe('network');
    expect(isNetworkError(pg('', 'TypeError: Failed to fetch'))).toBe(true);
    expect(isNetworkError(pg('42501', 'Failed to fetch'))).toBe(false);
  });

  it('falls back to unknown for anything else', () => {
    for (const input of [
      null,
      undefined,
      'oops',
      42,
      {},
      pg('XX000', 'internal'),
      new Error('x'),
    ]) {
      expect(toDataError(input).kind).toBe('unknown');
    }
    expect(dataErrorMessage(null)).toBe('Something went wrong. Please try again.');
  });

  it('passes an existing DataError through unchanged', () => {
    const error = new DataError('network');
    expect(toDataError(error)).toBe(error);
  });

  it('never echoes the raw database text', () => {
    const raw = pg('XX000', 'failed for demo.owner@example.test with value ₹5,00,000');
    const message = dataErrorMessage(raw);
    expect(message).not.toContain('example.test');
    expect(message).not.toContain('5,00,000');
    expect(dataErrorMessage(pg('42501', raw.message))).not.toContain('example.test');
  });
});
