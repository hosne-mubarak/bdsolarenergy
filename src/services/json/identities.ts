import { z } from 'zod';
import { storedIdentitySchema } from '../../schemas';
import type { StoredIdentity, User } from '../../types';
import type { Persistence } from '../persistence/store';
import { loadFixtureData } from './fixtures';

export const identitiesSchema = z.array(storedIdentitySchema).superRefine((identities, context) => {
  const ids = new Set<string>();
  const emails = new Set<string>();
  identities.forEach((identity, index) => {
    if (ids.has(identity.user.id) || emails.has(identity.user.email))
      context.addIssue({
        code: 'custom',
        path: [index, 'user'],
        message: 'Demo identities must have unique IDs and email addresses.',
      });
    ids.add(identity.user.id);
    emails.add(identity.user.email);
  });
});
let defaultUsers: User[] | undefined;
export function fixtureUsers(): User[] {
  return structuredClone((defaultUsers ??= loadFixtureData().fixtures.users));
}
export function readIdentities(
  store: Persistence,
  users: User[] = fixtureUsers(),
): StoredIdentity[] {
  return store.read<StoredIdentity[]>('identities', identitiesSchema, () =>
    users.map((user) => ({ user: structuredClone(user), credential: null })),
  );
}
export function writeIdentities(
  store: Persistence,
  identities: StoredIdentity[],
): StoredIdentity[] {
  return store.write('identities', identitiesSchema, identities);
}
