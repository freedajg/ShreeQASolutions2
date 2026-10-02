import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCE,
  THEME_STORAGE_KEY,
  parsePreference,
  readPreference,
  resolveTheme,
  savePreference,
} from './theme';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('parsePreference', () => {
  it('keeps the three choices', () => {
    expect(parsePreference('light')).toBe('light');
    expect(parsePreference('dark')).toBe('dark');
    expect(parsePreference('system')).toBe('system');
  });

  it('treats a missing or unknown value as Dark (the default for now)', () => {
    expect(DEFAULT_PREFERENCE).toBe('dark');
    expect(parsePreference(null)).toBe('dark');
    expect(parsePreference(undefined)).toBe('dark');
    expect(parsePreference('blue')).toBe('dark');
  });
});

describe('resolveTheme', () => {
  it('uses an explicit choice whatever the device says', () => {
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('follows the device on System', () => {
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
  });
});

describe('saved preference', () => {
  it('round-trips through storage', () => {
    const store = memoryStore();
    savePreference('light', store);
    expect(readPreference(store)).toBe('light');
  });

  it('defaults to Dark when nothing is saved or storage is unavailable', () => {
    expect(readPreference(memoryStore())).toBe('dark');
    expect(readPreference(undefined)).toBe('dark');
  });

  it('defaults to Dark when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readPreference(broken)).toBe('dark');
    expect(() => savePreference('dark', broken)).not.toThrow();
  });
});

describe('index.html first-paint script', () => {
  it('reads the same storage key as theme.ts', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).toContain(`'${THEME_STORAGE_KEY}'`);
  });
});
