import { describe, expect, it, vi } from 'vitest';
import type { Runtime } from '../../src/services/contracts';
import { loadFixtureData } from '../../src/services/json/fixtures';
import { createJsonReadRepositories } from '../../src/services/json/read-repositories';
import { createJsonWishlistRepository } from '../../src/services/json/wishlist';
import { createPersistence, MemoryStorage } from '../../src/services/persistence/store';

const runtime: Runtime = {
  now: () => new Date('2026-10-24T00:00:00Z'),
  id: (prefix = 'test') => `${prefix}-1`,
};
const productId = 'product-panels-1';
const unavailableId = 'product-panels-6';

function setup() {
  const storage = new MemoryStorage();
  const store = createPersistence(storage, runtime);
  const { catalogue } = createJsonReadRepositories(runtime);
  let owner = 'guest';
  const create = (source = catalogue) =>
    createJsonWishlistRepository({
      catalogue: source,
      store,
      runtime,
      getOwner: async () => owner,
    });
  return {
    storage,
    store,
    wishlist: create(),
    create,
    owner: (value: string) => {
      owner = value;
    },
  };
}

describe('wishlist repository contract', () => {
  it('honors cancellation during owner resolution even when the wishlist is empty', async () => {
    const storage = new MemoryStorage();
    const store = createPersistence(storage, runtime);
    const { catalogue } = createJsonReadRepositories(runtime);
    let resolveOwner!: (owner: string) => void;
    const owner = new Promise<string>((resolve) => {
      resolveOwner = resolve;
    });
    const wishlist = createJsonWishlistRepository({
      catalogue,
      store,
      runtime,
      getOwner: () => owner,
    });
    const controller = new AbortController();
    const request = wishlist.list({ signal: controller.signal });
    controller.abort();
    resolveOwner('guest');

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(storage.length).toBe(0);
  });

  it('toggles unique product IDs and restores persisted choices', async () => {
    const context = setup();
    expect((await context.wishlist.list()).productIds).toEqual([]);
    await context.wishlist.toggle(productId);
    expect((await context.create().list()).productIds).toEqual([productId]);
    expect((await context.wishlist.toggle(productId)).productIds).toEqual([]);
  });

  it('keeps guest and customer choices separate across account switches', async () => {
    const context = setup();
    await context.wishlist.toggle(productId);
    context.owner('customer-a');
    expect((await context.wishlist.list()).productIds).toEqual([]);
    await context.wishlist.toggle(unavailableId);
    context.owner('customer-b');
    expect((await context.wishlist.list()).productIds).toEqual([]);
    context.owner('guest');
    expect((await context.wishlist.list()).productIds).toEqual([productId]);
  });

  it('deduplicates guest merges, clears guest atomically and does not merge twice', async () => {
    const context = setup();
    await context.wishlist.toggle(productId);
    await context.wishlist.toggle(unavailableId);
    context.owner('customer-a');
    await context.wishlist.toggle(productId);
    const merged = await context.wishlist.mergeGuestWishlist();
    expect(new Set(merged.productIds)).toEqual(new Set([productId, unavailableId]));
    expect((await context.wishlist.mergeGuestWishlist()).productIds).toEqual(merged.productIds);
    context.owner('guest');
    expect((await context.wishlist.list()).productIds).toEqual([]);
  });

  it('removes deleted products with a notice while retaining temporarily unavailable products', async () => {
    const context = setup();
    await context.wishlist.toggle(productId);
    await context.wishlist.toggle(unavailableId);
    const data = loadFixtureData();
    data.fixtures.products = data.fixtures.products.filter((product) => product.id !== productId);
    const { catalogue } = createJsonReadRepositories(runtime, data);
    expect((await context.create(catalogue).list()).productIds).toEqual([unavailableId]);
    expect(context.store.notices().length).toBeGreaterThan(0);
  });

  it('rejects nonexistent product additions instead of persisting invalid IDs', async () => {
    const { wishlist } = setup();
    await expect(wishlist.toggle('missing-product')).rejects.toMatchObject({ code: 'not_found' });
    expect((await wishlist.list()).productIds).toEqual([]);
  });

  it('preserves both source and target when quota blocks an atomic guest merge', async () => {
    const context = setup();
    await context.wishlist.toggle(productId);
    context.owner('customer-a');
    await context.wishlist.toggle(unavailableId);
    const original = context.storage.getItem('bdsolarenergy:wishlists');
    context.storage.setItem = vi.fn(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    await expect(context.wishlist.mergeGuestWishlist()).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    expect(context.storage.getItem('bdsolarenergy:wishlists')).toBe(original);
    expect((await context.wishlist.list()).productIds).toEqual([unavailableId]);
    context.owner('guest');
    expect((await context.wishlist.list()).productIds).toEqual([productId]);
  });
});
