import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercentage } from './formatters';

describe('formatCurrency', () => {
  it('formats positive amounts', () => {
    expect(formatCurrency(12570)).toBe('£12,570.00');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('£0.00');
  });

  it('formats decimals', () => {
    expect(formatCurrency(2994.4)).toBe('£2,994.40');
  });

  it('formats large amounts', () => {
    expect(formatCurrency(125140)).toBe('£125,140.00');
  });
});

describe('formatPercentage', () => {
  it('formats decimal rate to percentage', () => {
    expect(formatPercentage(0.2)).toBe('20%');
  });

  it('formats zero', () => {
    expect(formatPercentage(0)).toBe('0%');
  });

  it('formats small rates', () => {
    expect(formatPercentage(0.02)).toBe('2%');
  });
});
