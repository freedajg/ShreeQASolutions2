import { describe, expect, it } from 'vitest';
import type { TabKey } from '../types';
import {
  FEATURES,
  LANDING_SCREEN,
  SCREENS,
  enabledScreens,
  isFeatureEnabled,
  isScreenEnabled,
  resolveScreen,
} from './screens';

const ALL: TabKey[] = [
  'drishti',
  'dashboard',
  'radar',
  'pipeline',
  'clients',
  'import',
  'settings',
];
const SHOWN: TabKey[] = ['pipeline', 'clients'];
const HIDDEN: TabKey[] = ['drishti', 'dashboard', 'radar', 'import', 'settings'];

describe('screen list', () => {
  it('has an entry for every screen', () => {
    expect(Object.keys(SCREENS).sort()).toEqual([...ALL].sort());
  });

  it('shows only Pipeline and Clients until the others read from the database', () => {
    for (const key of SHOWN) expect(isScreenEnabled(key)).toBe(true);
    for (const key of HIDDEN) expect(isScreenEnabled(key)).toBe(false);
  });

  it('lands on Pipeline, which is shown', () => {
    expect(LANDING_SCREEN).toBe('pipeline');
    expect(isScreenEnabled(LANDING_SCREEN)).toBe(true);
  });

  it('keeps the order and drops hidden screens', () => {
    expect(enabledScreens(ALL)).toEqual(['pipeline', 'clients']);
    expect(enabledScreens(['clients', 'radar', 'pipeline'] as const)).toEqual([
      'clients',
      'pipeline',
    ]);
  });
});

describe('resolveScreen', () => {
  it('returns a shown screen unchanged', () => {
    for (const key of SHOWN) expect(resolveScreen(key)).toBe(key);
  });

  it('sends every hidden screen to Pipeline', () => {
    for (const key of HIDDEN) expect(resolveScreen(key)).toBe('pipeline');
  });

  it('sends anything unknown to Pipeline', () => {
    for (const value of ['', 'nonsense', '__proto__', 'toString', null, undefined, 42, {}]) {
      expect(resolveScreen(value)).toBe('pipeline');
    }
  });
});

describe('features', () => {
  it('keeps AI providers and email drafts off', () => {
    expect(isFeatureEnabled('aiProviders')).toBe(false);
    expect(isFeatureEnabled('emailDraft')).toBe(false);
  });

  it('keeps the step 2-b switches off until each part is wired', () => {
    for (const key of ['addLead', 'addClient', 'needsAttention'] as const) {
      expect(isFeatureEnabled(key)).toBe(false);
    }
  });

  it('has exactly these switches, all off', () => {
    expect(FEATURES).toEqual({
      aiProviders: false,
      emailDraft: false,
      addLead: false,
      addClient: false,
      needsAttention: false,
    });
  });
});
