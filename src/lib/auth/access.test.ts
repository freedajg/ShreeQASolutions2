import { describe, expect, it } from 'vitest';
import { MESSAGES, decideAccess, loginErrorMessage, roleLabel, type ProfileRow } from './access';

const row = (overrides: Partial<ProfileRow> = {}): ProfileRow => ({
  id: '5eed0001-0000-4000-8000-000000000001',
  full_name: 'Demo Owner 1',
  role: 'owner',
  can_see_values: false,
  active: true,
  ...overrides,
});

describe('decideAccess', () => {
  it('gives no access without a profile row (inactive users get none through RLS)', () => {
    expect(decideAccess(null)).toEqual({ ok: false });
    expect(decideAccess(undefined)).toEqual({ ok: false });
  });

  it('gives no access to a role-less, unknown-role or inactive profile', () => {
    expect(decideAccess(row({ role: null }))).toEqual({ ok: false });
    expect(decideAccess(row({ role: 'admin' }))).toEqual({ ok: false });
    expect(decideAccess(row({ active: false }))).toEqual({ ok: false });
    expect(decideAccess(row({ active: null }))).toEqual({ ok: false });
  });

  it('signs in each role with its values access', () => {
    // An Owner sees values even with the profile flag off, as in the seed (seed.sql line 362)
    // and as app.can_see_values() decides (20261003161427_profiles_roles.sql line 84).
    expect(decideAccess(row())).toEqual({
      ok: true,
      user: {
        id: '5eed0001-0000-4000-8000-000000000001',
        fullName: 'Demo Owner 1',
        role: 'owner',
        canSeeValues: true,
      },
    });
    const consultant = decideAccess(row({ role: 'consultant', can_see_values: true }));
    expect(consultant.ok && consultant.user.role).toBe('consultant');
    expect(consultant.ok && consultant.user.canSeeValues).toBe(true);
    const marketing = decideAccess(row({ role: 'marketing', can_see_values: null }));
    expect(marketing.ok && marketing.user.role).toBe('marketing');
    expect(marketing.ok && marketing.user.canSeeValues).toBe(false);
  });

  it('follows app.can_see_values(): Consultants only with the flag, Marketing never (step 2-f)', () => {
    const access = (overrides: Partial<ProfileRow>) => {
      const result = decideAccess(row(overrides));
      return result.ok && result.user.canSeeValues;
    };
    expect(access({ role: 'owner', can_see_values: null })).toBe(true);
    expect(access({ role: 'consultant', can_see_values: false })).toBe(false);
    expect(access({ role: 'consultant', can_see_values: null })).toBe(false);
    expect(access({ role: 'marketing', can_see_values: true })).toBe(false);
  });

  it('falls back to a neutral name when the profile has none', () => {
    const access = decideAccess(row({ full_name: '  ' }));
    expect(access.ok && access.user.fullName).toBe('Signed-in user');
  });
});

describe('roleLabel (step 2-e)', () => {
  it('names each role for the header', () => {
    expect(roleLabel('owner')).toBe('Owner');
    expect(roleLabel('consultant')).toBe('Consultant');
    expect(roleLabel('marketing')).toBe('Marketing');
  });
});

describe('loginErrorMessage', () => {
  it('gives a wrong password and an unknown email the same text', () => {
    const wrong = { name: 'AuthApiError', status: 400, code: 'invalid_credentials' };
    expect(loginErrorMessage(wrong)).toBe(MESSAGES.invalid);
    expect(MESSAGES.invalid).toBe('Email or password is incorrect.');
  });

  it('treats a banned login like a wrong password', () => {
    expect(loginErrorMessage({ status: 400, code: 'user_banned' })).toBe(MESSAGES.invalid);
  });

  it('explains rate limiting', () => {
    expect(loginErrorMessage({ status: 429 })).toBe(MESSAGES.tooMany);
    expect(loginErrorMessage({ code: 'over_request_rate_limit' })).toBe(MESSAGES.tooMany);
  });

  it('explains when the server cannot be reached', () => {
    expect(loginErrorMessage({ name: 'AuthRetryableFetchError', status: 0 })).toBe(
      MESSAGES.connection,
    );
    expect(loginErrorMessage(new TypeError('Failed to fetch'))).toBe(MESSAGES.connection);
    expect(loginErrorMessage({ message: 'TypeError: NetworkError when attempting' })).toBe(
      MESSAGES.connection,
    );
  });

  it('falls back to a generic message', () => {
    expect(loginErrorMessage(null)).toBe(MESSAGES.generic);
    expect(loginErrorMessage('boom')).toBe(MESSAGES.generic);
    expect(loginErrorMessage({ status: 500, code: 'unexpected_failure' })).toBe(MESSAGES.generic);
  });

  it('never puts an email into a message', () => {
    const error = { message: 'User demo.owner1@example.com not found', status: 400 };
    for (const text of [loginErrorMessage(error), ...Object.values(MESSAGES)]) {
      expect(text).not.toMatch(/@/);
    }
  });
});
