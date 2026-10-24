import type { Repositories } from './contracts';
import { createRepositoryContainer } from './container';
import { createJsonReadRepositories } from './json/read-repositories';
import { browserRuntime } from './runtime';
export type PublicRepositories = Pick<Repositories, 'catalogue' | 'content'>;
export function createPublicRepositories(): PublicRepositories {
  return createRepositoryContainer(import.meta.env.VITE_DATA_SOURCE, () =>
    createJsonReadRepositories(browserRuntime),
  );
}
