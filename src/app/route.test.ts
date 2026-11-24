import { describe, expect, it } from 'vitest';
import { viewFromPath } from './route';

describe('viewFromPath', () => {
  it('maps page addresses to screens', () => {
    expect(viewFromPath('/radar')).toBe('radar');
    expect(viewFromPath('/Clients/')).toBe('clients');
  });
  it('ignores the root and unknown addresses', () => {
    expect(viewFromPath('/')).toBeNull();
    expect(viewFromPath('/admin')).toBeNull();
    expect(viewFromPath('/health')).toBeNull();
  });
});
