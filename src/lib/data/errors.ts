// One place that turns database and network errors into plain messages for the screens
// (Phase 2, step 2-a). Never shows the raw database text: it can hold ids or values. The raw
// text is only used to tell apart the cases that share a code, by matching the exact wording
// in supabase/migrations/20261011120000_activity_log.sql (change_engagement_status). If that
// wording ever changes, the per-code message is used instead, which is still safe.
import { NETWORK_FAILURE } from '../auth/access';

export type DataErrorKind =
  | 'no-access' // 42501: no role, or inactive
  | 'not-allowed' // 42501: engagement missing, or the caller may not change it
  | 'rls' // 42501: a row-level security rule refused the change
  | 'forbidden' // any other 42501
  | 'unknown-status' // 22023: unknown or empty status
  | 'same-status' // 22023: the engagement already has that status
  | 'invalid' // any other 22023
  | 'session' // the login has expired
  | 'network' // the server couldn't be reached
  | 'unknown'
  // Saving a form (Add and Edit, session 1; toSaveError below):
  | 'duplicate-code' // 23505 on clients.client_code
  | 'invalid-data' // 23514 / 22P02 / 22003 / 22007 / 22008: a check, number or date was refused
  | 'unknown-choice' // 23503: a lookup value that doesn't exist (any more)
  | 'save-refused' // 42501: a row rule, a column grant or a guard trigger refused the save
  | 'changed-or-refused'; // an update matched no row: changed meanwhile, or not editable

export const DATA_MESSAGES: Record<DataErrorKind, string> = {
  'no-access': "Your account doesn't have access to change statuses. Please contact an Owner.",
  'not-allowed':
    "This engagement can't be changed: it may have been removed, or you don't have permission.",
  rls: "You can't move this engagement to that status.",
  forbidden: "You don't have permission to do that.",
  'unknown-status': "That status isn't recognised. Refresh the page and try again.",
  'same-status': "It's already in that status.",
  invalid: "That change isn't valid.",
  session: 'Your session has ended. Please sign in again.',
  network: "Can't reach the server. Check your connection and try again.",
  unknown: 'Something went wrong. Please try again.',
  'duplicate-code': 'That Client ID is already used by another client.',
  'invalid-data': "Some details aren't valid. Check the highlighted fields and try again.",
  'unknown-choice': "One of the choices isn't available any more. Refresh the page and try again.",
  'save-refused': "You don't have permission to save this change.",
  'changed-or-refused':
    "This record was changed by someone else, or you can't edit it. Close and open it again to see the latest.",
};

export class DataError extends Error {
  readonly kind: DataErrorKind;
  readonly code: string | undefined;

  constructor(kind: DataErrorKind, code?: string) {
    // The message is always our own text, never the database's.
    super(DATA_MESSAGES[kind]);
    this.name = 'DataError';
    this.kind = kind;
    this.code = code;
  }
}

function kindFor42501(message: string): DataErrorKind {
  if (message.includes("You don't have access to change statuses")) return 'no-access';
  if (message.includes("Engagement not found, or you can't change its status")) {
    return 'not-allowed';
  }
  if (message.includes('row-level security')) return 'rls';
  return 'forbidden';
}

function kindFor22023(message: string): DataErrorKind {
  if (message.includes('Unknown status')) return 'unknown-status';
  if (message.includes('already has that status')) return 'same-status';
  return 'invalid';
}

/**
 * Maps an error from supabase-js (a PostgrestError-shaped `{ code, message }`, plus the
 * response status when known) or a thrown fetch error to a DataError.
 */
export function toDataError(error: unknown, status?: number): DataError {
  if (error instanceof DataError) return error;
  if (error === null || typeof error !== 'object') return new DataError('unknown');

  const fields = error as { code?: unknown; message?: unknown; name?: unknown };
  const code = typeof fields.code === 'string' ? fields.code : '';
  const message = typeof fields.message === 'string' ? fields.message : '';

  if (code === '42501') return new DataError(kindFor42501(message), code);
  if (code === '22023') return new DataError(kindFor22023(message), code);
  if (
    code === 'PGRST301' ||
    code === 'PGRST303' ||
    status === 401 ||
    /jwt expired/i.test(message)
  ) {
    return new DataError('session', code || undefined);
  }
  // supabase-js reports a failed fetch as { code: '', message: 'TypeError: Failed to fetch' }.
  if (code === '' && NETWORK_FAILURE.test(message)) return new DataError('network');
  return new DataError('unknown', code || undefined);
}

const INVALID_DATA_CODES = new Set(['23514', '22P02', '22003', '22007', '22008']);

/**
 * Maps an error from saving a form (insert or update on clients, engagements,
 * engagement_financials). Separate from toDataError, whose wording is about status moves:
 * every 42501 here is a refused save, whichever rule refused it. Anything that isn't a save
 * refusal (session, network, unknown) goes through toDataError unchanged.
 */
export function toSaveError(error: unknown, status?: number): DataError {
  if (error instanceof DataError) return error;
  if (error !== null && typeof error === 'object') {
    const fields = error as { code?: unknown; message?: unknown };
    const code = typeof fields.code === 'string' ? fields.code : '';
    const message = typeof fields.message === 'string' ? fields.message : '';
    if (code === '23505') {
      // The only other unique key written by the forms is engagement_financials' primary key:
      // someone added the row meanwhile.
      const kind = message.includes('client_code') ? 'duplicate-code' : 'changed-or-refused';
      return new DataError(kind, code);
    }
    if (INVALID_DATA_CODES.has(code)) return new DataError('invalid-data', code);
    if (code === '23503') return new DataError('unknown-choice', code);
    if (code === '42501') return new DataError('save-refused', code);
  }
  return toDataError(error, status);
}

/** The message a screen shows for any error. */
export function dataErrorMessage(error: unknown): string {
  return toDataError(error).message;
}

export function isNetworkError(error: unknown): boolean {
  return toDataError(error).kind === 'network';
}
