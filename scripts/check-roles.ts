// Per-role check through the real login, against the LOCAL stack (Phase 1, step 13).
// Run: bun run check:roles [-- --out <file outside the repo>]
//
// Freeda runs this herself, in her own terminal window: not through Claude Code and not with
// `!`. It asks for the five demo passwords (from `bun run seed:passwords`) at a hidden prompt;
// nothing is echoed, and they are held only in memory, used only for signInWithPassword, and
// never printed, logged or saved. It refuses to run when input isn't a real terminal.
//
// It uses only the local API URL and the anon key from `supabase status`, checked by the same
// rule as the browser (checkSupabaseConfig), and a fresh unsaved session per user. It never
// uses the service-role key. Output is a redacted summary: users, objects, row counts, column
// names and PASS/FAIL; no tokens, keys, passwords or row contents.
// Exit code 0 only when every line passes.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { relative, resolve, isAbsolute } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEMO_USERS, type DemoUserKey } from '../src/lib/import/seed-rules';
import { checkSupabaseConfig } from '../src/lib/supabase/config';
import {
  CHECK_OBJECTS,
  ColumnSets,
  applyKeys,
  findSecrets,
  judge,
  judgeLogin,
  judgeMarketingClients,
  judgeProfileCount,
  judgeSignup,
  knownValues,
  renderReport,
  type ApiError,
  type CheckObject,
  type ReportLine,
  type Response,
  type Row,
} from '../src/lib/checks/role-checks';

function fail(message: string): never {
  console.error(`check:roles stopped: ${message}`);
  process.exit(1);
}

class Cancelled extends Error {}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
function readOutPath(argv: string[]): string | undefined {
  // `bun run check:roles -- --out …` may pass the `--` through.
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  if (args.length === 0) return undefined;
  if (args.length !== 2 || args[0] !== '--out' || args[1].trim() === '') {
    fail('the only option is --out <file>');
  }
  const out = resolve(args[1]);
  const fromRepo = relative(process.cwd(), out);
  if (!fromRepo.startsWith('..') && !isAbsolute(fromRepo)) {
    fail('--out must be outside the repo (results are kept out of git)');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Local URL and anon key from `supabase status`
// ---------------------------------------------------------------------------
const STATUS_PROBLEM = "Couldn't read supabase status. Is the stack running?";

function readLocalConfig(): { url: string; anonKey: string } {
  // The status output holds the service-role key and the database password: it is parsed here
  // and never printed, not even on failure.
  let apiUrl: unknown;
  let anonKey: unknown;
  try {
    const output = execFileSync('bun', ['x', 'supabase', 'status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const status = JSON.parse(output.slice(output.indexOf('{'))) as Record<string, unknown>;
    apiUrl = status.API_URL;
    anonKey = status.ANON_KEY;
  } catch {
    fail(STATUS_PROBLEM);
  }
  if (typeof apiUrl !== 'string' || typeof anonKey !== 'string') fail(STATUS_PROBLEM);
  const check = checkSupabaseConfig(apiUrl, anonKey);
  if (!check.ok) fail(check.problem); // problems never include the key
  return check.config;
}

// ---------------------------------------------------------------------------
// Hidden prompt
// ---------------------------------------------------------------------------
const stdin = process.stdin;

function restoreTerminal(): void {
  try {
    if (stdin.isTTY && stdin.isRaw) stdin.setRawMode(false);
  } catch {
    // nothing more to do
  }
}
process.on('exit', restoreTerminal);

async function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    fail('hidden input needs a real terminal. Run it in your own PowerShell window.');
  }
  process.stdout.write(prompt);
  try {
    stdin.setRawMode(true);
  } catch {
    restoreTerminal();
    process.stdout.write('\n');
    fail(
      'hidden input is not available in this terminal; stopping (never falls back to visible input).',
    );
  }
  stdin.setEncoding('utf8');
  stdin.resume();
  let onData: ((chunk: string) => void) | undefined;
  try {
    return await new Promise<string>((done, cancel) => {
      let buffer = '';
      onData = (chunk: string) => {
        const result = applyKeys(buffer, chunk);
        if (result.kind === 'more') {
          buffer = result.buffer;
        } else if (result.kind === 'cancel') {
          cancel(new Cancelled());
        } else {
          done(result.value);
        }
      };
      stdin.on('data', onData);
    });
  } finally {
    if (onData) stdin.off('data', onData);
    restoreTerminal();
    stdin.pause();
    process.stdout.write('\n');
  }
}

// ---------------------------------------------------------------------------
// Supabase calls (errors reduced to code + HTTP status)
// ---------------------------------------------------------------------------
function newClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function apiError(error: unknown, status?: number): ApiError {
  const e = (error ?? {}) as { code?: unknown; status?: unknown; name?: unknown };
  const code = e.code ?? e.name ?? 'unknown';
  const httpStatus = typeof e.status === 'number' ? e.status : (status ?? 0);
  return { code: String(code), status: httpStatus };
}

async function select(client: SupabaseClient, object: CheckObject): Promise<Response> {
  try {
    const { data, error, status } = await client.from(object).select('*');
    if (error) return { rows: null, error: apiError(error, status) };
    return { rows: (data ?? []) as Row[], error: null };
  } catch (error) {
    return { rows: null, error: apiError(error) };
  }
}

async function selectAll(client: SupabaseClient): Promise<Map<CheckObject, Response>> {
  const results = new Map<CheckObject, Response>();
  for (const object of CHECK_OBJECTS) results.set(object, await select(client, object));
  return results;
}

async function countProfiles(client: SupabaseClient): Promise<number | null> {
  const { count, error } = await client
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  return error ? null : count;
}

/** Tries to sign up a throwaway @example.com address; returns the error, or null if accepted. */
async function trySignup(url: string, anonKey: string): Promise<ApiError | null> {
  try {
    const { error } = await newClient(url, anonKey).auth.signUp({
      email: `step13-signup-${randomText(8)}@example.com`,
      password: randomText(24),
    });
    return error ? apiError(error) : null;
  } catch (error) {
    return apiError(error);
  }
}

function randomText(length: number): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => alphabet[b % 32]).join(
    '',
  );
}

// ---------------------------------------------------------------------------
// Report details
// ---------------------------------------------------------------------------
function nowIst(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute} IST`;
}

function shortCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<number> {
  const outPath = readOutPath(process.argv.slice(2));
  const config = readLocalConfig();
  const host = new URL(config.url).hostname;

  if (!stdin.isTTY)
    fail('hidden input needs a real terminal. Run it in your own PowerShell window.');

  console.log('Paste each demo password from your password manager and press Enter.');
  console.log('Nothing is shown while you type or paste. Ctrl+C stops.\n');
  const passwords = new Map<DemoUserKey, string>();
  for (const user of DEMO_USERS) {
    passwords.set(user.key, await readHidden(`Password for ${user.email} (hidden): `));
    console.log('✓ received');
  }
  console.log('\nChecking…\n');

  const lines: ReportLine[] = [];
  const columnSets = new ColumnSets();
  const report = (): string =>
    renderReport({ when: nowIst(), host, commit: shortCommit() }, lines, columnSets);
  const secrets = [...passwords.values(), config.anonKey];

  const finish = (code: number): number => {
    const text = report();
    const reasons = findSecrets(text, secrets);
    if (reasons.length > 0) {
      console.error(`Report withheld: it looked like it contained ${reasons.join(', ')}.`);
      return 1;
    }
    console.log(text);
    if (outPath) {
      writeFileSync(outPath, text, 'utf8');
      console.log(`Saved: ${outPath}`);
    }
    return code;
  };

  // 1. Not signed in.
  const anon = newClient(config.url, config.anonKey);
  const anonResults = await selectAll(anon);
  for (const object of CHECK_OBJECTS) {
    lines.push(judge('anon', object, anonResults.get(object)!, columnSets));
  }

  // 2. Real logins, with the sign-up check while Owner 1 is signed in.
  const results = new Map<DemoUserKey, Map<CheckObject, Response>>();
  for (const user of DEMO_USERS) {
    const client = newClient(config.url, config.anonKey);
    const { data, error } = await client.auth.signInWithPassword({
      email: user.email,
      password: passwords.get(user.key)!,
    });
    if (error || !data.session) {
      lines.push(
        judgeLogin(user.key, { error: apiError(error ?? { code: 'no_session' }), profile: null }),
      );
      continue;
    }
    const profile = await client
      .from('profiles')
      .select('id, role, can_see_values, active')
      .eq('id', data.session.user.id)
      .maybeSingle();
    lines.push(
      judgeLogin(user.key, { error: null, profile: (profile.data as Row | null) ?? null }),
    );

    if (user.key === 'owner1') {
      const before = await countProfiles(client);
      const signupError = await trySignup(config.url, config.anonKey);
      lines.push(judgeSignup(signupError));
      const after = await countProfiles(client);
      lines.push(judgeProfileCount(before, after));
      if (!signupError) {
        await client.auth.signOut({ scope: 'local' });
        console.error('Sign-up was ACCEPTED. Stopping before the data checks.');
        return finish(1);
      }
    }

    results.set(user.key, await selectAll(client));
    await client.auth.signOut({ scope: 'local' });
  }
  // Owner 1 couldn't log in: still check sign-up; the profile count can't be checked.
  if (!results.has('owner1')) {
    lines.push(judgeSignup(await trySignup(config.url, config.anonKey)));
    lines.push(judgeProfileCount(null, null));
  }

  // 3. Per-role data. Owner 1's contract values feed the leak scan.
  const ownerFinancials = results.get('owner1')?.get('engagement_financials')?.rows;
  const known = ownerFinancials ? knownValues(ownerFinancials) : undefined;
  for (const user of DEMO_USERS) {
    const userResults = results.get(user.key);
    if (!userResults) continue; // login failed: data checks skipped
    for (const object of CHECK_OBJECTS) {
      lines.push(judge(user.key, object, userResults.get(object)!, columnSets, { known }));
    }
    if (user.key === 'marketing1') {
      lines.push(
        judgeMarketingClients(
          userResults.get('pipeline')?.rows ?? [],
          userResults.get('clients')?.rows ?? [],
        ),
      );
    }
  }

  return finish(lines.every((l) => l.result === 'PASS') ? 0 : 1);
}

try {
  process.exitCode = await main();
} catch (error) {
  restoreTerminal();
  if (error instanceof Cancelled) {
    console.error('\nStopped (Ctrl+C). Nothing was checked.');
    process.exitCode = 130;
  } else {
    // Only the error's type: a message could quote a request.
    console.error(
      `check:roles stopped: unexpected ${error instanceof Error ? error.name : 'error'}.`,
    );
    process.exitCode = 1;
  }
}
