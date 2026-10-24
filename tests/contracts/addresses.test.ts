import { describe, expect, it, vi } from 'vitest';
import type { Runtime } from '../../src/services/contracts';
import type { Session } from '../../src/types';
import { createJsonCustomerRepository } from '../../src/services/json/customers';
import { createPersistence, MemoryStorage } from '../../src/services/persistence/store';

const session = (userId: string): Session => ({ userId, expiresAt: '2026-10-25T00:00:00Z' });
const input = (recipient = 'নুসরাত জাহান', isDefault = false) => ({
  recipient,
  phone: '+88 01712-345678',
  division: 'Dhaka',
  district: 'Dhaka',
  area: 'ধানমন্ডি',
  street: 'বাসা ১২, রোড ৩',
  postcode: '1209',
  isDefault,
});
function setup() {
  let current: Session | null = session('user-demo');
  let serial = 0;
  const runtime: Runtime = {
    now: () => new Date('2026-10-24T00:00:00Z'),
    id: (prefix = 'id') => `${prefix}-${++serial}`,
  };
  const storage = new MemoryStorage();
  const store = createPersistence(storage, runtime);
  const auth = { getSession: vi.fn(async () => current) };
  const create = () => createJsonCustomerRepository({ auth, store, runtime });
  return {
    auth,
    runtime,
    storage,
    store,
    create,
    customers: create(),
    owner: (id: string | null) => {
      current = id ? session(id) : null;
    },
  };
}

describe('customer address repository contract', () => {
  it('creates a normalized Unicode address, restores it and returns isolated copies', async () => {
    const context = setup();
    expect(await context.customers.listAddresses()).toEqual([]);
    const created = await context.customers.saveAddress(input());
    expect(created).toMatchObject({
      id: 'address-1',
      userId: 'user-demo',
      recipient: 'নুসরাত জাহান',
      phone: '+8801712345678',
      area: 'ধানমন্ডি',
      isDefault: true,
    });
    expect(await context.create().getAddress(created.id)).toEqual(created);
    created.recipient = 'Changed caller copy';
    expect((await context.customers.getAddress(created.id)).recipient).toBe('নুসরাত জাহান');
  });

  it('keeps exactly one default while adding, selecting and editing addresses', async () => {
    const context = setup();
    const first = await context.customers.saveAddress(input('First address'));
    const second = await context.customers.saveAddress(input('Second address'));
    expect(
      (await context.customers.listAddresses())
        .filter((record) => record.isDefault)
        .map((record) => record.id),
    ).toEqual([first.id]);
    const third = await context.customers.saveAddress(input('Third address', true));
    expect(
      (await context.customers.listAddresses())
        .filter((record) => record.isDefault)
        .map((record) => record.id),
    ).toEqual([third.id]);
    const updated = await context.customers.saveAddress(
      { ...input('Edited second', true), street: 'House 20, Road 4' },
      second.id,
    );
    expect(updated).toMatchObject({
      id: second.id,
      recipient: 'Edited second',
      street: 'House 20, Road 4',
      isDefault: true,
    });
    expect(
      (await context.customers.listAddresses())
        .filter((record) => record.isDefault)
        .map((record) => record.id),
    ).toEqual([second.id]);
  });

  it('retains a sole default and promotes a remaining address when the default is deleted', async () => {
    const context = setup();
    const first = await context.customers.saveAddress(input('First address'));
    expect(
      (await context.customers.saveAddress(input('First address', false), first.id)).isDefault,
    ).toBe(true);
    const second = await context.customers.saveAddress(input('Second address'));
    expect(await context.customers.deleteAddress(first.id)).toMatchObject([
      { id: second.id, isDefault: true },
    ]);
    expect(await context.customers.deleteAddress(second.id)).toEqual([]);
    expect(await context.customers.listAddresses()).toEqual([]);
  });

  it('isolates owners and gives the same not-found failure for foreign and unknown IDs', async () => {
    const context = setup();
    const first = await context.customers.saveAddress(input('First owner'));
    context.owner('user-second');
    expect(await context.customers.listAddresses()).toEqual([]);
    const second = await context.customers.saveAddress(input('Second owner'));
    const foreign = await context.customers.getAddress(first.id).catch((error) => error);
    const missing = await context.customers.getAddress('missing').catch((error) => error);
    expect(foreign).toMatchObject({ code: 'not_found', message: missing.message });
    await expect(
      context.customers.saveAddress(input('Foreign edit'), first.id),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(context.customers.deleteAddress(first.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    expect((await context.customers.listAddresses()).map((record) => record.id)).toEqual([
      second.id,
    ]);
    context.owner('user-demo');
    expect((await context.customers.getAddress(first.id)).recipient).toBe('First owner');
    context.owner(null);
    await expect(context.customers.listAddresses()).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await expect(context.customers.saveAddress(input())).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects invalid fields and forged ownership without changing saved records', async () => {
    const context = setup();
    const first = await context.customers.saveAddress(input());
    for (const invalid of [
      { ...input(), phone: '123' },
      { ...input(), street: 'a' },
      { ...input(), postcode: '12345' },
      { ...input(), userId: 'user-second' },
    ]) {
      await expect(context.customers.saveAddress(invalid)).rejects.toMatchObject({
        code: 'validation',
      });
    }
    await expect(context.customers.saveAddress(input(), 'missing')).rejects.toMatchObject({
      code: 'not_found',
    });
    expect(await context.customers.listAddresses()).toEqual([first]);
  });

  it('preserves addresses and defaults when saving or deletion exceeds storage capacity', async () => {
    const context = setup();
    const first = await context.customers.saveAddress(input());
    const previous = context.storage.getItem('bdsolarenergy:addresses');
    context.storage.setItem = vi.fn(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    await expect(
      context.customers.saveAddress(input('Failed default', true)),
    ).rejects.toMatchObject({ code: 'storage_unavailable' });
    await expect(context.customers.deleteAddress(first.id)).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    expect(context.storage.getItem('bdsolarenergy:addresses')).toBe(previous);
    expect(await context.customers.listAddresses()).toEqual([first]);
  });

  it('cancels reads before and during asynchronous session resolution', async () => {
    const context = setup();
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      context.customers.listAddresses({ signal: cancelled.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      context.customers.getAddress('missing', { signal: cancelled.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    let resolveOwner!: (value: Session | null) => void;
    context.auth.getSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOwner = resolve;
        }),
    );
    const controller = new AbortController();
    const reading = context.customers.listAddresses({ signal: controller.signal });
    controller.abort();
    resolveOwner(session('user-demo'));
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
    expect(context.storage.getItem('bdsolarenergy:addresses')).toBeNull();
  });

  it('rejects new ID collisions and session switches without overwriting other addresses', async () => {
    const context = setup();
    const first = await context.customers.saveAddress(input('Original'));
    const collision = createJsonCustomerRepository({
      auth: context.auth,
      store: context.store,
      runtime: { ...context.runtime, id: () => first.id },
    });
    await expect(collision.saveAddress(input('Collision'))).rejects.toMatchObject({
      code: 'conflict',
    });
    context.auth.getSession
      .mockResolvedValueOnce(session('user-demo'))
      .mockResolvedValueOnce(session('user-second'));
    await expect(context.customers.saveAddress(input('Wrong owner'))).rejects.toMatchObject({
      code: 'conflict',
    });
    expect(await context.customers.listAddresses()).toEqual([first]);
  });
});
