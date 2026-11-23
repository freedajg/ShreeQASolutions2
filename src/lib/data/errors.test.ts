import { describe, expect, it } from 'vitest';
import {
  DATA_MESSAGES,
  DataError,
  dataErrorMessage,
  isNetworkError,
  toDataError,
  toSaveError,
} from './errors';

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

describe('toSaveError: saving a form (Add and Edit)', () => {
  it('a duplicate Client ID gets its own message; any other duplicate means changed meanwhile', () => {
    const code = toSaveError(
      pg('23505', 'duplicate key value violates unique constraint "clients_client_code_key"'),
    );
    expect(code.kind).toBe('duplicate-code');
    expect(code.message).toBe('That Client ID is already used by another client.');
    expect(
      toSaveError(pg('23505', 'duplicate key value violates "engagement_financials_pkey"')).kind,
    ).toBe('changed-or-refused');
  });

  it('a refused check, number or date is invalid data', () => {
    for (const code of ['23514', '22P02', '22003', '22007', '22008']) {
      const error = toSaveError(pg(code, 'new row for relation "clients" violates check'));
      expect(error.kind, code).toBe('invalid-data');
      expect(error.message).toBe(DATA_MESSAGES['invalid-data']);
    }
  });

  it('an unknown lookup value is an unavailable choice', () => {
    const error = toSaveError(pg('23503', 'violates foreign key constraint'));
    expect(error.kind).toBe('unknown-choice');
    expect(error.message).toBe(DATA_MESSAGES['unknown-choice']);
  });

  it('every 42501 is a refused save, whichever rule refused it, without the raw text', () => {
    for (const message of [
      'new row violates row-level security policy for table "clients"',
      'permission denied for column created_by',
      "Only an Owner can change an engagement's creator, client or owner",
    ]) {
      const error = toSaveError(pg('42501', message));
      expect(error.kind, message).toBe('save-refused');
      expect(error.message).toBe("You don't have permission to save this change.");
    }
  });

  it('leaves session, network and unknown errors to toDataError, and the move messages unchanged', () => {
    expect(toSaveError(pg('PGRST303', 'JWT expired')).kind).toBe('session');
    expect(toSaveError(pg('', 'TypeError: Failed to fetch')).kind).toBe('network');
    expect(toSaveError(pg('XX000', 'internal')).kind).toBe('unknown');
    expect(toDataError(pg('42501', 'new row violates row-level security policy')).kind).toBe('rls');
    expect(DATA_MESSAGES.rls).toBe("You can't move this engagement to that status.");
    expect(DATA_MESSAGES['changed-or-refused']).toBe(
      "This record was changed by someone else, or you can't edit it. Close and open it again to see the latest.",
    );
  });
});
