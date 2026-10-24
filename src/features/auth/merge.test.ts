import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createShoppingServices } from '../../services/shopping';
import { createPersistence, MemoryStorage } from '../../services/persistence/store';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { readCheckout } from '../../services/json/checkout-state';
import { RepositoryError } from '../../services/errors';
import { completeSignIn } from './complete-sign-in';

function setup() {
  let serial = 0;
  const runtime = {
    now: () => new Date('2026-10-24T00:00:00Z'),
    id: (prefix = 'id') => `${prefix}-${++serial}`,
  };
  const store = createPersistence(new MemoryStorage(), runtime);
  const sessionStore = createPersistence(new MemoryStorage(), runtime);
  const services = createShoppingServices(createJsonReadRepositories(runtime), {
    store,
    sessionStore,
    runtime,
  });
  return { services, client: new QueryClient() };
}
const login = { email: 'demo@example.com', password: DEMO_PASSPHRASE, remember: false };
describe('sign-in merge and private cache transition', () => {
  it('merges once, reports reductions and removes cached private projections', async () => {
    const { services, client } = setup();
    await services.cart.add('product-panels-1-v1', 3);
    await services.wishlist.toggle('product-panels-1');
    await services.auth.login(login);
    await services.cart.add('product-panels-1-v1', 4);
    client.setQueryData(['shopping', 'profile', 'old-user'], { displayName: 'Old user' });
    await completeSignIn(services, client);
    expect((await services.cart.getCart()).lines[0].quantity).toBe(5);
    expect((await services.wishlist.list()).productIds).toEqual(['product-panels-1']);
    expect(services.store.notices().length).toBeGreaterThan(0);
    expect(client.getQueryData(['shopping', 'profile', 'old-user'])).toBeUndefined();
    await completeSignIn(services, client);
    expect((await services.cart.getCart()).lines[0].quantity).toBe(5);
    expect(readCheckout(services.store).carts.guest.lines).toEqual([]);
  });
  it('preserves shopping data through a partial merge failure and retries safely', async () => {
    const { services, client } = setup();
    await services.cart.add('product-panels-1-v1', 2);
    await services.wishlist.toggle('product-panels-1');
    await services.auth.login(login);
    const merge = services.wishlist.mergeGuestWishlist.bind(services.wishlist);
    services.wishlist.mergeGuestWishlist = vi
      .fn()
      .mockRejectedValueOnce(new RepositoryError('storage_unavailable'));
    await expect(completeSignIn(services, client)).rejects.toThrow(/preserved/);
    expect(await services.auth.getSession()).toBeNull();
    expect(readCheckout(services.store).carts['user-demo'].lines[0].quantity).toBe(2);
    expect((await services.wishlist.list()).productIds).toEqual(['product-panels-1']);
    services.wishlist.mergeGuestWishlist = merge;
    await services.auth.login(login);
    await completeSignIn(services, client);
    expect((await services.cart.getCart()).lines[0].quantity).toBe(2);
    expect((await services.wishlist.list()).productIds).toEqual(['product-panels-1']);
  });
});
