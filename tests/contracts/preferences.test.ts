import { describe, expect, it, vi } from 'vitest';
import type { Runtime } from '../../src/services/contracts';
import type { Session } from '../../src/types';
import { createJsonCustomerRepository } from '../../src/services/json/customers';
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

describe('customer preferences contract', () => {
  it('loads fixture defaults without writing and restores an owned update after recreation', async () => {
    const context = setup();
    expect(await context.customers.getPreferences()).toEqual({
      orderUpdates: false,
      compactCards: false,
    });
    expect(context.storage.length).toBe(0);
    const saved = await context.customers.updatePreferences({
      orderUpdates: true,
      compactCards: true,
    });
    expect(await context.create().getPreferences()).toEqual(saved);
    saved.orderUpdates = false;
    expect((await context.customers.getPreferences()).orderUpdates).toBe(true);
  });

  it('uses injectable fixture defaults and keeps different customers isolated', async () => {
    const context = setup();
    const custom = createJsonCustomerRepository({
      auth: context.auth,
      store: context.store,
      runtime,
      preferences: { orderUpdates: false, compactCards: true },
    });
    expect(await custom.getPreferences()).toEqual({ orderUpdates: false, compactCards: true });
    await context.customers.updatePreferences({ orderUpdates: true, compactCards: false });
    context.owner('user-second');
    expect(await context.customers.getPreferences()).toEqual({
      orderUpdates: false,
      compactCards: false,
    });
    await context.customers.updatePreferences({ orderUpdates: false, compactCards: true });
    context.owner('user-demo');
    expect(await context.customers.getPreferences()).toEqual({
      orderUpdates: true,
      compactCards: false,
    });
  });

  it('rejects guest reads and writes before accessing preferences storage', async () => {
    const context = setup();
    context.owner(null);
    await expect(context.customers.getPreferences()).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await expect(
      context.customers.updatePreferences({ orderUpdates: true, compactCards: true }),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(context.storage.length).toBe(0);
  });

  it('rejects invalid values, missing fields and attempted owner injection without modifying data', async () => {
    const context = setup();
    await context.customers.updatePreferences({ orderUpdates: true, compactCards: false });
    const original = context.storage.getItem('bdsolarenergy:preferences');
    for (const input of [
      { orderUpdates: 'true', compactCards: false },
      { orderUpdates: true },
      { orderUpdates: false, compactCards: true, userId: 'user-second' },
    ]) {
      await expect(context.customers.updatePreferences(input as never)).rejects.toMatchObject({
        code: 'validation',
      });
    }
    expect(context.storage.getItem('bdsolarenergy:preferences')).toBe(original);
  });

  it('honors cancellation before and during session restoration', async () => {
    const context = setup();
    const first = new AbortController();
    first.abort();
    await expect(context.customers.getPreferences({ signal: first.signal })).rejects.toMatchObject({
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
    const reading = context.customers.getPreferences({ signal: controller.signal });
    controller.abort();
    resolveOwner(session('user-demo'));
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
    expect(context.storage.length).toBe(0);
  });

  it('rejects a changed session without writing preferences for either owner', async () => {
    const context = setup();
    context.auth.getSession
      .mockResolvedValueOnce(session('user-demo'))
      .mockResolvedValueOnce(session('user-second'));
    await expect(
      context.customers.updatePreferences({ orderUpdates: true, compactCards: true }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(context.storage.length).toBe(0);
  });

  it('propagates read/write storage failures and preserves prior preferences', async () => {
    const context = setup();
    await context.customers.updatePreferences({ orderUpdates: true, compactCards: false });
    const original = context.storage.getItem('bdsolarenergy:preferences');
    const read = context.storage.getItem.bind(context.storage);
    context.storage.getItem = vi.fn(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    await expect(context.customers.getPreferences()).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    context.storage.getItem = read;
    context.storage.setItem = vi.fn(() => {
      throw new DOMException('Quota', 'QuotaExceededError');
    });
    await expect(
      context.customers.updatePreferences({ orderUpdates: false, compactCards: true }),
    ).rejects.toMatchObject({ code: 'storage_unavailable' });
    expect(context.storage.getItem('bdsolarenergy:preferences')).toBe(original);
    expect(await context.customers.getPreferences()).toEqual({
      orderUpdates: true,
      compactCards: false,
    });
  });

  it('preserves newer data and reports a conflict instead of silently resetting preferences', async () => {
    const context = setup();
    const original = JSON.stringify({
      version: 99,
      updatedAt: runtime.now().toISOString(),
      data: {},
    });
    context.storage.setItem('bdsolarenergy:preferences', original);
    await expect(context.customers.getPreferences()).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      context.customers.updatePreferences({ orderUpdates: false, compactCards: true }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(context.storage.getItem('bdsolarenergy:preferences')).toBe(original);
  });
});
