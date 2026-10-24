import { describe, expect, it } from 'vitest';
import { emailSchema, moneySchema } from './index';

describe('shared money and email boundary validation', () => {
  it.each([0, 1, 100, Number.MAX_SAFE_INTEGER])('accepts integer poisha %s', (value) => {
    expect(moneySchema.parse(value)).toBe(value);
  });

  it.each([-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '100', null])(
    'rejects invalid monetary input %s',
    (value) => {
      expect(moneySchema.safeParse(value).success).toBe(false);
    },
  );

  it('normalizes email identity keys consistently before duplicate detection', () => {
    expect(emailSchema.parse('  CUSTOMER@Example.COM  ')).toBe('customer@example.com');
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});
