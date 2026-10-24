import { createContext } from 'react';
import type { PublicRepositories } from '../../services/public';
export const RepositoryContext = createContext<PublicRepositories | null>(null);
