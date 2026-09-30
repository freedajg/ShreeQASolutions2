import { describe, expect, it } from 'vitest';
import { formatINR } from './currency';

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    expect(formatINR(100000)).toBe('₹1,00,000');
    expect(formatINR(5500000)).toBe('₹55,00,000');
    expect(formatINR(999)).toBe('₹999');
  });

  it('shortens to lakh and crore in compact mode', () => {
    expect(formatINR(450000, true)).toBe('₹4.50 L');
    expect(formatINR(100000, true)).toBe('₹1 L');
    expect(formatINR(12500000, true)).toBe('₹1.25 Cr');
  });

  it('shows ₹0 for a missing amount', () => {
    expect(formatINR(NaN)).toBe('₹0');
  });
});
