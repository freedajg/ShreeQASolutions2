// Light / Dark / System theme (DESIGN.md §2a).
// The first paint is handled by the inline script in index.html, which repeats the
// rules below in plain JS: keep the two in step (theme.test.ts checks the key).

export type ThemePreference = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'drishti-theme';
// Light (white) by default: the user's choice on 24-Nov-2026 (DECISIONS). Each person can still
// pick Dark or System. Changing it means changing the index.html script too.
export const DEFAULT_PREFERENCE: ThemePreference = 'light';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** Anything other than a known choice (missing, edited by hand) means the default. */
export function parsePreference(value: string | null | undefined): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_PREFERENCE;
}

/** System follows the device; a device with no light preference gets dark (the MVP look). */
export function resolveTheme(preference: ThemePreference, devicePrefersLight: boolean): Theme {
  if (preference === 'system') return devicePrefersLight ? 'light' : 'dark';
  return preference;
}

function browserStorage(): KeyValueStore | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined; // blocked storage (privacy mode, sandboxed frame)
  }
}

export function readPreference(storage = browserStorage()): ThemePreference {
  try {
    return parsePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

export function savePreference(preference: ThemePreference, storage = browserStorage()): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not saved; the choice still applies until the page is reloaded.
  }
}

export function devicePrefersLight(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(LIGHT_QUERY).matches;
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}

/** Calls `onChange` when the device switches between light and dark. Returns an unsubscribe. */
export function watchDeviceTheme(onChange: (prefersLight: boolean) => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(LIGHT_QUERY);
  const listener = (e: MediaQueryListEvent) => onChange(e.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
