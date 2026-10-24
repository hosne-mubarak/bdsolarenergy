import { z } from 'zod';
import {
  addressInputSchema,
  addressSchema,
  preferencesSchema,
  profileInputSchema,
} from '../../schemas';
import type { Address, Preferences, User } from '../../types';
import type { AuthRepository, CustomerRepository, Runtime } from '../contracts';
import { requireSession } from '../current-user';
import { normalizeRepositoryError, RepositoryError, throwIfAborted } from '../errors';
import type { Persistence } from '../persistence/store';
import { validateInput } from '../validation';
import { readIdentities, writeIdentities } from './identities';
import { loadFixtureData } from './fixtures';

export interface CustomerDependencies {
  auth: Pick<AuthRepository, 'getSession'>;
  store: Persistence;
  runtime: Runtime;
  addresses?: Address[];
  preferences?: Preferences;
}
const addressesSchema = z.array(addressSchema).superRefine((records, context) => {
  const ids = new Set<string>();
  const counts = new Map<string, { addresses: number; defaults: number }>();
  records.forEach((record, index) => {
    if (ids.has(record.id))
      context.addIssue({
        code: 'custom',
        path: [index, 'id'],
        message: 'Address IDs must be unique.',
      });
    ids.add(record.id);
    const owner = counts.get(record.userId) ?? { addresses: 0, defaults: 0 };
    owner.addresses++;
    if (record.isDefault) owner.defaults++;
    counts.set(record.userId, owner);
  });
  for (const owner of counts.values())
    if (owner.addresses && owner.defaults !== 1)
      context.addIssue({
        code: 'custom',
        message: 'Each nonempty address book needs exactly one default.',
      });
});
let defaultAddresses: Address[] | undefined;
function fixtureAddresses() {
  return structuredClone((defaultAddresses ??= loadFixtureData().fixtures.addresses));
}
function normalizeDefault(records: Address[], ownerId: string, preferredId?: string): Address[] {
  const owned = records.filter((record) => record.userId === ownerId);
  const selected = preferredId ?? owned.find((record) => record.isDefault)?.id ?? owned[0]?.id;
  return records.map((record) =>
    record.userId === ownerId ? { ...record, isDefault: record.id === selected } : record,
  );
}
export function createJsonCustomerRepository({
  auth,
  store,
  runtime,
  addresses = fixtureAddresses(),
  preferences = loadFixtureData().preferences,
}: CustomerDependencies): CustomerRepository {
  async function operation<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw normalizeRepositoryError(error);
    }
  }
  const readAddresses = () =>
    store.read<Address[]>('addresses', addressesSchema, () => structuredClone(addresses));
  const preferencesByOwnerSchema = z.record(preferencesSchema.strict());
  const readPreferences = () =>
    store.read<Record<string, Preferences>>('preferences', preferencesByOwnerSchema, () => ({}));
  return {
    getPreferences: (options) =>
      operation(async () => {
        const session = await requireSession(auth, options);
        const records = readPreferences();
        throwIfAborted(options?.signal);
        return structuredClone(
          (Object.hasOwn(records, session.userId) ? records[session.userId] : undefined) ??
            validateInput(preferencesSchema, preferences),
        );
      }),
    updatePreferences: (input) =>
      operation(async () => {
        const initial = await requireSession(auth);
        const parsed = validateInput(preferencesSchema.strict(), input);
        const session = await requireSession(auth);
        if (initial.userId !== session.userId)
          throw new RepositoryError(
            'conflict',
            'Your session changed. Please review your preferences and try again.',
          );
        // Resolve the owner before reading so writes never restore a stale aggregate.
        const records = readPreferences();
        const updated = { ...records, [session.userId]: parsed };
        const saved = store.write('preferences', preferencesByOwnerSchema, updated);
        return structuredClone(saved[session.userId]);
      }),
    listAddresses: (options) =>
      operation(async () => {
        const session = await requireSession(auth, options);
        const records = readAddresses();
        throwIfAborted(options?.signal);
        return records.filter((record) => record.userId === session.userId);
      }),
    getAddress: (id, options) =>
      operation(async () => {
        const session = await requireSession(auth, options);
        const record = readAddresses().find(
          (record) => record.id === id && record.userId === session.userId,
        );
        throwIfAborted(options?.signal);
        if (!record) throw new RepositoryError('not_found', 'This address could not be found.');
        return structuredClone(record);
      }),
    saveAddress: (input, id) =>
      operation(async () => {
        const initial = await requireSession(auth);
        const parsed = validateInput(addressInputSchema.strict(), input);
        const session = await requireSession(auth);
        if (initial.userId !== session.userId)
          throw new RepositoryError(
            'conflict',
            'Your session changed. Please review the address and try again.',
          );
        const records = readAddresses();
        const index = id
          ? records.findIndex((record) => record.id === id && record.userId === session.userId)
          : -1;
        if (id && index < 0)
          throw new RepositoryError('not_found', 'This address could not be found.');
        const addressId = id ?? runtime.id('address');
        if (!id && records.some((record) => record.id === addressId))
          throw new RepositoryError(
            'conflict',
            'The address identifier is already in use. Please retry.',
          );
        const value: Address = { ...parsed, id: addressId, userId: session.userId };
        const updated =
          index >= 0
            ? records.map((record, offset) => (offset === index ? value : record))
            : [...records, value];
        const normalized = normalizeDefault(
          updated,
          session.userId,
          parsed.isDefault ? addressId : undefined,
        );
        const saved = store.write('addresses', addressesSchema, normalized);
        return saved.find((record) => record.id === addressId)!;
      }),
    deleteAddress: (id) =>
      operation(async () => {
        const session = await requireSession(auth);
        const records = readAddresses();
        if (!records.some((record) => record.id === id && record.userId === session.userId))
          throw new RepositoryError('not_found', 'This address could not be found.');
        const normalized = normalizeDefault(
          records.filter((record) => record.id !== id),
          session.userId,
        );
        const saved = store.write('addresses', addressesSchema, normalized);
        return saved.filter((record) => record.userId === session.userId);
      }),
    getProfile: (options) =>
      operation(async () => {
        const session = await requireSession(auth, options);
        const identity = readIdentities(store).find((record) => record.user.id === session.userId);
        throwIfAborted(options?.signal);
        if (!identity) throw new RepositoryError('unauthenticated');
        // Return only the public profile; credential verifiers never leave this adapter.
        return structuredClone(identity.user);
      }),
    updateProfile: (input) =>
      operation(async () => {
        const initial = await requireSession(auth);
        const parsed = validateInput(profileInputSchema.strict(), input);
        const session = await requireSession(auth);
        if (session.userId !== initial.userId)
          throw new RepositoryError(
            'conflict',
            'Your session changed. Please review the profile and try again.',
          );
        // Read after asynchronous session resolution so concurrent updates cannot restore stale identities.
        const records = readIdentities(store);
        const index = records.findIndex((record) => record.user.id === session.userId);
        if (index < 0) throw new RepositoryError('unauthenticated');
        const user: User = {
          ...records[index].user,
          displayName: parsed.displayName,
          phone: parsed.phone,
        };
        records[index] = { ...records[index], user };
        writeIdentities(store, records);
        return structuredClone(user);
      }),
  };
}
