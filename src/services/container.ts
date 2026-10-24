import { RepositoryError } from './errors';

/** The factory is lazy: unsupported configuration never loads or falls back to JSON. */
export function createRepositoryContainer<T>(mode: string | undefined, jsonFactory: () => T): T {
  const selected = mode ?? 'json';
  if (selected !== 'json') {
    throw new RepositoryError('validation', 'Unsupported data source. Set VITE_DATA_SOURCE=json.');
  }
  return jsonFactory();
}
