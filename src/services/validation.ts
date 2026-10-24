import type { z } from 'zod';
import { RepositoryError } from './errors';

/** Normalize boundary validation once rather than teaching every form a Zod exception shape. */
export function validateInput<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || '_form';
    (fields[path] ??= []).push(issue.message);
  }
  throw new RepositoryError('validation', 'Please check the submitted information.', fields);
}
