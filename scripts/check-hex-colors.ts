// Fails if a class in src/ hardcodes a colour instead of using a design token:
// - an arbitrary value with a hex or colour function, e.g. `bg-[#080c16]`, `text-[#9aabcc]/80`,
//   `shadow-[0_0_8px_#22d3ee]`, `border-[rgba(148,175,235,0.18)]`
// - a standard Tailwind palette colour, e.g. `text-emerald-400`, `hover:bg-indigo-500/20`, `bg-white`
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

// The same, with a colour function instead of a hex: rgb(), rgba(), hsl(), hsla(), oklch(), oklab().
const COLOR_FUNCTION_IN_ARBITRARY_VALUE =
  /[\w:.-]*\[[^\]\s'"`]*\b(?:rgba?|hsla?|okl(?:ch|ab))\([^\]\s'"`]*\](?:\/\d+)?/g;

// Tailwind's built-in palette, after a colour utility: `text-emerald-400`, `ring-offset-slate-900/50`,
// `bg-white`. Matched at a class boundary so token names like `text-text-strong` never match.
const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOR_UTILITY =
  'bg|text|border(?:-[xytrblse])?|outline|ring(?:-offset)?|divide|from|via|to|fill|stroke|shadow|decoration|accent|caret|placeholder';
const PALETTE_CLASS = new RegExp(
  `(?<![\\w-])(?:[\\w-]+:)*(?:${COLOR_UTILITY})-(?:(?:${PALETTE})-(?:50|[1-9]00|950)|white|black)(?:\\/\\d+)?(?![\\w-])`,
  'g',
);

const PATTERNS = [HEX_IN_ARBITRARY_VALUE, COLOR_FUNCTION_IN_ARBITRARY_VALUE, PALETTE_CLASS];

const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .sort();

let total = 0;
for (const file of files) {
  const lines = readFileSync(join(srcDir, file), 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const pattern of PATTERNS) {
      for (const match of line.matchAll(pattern)) {
        total++;
        console.log(`src/${file.replace(/\\/g, '/')}:${index + 1}  ${match[0]}`);
      }
    }
  });
}

if (total > 0) {
  console.error(`\n${total} hardcoded colour class(es) found. Use design tokens instead.`);
  process.exit(1);
}
console.log('No hardcoded colour classes in src/.');
