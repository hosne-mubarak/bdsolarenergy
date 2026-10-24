import { useState, type ReactNode } from 'react';
import { createPublicRepositories, type PublicRepositories } from '../../services/public';
import { RepositoryContext } from './repository-context';
export function RepositoryProvider({
  children,
  repositories,
}: {
  children: ReactNode;
  repositories?: PublicRepositories;
}) {
  const [services] = useState(() => repositories ?? createPublicRepositories());
  return <RepositoryContext.Provider value={services}>{children}</RepositoryContext.Provider>;
}
