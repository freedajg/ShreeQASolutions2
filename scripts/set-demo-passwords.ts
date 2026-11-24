// Sets a fresh random password for each seeded demo user on the LOCAL stack (Phase 1, step 10).
// Run: bun run seed:passwords
//
// Freeda runs this herself, in her own terminal window: not through Claude Code and not with
// `!` (that output lands in the conversation). The passwords are printed once, to this terminal
// only, and written nowhere else. Save them in a password manager. Never send them by chat,
// WhatsApp or email, and never commit them. Running it again replaces all five passwords; run
// it again after any `supabase db reset`.
//
// It reads the local API URL and service-role key from `supabase status` (the key is never
// printed) and refuses to talk to anything except 127.0.0.1 / localhost.
import { execFileSync } from 'node:child_process';
import { DEMO_USERS } from '../src/lib/import/seed-rules';

const PASSWORD_LENGTH = 20; // config.toml: minimum_password_length = 12
// No look-alike characters (0/O, 1/l/I), so they can be typed from the screen.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%^*-_=+';

function fail(message: string): never {
  console.error(`seed:passwords stopped: ${message}`);
  process.exit(1);
}

function randomPassword(): string {
  // Rejection sampling, so every character is equally likely.
  const limit = 256 - (256 % ALPHABET.length);
  let password = '';
  while (password.length < PASSWORD_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      if (byte < limit && password.length < PASSWORD_LENGTH) {
        password += ALPHABET[byte % ALPHABET.length];
      }
    }
  }
  return password;
}

if (process.argv.length > 2) fail('it takes no arguments');

let status: Record<string, unknown>;
try {
  const output = execFileSync('bun', ['x', 'supabase', 'status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  status = JSON.parse(output.slice(output.indexOf('{'))) as Record<string, unknown>;
} catch {
  fail('could not read `supabase status`. Is the local stack running (`bun run db:start`)?');
}

const apiUrl = typeof status.API_URL === 'string' ? status.API_URL : '';
const serviceKey =
  typeof status.SERVICE_ROLE_KEY === 'string'
    ? status.SERVICE_ROLE_KEY
    : typeof status.SECRET_KEY === 'string'
      ? status.SECRET_KEY
      : '';
let host = '';
try {
  host = new URL(apiUrl).hostname;
} catch {
  fail('`supabase status` gave no API URL');
}
if (host !== '127.0.0.1' && host !== 'localhost') fail(`the API URL is not local (${host})`);
if (serviceKey === '') fail('`supabase status` gave no service-role key');

const results: { email: string; password: string }[] = [];

function printResults(): void {
  if (results.length === 0) return;
  const width = Math.max(...results.map((r) => r.email.length));
  console.log('\nDemo passwords (shown once; save them in your password manager now):\n');
  for (const r of results) console.log(`  ${r.email.padEnd(width)}  ${r.password}`);
  console.log('\nClear this window afterwards (Clear-Host).');
}

for (const user of DEMO_USERS) {
  const password = randomPassword();
  const response = await fetch(`${apiUrl}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  // Passwords already changed are still shown, so nobody is locked out by a later failure.
  if (!response.ok) {
    printResults();
    fail(`Auth refused ${user.email} (HTTP ${response.status}). Is the seed loaded?`);
  }
  const body = (await response.json()) as { email?: string };
  if (body.email !== user.email) {
    results.push({ email: body.email ?? user.id, password });
    printResults();
    fail(`user ${user.id} is not ${user.email}`);
  }
  results.push({ email: user.email, password });
}

printResults();
