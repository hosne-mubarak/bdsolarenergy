import { describe, expect, it } from 'vitest';
import { formatMoney } from './currency';

describe('BDT display without monetary arithmetic loss', () => {
  it('formats integer poisha with the BDT symbol and retained fractions', () => {
    expect(formatMoney(1850000)).toBe('৳18,500');
    expect(formatMoney(110)).toBe('৳1.1');
    expect(formatMoney(1)).toBe('৳0.01');
    expect(formatMoney(0)).toBe('৳0');
    expect(formatMoney(Number.MAX_SAFE_INTEGER)).toBe('৳90,071,992,547,409.91');
  });
  it.each([-1, 0.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid amount %s',
    (amount) => {
      expect(() => formatMoney(amount)).toThrow(RangeError);
    },
  );
});
