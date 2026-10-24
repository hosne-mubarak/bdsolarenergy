import { describe, expect, it } from 'vitest';
import { createShoppingServices } from '../../src/services/shopping';
import { createJsonReadRepositories } from '../../src/services/json/read-repositories';
import { createPersistence, MemoryStorage } from '../../src/services/persistence/store';
import type { Runtime } from '../../src/services/contracts';
import type { AddressInput } from '../../src/types';

const address: AddressInput = {
  recipient: 'Integration Customer',
  phone: '01812345678',
  division: 'Dhaka',
  district: 'Dhaka',
  area: 'Dhanmondi',
  street: 'House 10, Road 5',
  postcode: '1209',
  isDefault: true,
};
function setup() {
  let serial = 0;
  let now = new Date('2026-10-24T00:00:00Z');
  const runtime: Runtime = {
    now: () => new Date(now),
    id: (prefix = 'test') => `${prefix}-${++serial}`,
  };
  const store = createPersistence(new MemoryStorage(), runtime);
  const sessionStore = createPersistence(new MemoryStorage(), runtime);
  const repositories = createJsonReadRepositories(runtime);
  const recreate = () => createShoppingServices(repositories, { runtime, store, sessionStore });
  return {
    current: recreate(),
    recreate,
    advance: () => {
      now = new Date(now.getTime() + 2 * 86_400_000);
    },
  };
}
const login = { email: 'demo@example.com', password: 'SolarDemo123!', remember: false };

describe('composed JSON shopping lifecycle', () => {
  it('preserves one owned purchase through guest merging, account changes, recreated services and account switching', async () => {
    const { current, recreate } = setup();
    await current.cart.add('product-panels-1-v1', 1);
    await current.wishlist.toggle('product-panels-1');
    await current.auth.login(login);
    await current.cart.mergeGuestCart();
    await current.cart.mergeGuestCart();
    await current.wishlist.mergeGuestWishlist();
    await current.wishlist.mergeGuestWishlist();
    expect((await current.cart.getCart()).lines).toEqual([
      { variantId: 'product-panels-1-v1', quantity: 1 },
    ]);
    expect((await current.wishlist.list()).productIds).toEqual(['product-panels-1']);
    const saved = await current.customers.saveAddress(address);
    await current.customers.updatePreferences({ orderUpdates: true, compactCards: true });
    const input = {
      address,
      shippingMethodId: 'shipping-dhaka',
      paymentMethodId: 'payment-mobile',
      couponCode: 'SOLAR10',
      acceptedDemo: true as const,
    };
    const quote = await current.orders.quote(input);
    const key = await current.checkoutAttempts.getOrCreate(quote.id);
    const [first, duplicate] = await Promise.all([
      current.orders.placeOrder({ ...input, expectedQuoteId: quote.id }, key),
      current.orders.placeOrder({ ...input, expectedQuoteId: quote.id }, key),
    ]);
    expect(first.id).toBe(duplicate.id);
    expect(first.totals.total).toBe(1_673_000);
    expect((await current.cart.getCart()).lines).toEqual([]);
    await current.customers.saveAddress(
      { ...address, street: 'Changed address after purchase' },
      saved.id,
    );
    await current.customers.updateProfile({ displayName: 'Changed profile', phone: '01912345678' });
    const restored = recreate();
    expect(await restored.checkoutAttempts.getOrCreate(quote.id)).toBe(key);
    expect(await restored.orders.getOrder(first.id)).toMatchObject({
      address: { street: address.street },
      demoOnly: true,
    });
    expect((await restored.orders.listOrders()).total).toBe(1);
    expect(await restored.orders.getTracking(first.id)).toHaveLength(1);
    await restored.auth.logout();
    expect((await restored.cart.getCart()).lines).toEqual([]);
    expect((await restored.wishlist.list()).productIds).toEqual([]);
    await expect(restored.orders.getOrder(first.id)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await restored.auth.login({ ...login, email: 'another@example.com' });
    expect((await restored.orders.listOrders()).total).toBe(0);
    expect(await restored.customers.listAddresses()).toEqual([]);
    expect(await restored.customers.getPreferences()).toEqual({
      orderUpdates: false,
      compactCards: false,
    });
    await expect(restored.orders.getOrder(first.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('expires tab sessions without erasing the customer’s persisted shopping intent', async () => {
    const { current, recreate, advance } = setup();
    await current.auth.login(login);
    await current.cart.add('product-panels-1-v1', 2);
    await current.customers.saveAddress(address);
    advance();
    const restored = recreate();
    expect(await restored.auth.getSession()).toBeNull();
    expect((await restored.cart.getCart()).lines).toEqual([]);
    await expect(restored.customers.listAddresses()).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await restored.auth.login(login);
    expect((await restored.cart.getCart()).lines).toEqual([
      { variantId: 'product-panels-1-v1', quantity: 2 },
    ]);
    expect(await restored.customers.listAddresses()).toHaveLength(1);
  });
});
