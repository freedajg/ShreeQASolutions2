// Plain-language text for each import flag. Kept apart from importExcel.ts so the screen can
// show flags without loading the Excel library until a file is chosen.
import type { Flag } from '../../lib/import/seed-rules';

const FLAG_TEXT: Record<Flag['code'], string> = {
  MISSING_CLIENT_ID: 'Missing Client ID',
  MISSING_CLIENT_NAME: 'Missing client name (row not imported)',
  ROW_SKIPPED: 'Row not imported',
  MISSING_EMAIL: 'Missing email (no follow-ups until fixed)',
  INVALID_EMAIL: 'Email is not valid',
  UNKNOWN_SERVICE: 'Service not in the 16-value list',
  UNKNOWN_STATUS: 'Status not recognised (not guessed)',
  UNKNOWN_PAYMENT_STATUS: 'Payment status not recognised',
  UNKNOWN_LEAD_SOURCE: 'Lead source not recognised',
  UNKNOWN_PRIORITY: 'Priority not recognised',
  MISSING_OWNER: 'No Relationship Owner',
  UNMATCHED_OWNER: 'Owner name matches nobody in the team',
  INVALID_DATE: 'Not a real Excel date',
  NON_NUMERIC_VALUE: 'Contract value is not a number',
  INVALID_VALUE: 'Contract value is not valid',
  MISSING_VALUE: 'No contract value',
  TOO_LONG: 'Text too long',
  PRIORITY_CONFLICT: 'Priority differs from the client’s first row',
  CLIENT_FIELD_CONFLICT: 'Client details differ from the client’s first row',
  POSSIBLE_DUPLICATE: 'Possible duplicate client (same email)',
};

export const flagText = (f: Flag) => FLAG_TEXT[f.code] ?? f.code;
