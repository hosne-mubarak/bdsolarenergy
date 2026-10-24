import type { Session } from '../types';
import type { AuthRepository, ReadOptions } from './contracts';
import { RepositoryError, throwIfAborted } from './errors';

/** Resolve identity through the session adapter, never a caller-supplied owner ID. */
export async function requireSession(
  auth: Pick<AuthRepository, 'getSession'>,
  options?: ReadOptions,
): Promise<Session> {
  throwIfAborted(options?.signal);
  const session = await auth.getSession(options);
  throwIfAborted(options?.signal);
  if (!session) throw new RepositoryError('unauthenticated');
  return session;
}
