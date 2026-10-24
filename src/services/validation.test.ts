import { describe, expect, it } from 'vitest';
import { addressInputSchema } from '../schemas';
import { RuleError } from '../domain/errors';
import { normalizeRepositoryError, RepositoryError } from './errors';
import { validateInput } from './validation';

describe('repository input boundary', () => {
  it('maps invalid field paths to a safe typed validation error', () => {
    try {
      validateInput(addressInputSchema, { recipient: 'A', phone: 'bad' });
      throw new Error('Expected validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(RepositoryError);
      const failure = error as RepositoryError;
      expect(failure.code).toBe('validation');
      expect(failure.fieldErrors?.phone).toBeDefined();
      expect(failure.fieldErrors?.recipient).toBeDefined();
    }
  });
  it('maps known pure business failures without exposing arbitrary exception text', () => {
    expect(
      normalizeRepositoryError(new RuleError('conflict', 'Please review the stock.')),
    ).toMatchObject({ code: 'conflict', message: 'Please review the stock.' });
    expect(normalizeRepositoryError(new Error('private payload'))).toMatchObject({
      code: 'unavailable',
    });
    expect(normalizeRepositoryError(new Error('private payload')).message).not.toContain(
      'private payload',
    );
  });
});
