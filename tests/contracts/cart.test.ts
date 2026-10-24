import { describe, expect, it, vi } from 'vitest';
import type { Runtime } from '../../src/services/contracts';
import { createJsonCartRepository } from '../../src/services/json/cart';
import { loadFixtureData } from '../../src/services/json/fixtures';
import { createJsonReadRepositories } from '../../src/services/json/read-repositories';
import { createPersistence, MemoryStorage } from '../../src/services/persistence/store';

const runtime: Runtime = {
  now: () => new Date('2026-10-24T00:00:00Z'),
  id: (prefix = 'test') => `${prefix}-1`,
};
const sku = 'product-panels-1-v1';

function setup() {
  const storage = new MemoryStorage();
  const store = createPersistence(storage, runtime);
  const { catalogue } = createJsonReadRepositories(runtime);
  let owner = 'guest';
  const create = (source = catalogue) =>
    createJsonCartRepository({ catalogue: source, store, runtime, getOwner: async () => owner });
  return {
    storage,
    store,
    catalogue,
    cart: create(),
    create,
    owner: (value: string) => {
      owner = value;
    },
  };
}

describe('persistent cart repository contract', () => {
  it('starts empty, merges additions and restores through a new repository instance', async () => {
    const context = setup();
    expect((await context.cart.getCart()).lines).toEqual([]);
    await context.cart.add(sku, 1);
    await context.cart.add(sku, 2);
    expect((await context.create().getCart()).lines).toEqual([{ variantId: sku, quantity: 3 }]);
    expect(context.storage.getItem('bdsolarenergy:checkout')).not.toBeNull();
  });

  it('updates, removes at zero and supports explicit remove and clear', async () => {
    const { cart } = setup();
    await cart.add(sku, 1);
    expect((await cart.setQuantity(sku, 2)).lines[0].quantity).toBe(2);
    expect((await cart.setQuantity(sku, 0)).lines).toEqual([]);
    await cart.add(sku, 1);
    expect((await cart.removeLine(sku)).lines).toEqual([]);
    await cart.add(sku, 1);
    expect((await cart.clear()).lines).toEqual([]);
  });

  it('rejects invalid, excessive and fractional quantities without changing saved intent', async () => {
    const { cart } = setup();
    await cart.add(sku, 1);
    for (const quantity of [-1, 1.5, 6]) {
      await expect(cart.setQuantity(sku, quantity)).rejects.toMatchObject({ code: 'validation' });
    }
    expect((await cart.getCart()).lines).toEqual([{ variantId: sku, quantity: 1 }]);
  });

  it('rejects unavailable/deleted SKU additions rather than storing invalid lines', async () => {
    const { cart } = setup();
    await expect(cart.add('product-panels-6-v1', 1)).rejects.toMatchObject({ code: 'conflict' });
    await expect(cart.add('missing-sku', 1)).rejects.toMatchObject({ code: 'not_found' });
    expect((await cart.getCart()).lines).toEqual([]);
  });

  it('retains both rapid additions after asynchronous owner and product lookups', async () => {
    const { cart } = setup();
    await Promise.all([cart.add(sku, 1), cart.add(sku, 1)]);
    expect((await cart.getCart()).lines).toEqual([{ variantId: sku, quantity: 2 }]);
  });

  it('merges guest intent once, clamps limits and clears guest only after successful persistence', async () => {
    const context = setup();
    await context.cart.add(sku, 4);
    context.owner('customer-a');
    await context.cart.add(sku, 4);
    const merged = await context.cart.mergeGuestCart();
    expect(merged.cart.lines).toEqual([{ variantId: sku, quantity: 5 }]);
    expect(merged.notices.length).toBeGreaterThan(0);
    expect((await context.cart.mergeGuestCart()).cart.lines).toEqual([
      { variantId: sku, quantity: 5 },
    ]);
    context.owner('guest');
    expect((await context.cart.getCart()).lines).toEqual([]);
  });

  it('keeps guest and distinct account carts isolated across owner switches', async () => {
    const context = setup();
    await context.cart.add(sku, 1);
    context.owner('customer-a');
    expect((await context.cart.getCart()).lines).toEqual([]);
    await context.cart.add(sku, 2);
    context.owner('customer-b');
    expect((await context.cart.getCart()).lines).toEqual([]);
    context.owner('guest');
    expect((await context.cart.getCart()).lines[0].quantity).toBe(1);
    context.owner('customer-a');
    expect((await context.cart.getCart()).lines[0].quantity).toBe(2);
  });

  it('recovers a removed SKU without discarding unrelated owner carts', async () => {
    const context = setup();
    await context.cart.add(sku, 1);
    context.owner('customer-a');
    await context.cart.add('product-inverters-1-v1', 1);
    context.owner('guest');
    const data = loadFixtureData();
    data.fixtures.products[0].variants = data.fixtures.products[0].variants.filter(
      (variant) => variant.id !== sku,
    );
    const { catalogue } = createJsonReadRepositories(runtime, data);
    const repaired = context.create(catalogue);
    expect((await repaired.getCart()).lines).toEqual([]);
    expect(context.store.notices().length).toBeGreaterThan(0);
    context.owner('customer-a');
    expect((await repaired.getCart()).lines).toEqual([
      { variantId: 'product-inverters-1-v1', quantity: 1 },
    ]);
  });

  it('repairs reduced inventory and order limits with explanatory notices', async () => {
    const context = setup();
    await context.cart.add(sku, 4);
    const data = loadFixtureData();
    data.fixtures.products[0].variants[0].stock = 2;
    const { catalogue } = createJsonReadRepositories(runtime, data);
    expect((await context.create(catalogue).getCart()).lines).toEqual([
      { variantId: sku, quantity: 2 },
    ]);
    expect(context.store.notices().length).toBeGreaterThan(0);
  });

  it('preserves prior data and rejects mutation success when quota blocks a write', async () => {
    const context = setup();
    await context.cart.add(sku, 1);
    const original = context.storage.getItem('bdsolarenergy:checkout');
    context.storage.setItem = vi.fn(() => {
      throw new DOMException('Quota full', 'QuotaExceededError');
    });
    await expect(context.cart.add(sku, 1)).rejects.toMatchObject({ code: 'storage_unavailable' });
    expect(context.storage.getItem('bdsolarenergy:checkout')).toBe(original);
    expect((await context.cart.getCart()).lines).toEqual([{ variantId: sku, quantity: 1 }]);
  });
});
