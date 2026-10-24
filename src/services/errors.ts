import { RuleError } from '../domain/errors';
export const repositoryErrorCodes = [
  'validation',
  'not_found',
  'conflict',
  'unauthenticated',
  'forbidden',
  'storage_unavailable',
  'unavailable',
] as const;
export type RepositoryErrorCode = (typeof repositoryErrorCodes)[number];

const safeMessages: Record<RepositoryErrorCode, string> = {
  validation: 'Please check the submitted information.',
  not_found: 'The requested record could not be found.',
  conflict: 'The information has changed. Please review and try again.',
  unauthenticated: 'Please sign in to continue.',
  forbidden: 'You do not have access to this record.',
  storage_unavailable:
    'Browser storage is unavailable. Please check storage settings and try again.',
  unavailable: 'This operation is temporarily unavailable. Please try again.',
};

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  readonly fieldErrors?: Record<string, string[]>;
  constructor(
    code: RepositoryErrorCode,
    message = safeMessages[code],
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function isAbortError(error: unknown): error is Error {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

/** Cancellation is control flow, and must not become a retriable repository failure. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The request was cancelled.', 'AbortError');
}

/** Never expose arbitrary exception text (or transport response bodies) to the UI. */
export function normalizeRepositoryError(error: unknown): RepositoryError {
  if (isAbortError(error)) throw error;
  if (error instanceof RepositoryError) return error;
  if (error instanceof RuleError) return new RepositoryError(error.code, error.message);
  return new RepositoryError('unavailable');
}
