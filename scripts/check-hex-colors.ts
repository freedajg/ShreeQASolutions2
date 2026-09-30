// Fails if any Tailwind arbitrary-value class in src/ contains a hex colour,
// e.g. `bg-[#080c16]`, `text-[#9aabcc]/80`, `shadow-[0_0_8px_#22d3ee]`.
// Colours must come from design tokens (docs/DESIGN.md). Run: bun run check:colors
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src');

// A class whose [...] arbitrary value (no spaces or quotes inside) holds a 3-8 digit hex,
// with its prefix and variants (`hover:bg-`) and an optional opacity suffix (`/90`).
const HEX_IN_ARBITRARY_VALUE =
  /[\w:.-]*\[[^\]\s'"`]*#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z])[^\]\s'"`]*\](?:\/\d+)?/g;

const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .sort();

let total = 0;
for (const file of files) {
  const lines = readFileSync(join(srcDir, file), 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const match of line.matchAll(HEX_IN_ARBITRARY_VALUE)) {
      total++;
      console.log(`src/${file.replace(/\\/g, '/')}:${index + 1}  ${match[0]}`);
    }
  });
}

if (total > 0) {
  console.error(`\n${total} hardcoded hex colour class(es) found. Use design tokens instead.`);
  process.exit(1);
}
console.log('No hardcoded hex colour classes in src/.');
