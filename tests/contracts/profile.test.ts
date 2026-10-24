import { describe, expect, it, vi } from 'vitest';
import type { Runtime } from '../../src/services/contracts';
import type { Session } from '../../src/types';
import { createJsonCustomerRepository } from '../../src/services/json/customers';
import { readIdentities, writeIdentities } from '../../src/services/json/identities';
import { createPersistence, MemoryStorage } from '../../src/services/persistence/store';

const runtime: Runtime = {
  now: () => new Date('2026-10-24T00:00:00Z'),
  id: (prefix = 'id') => `${prefix}-1`,
};
const session = (userId: string): Session => ({ userId, expiresAt: '2026-10-25T00:00:00Z' });
function setup() {
  const storage = new MemoryStorage();
  const store = createPersistence(storage, runtime);
  let current: Session | null = session('user-demo');
  const auth = { getSession: vi.fn(async () => current) };
  const create = () => createJsonCustomerRepository({ auth, store, runtime });
  return {
    storage,
    store,
    auth,
    create,
    customers: create(),
    owner: (userId: string | null) => {
      current = userId ? session(userId) : null;
    },
  };
}

describe('customer profile contract', () => {
  it('rejects guest access and missing identities rather than returning another profile', async () => {
    const context = setup();
    context.owner(null);
    await expect(context.customers.getProfile()).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(
      context.customers.updateProfile({ displayName: 'Guest Profile', phone: '' }),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
    context.owner('missing-user');
    await expect(context.customers.getProfile()).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('returns only a cloned public profile without password verifier data', async () => {
    const context = setup();
    const records = readIdentities(context.store);
    records[0].credential = {
      salt: 'abcd',
      hash: 'private-verifier',
      iterations: 150000,
      algorithm: 'PBKDF2-SHA-256',
    };
    writeIdentities(context.store, records);
    const profile = await context.customers.getProfile();
    expect(Object.keys(profile).sort()).toEqual([
      'demo',
      'displayName',
      'email',
      'id',
      'phone',
      'verified',
    ]);
    expect(JSON.stringify(profile)).not.toContain('private-verifier');
    profile.displayName = 'Mutated caller copy';
    expect((await context.customers.getProfile()).displayName).toBe('Demo Customer');
  });

  it('persists validated Unicode names and normalized phones while preserving identity and verifier', async () => {
    const context = setup();
    const records = readIdentities(context.store);
    records[0].credential = {
      salt: 'abcd',
      hash: 'retained-verifier',
      iterations: 150000,
      algorithm: 'PBKDF2-SHA-256',
    };
    writeIdentities(context.store, records);
    const updated = await context.customers.updateProfile({
      displayName: '  নুসরাত জাহান  ',
      phone: '+88 01712-345678',
    });
    expect(updated).toMatchObject({
      id: 'user-demo',
      email: 'demo@example.com',
      displayName: 'নুসরাত জাহান',
      phone: '+8801712345678',
      demo: true,
      verified: false,
    });
    expect(await context.create().getProfile()).toEqual(updated);
    expect(readIdentities(context.store)[0].credential).toEqual(records[0].credential);
  });

  it('rejects invalid input and attempted email changes without modifying the saved record', async () => {
    const context = setup();
    const previous = await context.customers.getProfile();
    await expect(
      context.customers.updateProfile({ displayName: 'A', phone: 'invalid' }),
    ).rejects.toMatchObject({ code: 'validation' });
    const changedEmail = { displayName: 'Updated Name', phone: '', email: 'another@example.com' };
    await expect(context.customers.updateProfile(changedEmail)).rejects.toMatchObject({
      code: 'validation',
    });
    expect(await context.customers.getProfile()).toEqual(previous);
  });

  it('honors cancellation before and during asynchronous owner resolution', async () => {
    const context = setup();
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(context.customers.getProfile({ signal: cancelled.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    let resolveOwner!: (value: Session | null) => void;
    context.auth.getSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOwner = resolve;
        }),
    );
    const controller = new AbortController();
    const reading = context.customers.getProfile({ signal: controller.signal });
    controller.abort();
    resolveOwner(session('user-demo'));
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('isolates customer changes and rejects a session switch during a mutation', async () => {
    const context = setup();
    await context.customers.updateProfile({ displayName: 'First customer', phone: '' });
    context.owner('user-second');
    expect((await context.customers.getProfile()).displayName).toBe('Another Customer');
    await context.customers.updateProfile({ displayName: 'Second customer', phone: '' });
    context.owner('user-demo');
    expect((await context.customers.getProfile()).displayName).toBe('First customer');
    context.auth.getSession
      .mockResolvedValueOnce(session('user-demo'))
      .mockResolvedValueOnce(session('user-second'));
    await expect(
      context.customers.updateProfile({ displayName: 'Wrong owner', phone: '' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(readIdentities(context.store).map((record) => record.user.displayName)).toEqual([
      'First customer',
      'Second customer',
    ]);
  });

  it('preserves the prior profile when persistence fails', async () => {
    const context = setup();
    await context.customers.updateProfile({ displayName: 'Saved profile', phone: '' });
    const original = context.storage.getItem('bdsolarenergy:identities');
    context.storage.setItem = vi.fn(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    await expect(
      context.customers.updateProfile({ displayName: 'Unwritten profile', phone: '' }),
    ).rejects.toMatchObject({ code: 'storage_unavailable' });
    expect(context.storage.getItem('bdsolarenergy:identities')).toBe(original);
    expect((await context.customers.getProfile()).displayName).toBe('Saved profile');
  });
});
