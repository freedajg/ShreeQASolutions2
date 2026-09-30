// Removes build output and test reports. Cross-platform replacement for `rm -rf`.
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const targets = ['dist', 'coverage', 'test-results', 'playwright-report', 'blob-report'];

for (const target of targets) {
  const path = join(root, target);
  if (!existsSync(path)) continue;
  rmSync(path, { recursive: true, force: true });
  console.log(`removed ${target}/`);
}
