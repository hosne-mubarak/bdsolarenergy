import { describe, expect, it, vi } from 'vitest';
import type { Runtime } from '../../src/services/contracts';
import type { CheckoutInput, Session } from '../../src/types';
import { createJsonCartRepository } from '../../src/services/json/cart';
import { createJsonOrderRepository, readQuotes } from '../../src/services/json/orders';
import { createJsonReadRepositories } from '../../src/services/json/read-repositories';
import { loadFixtureData } from '../../src/services/json/fixtures';
import { createPersistence, MemoryStorage } from '../../src/services/persistence/store';
import { readCheckout, commitCheckout } from '../../src/services/json/checkout-state';

const input: CheckoutInput = {
  address: {
    recipient: 'Demo Customer',
    phone: '01712345678',
    division: 'Dhaka',
    district: 'Dhaka',
    area: 'Dhanmondi',
    street: 'House 10, Road 5',
    postcode: '1209',
    isDefault: false,
  },
  shippingMethodId: 'shipping-dhaka',
  paymentMethodId: 'payment-cod',
  couponCode: '',
  acceptedDemo: true,
};
const sku = 'product-panels-1-v1';
function setup() {
  let serial = 0;
  let current: Session | null = { userId: 'user-demo', expiresAt: '2026-10-25T00:00:00Z' };
  const runtime: Runtime = {
    now: () => new Date('2026-10-24T00:00:00Z'),
    id: (prefix = 'id') => `${prefix}-${++serial}`,
  };
  const storage = new MemoryStorage();
  const store = createPersistence(storage, runtime);
  const data = loadFixtureData();
  const repositories = createJsonReadRepositories(runtime, data);
  const auth = { getSession: vi.fn(async () => current) };
  const cart = createJsonCartRepository({
    catalogue: repositories.catalogue,
    store,
    runtime,
    getOwner: async () => current?.userId ?? 'guest',
  });
  const dependencies = { auth, ...repositories, store, runtime };
  return {
    auth,
    data,
    runtime,
    store,
    storage,
    cart,
    dependencies,
    orders: createJsonOrderRepository(dependencies),
    owner: (id: string | null) => {
      current = id ? { userId: id, expiresAt: '2026-10-25T00:00:00Z' } : null;
    },
  };
}

describe('authoritative checkout quote contract', () => {
  it('rejects guest and empty account carts without manufacturing a review', async () => {
    const context = setup();
    await expect(context.orders.quote(input)).rejects.toMatchObject({ code: 'validation' });
    context.owner(null);
    await expect(context.orders.quote(input)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(readQuotes(context.store)).toEqual({});
  });

  it('calculates current SKU snapshots, coupon and delivery totals with ten-minute validity', async () => {
    const context = setup();
    await context.cart.add(sku, 1);
    const quote = await context.orders.quote({ ...input, couponCode: ' solar10 ' });
    expect(quote).toMatchObject({
      ownerKey: 'user-demo',
      expiresAt: '2026-10-24T00:10:00.000Z',
      items: [{ variantId: sku, quantity: 1, unitPrice: 1850000, lineTotal: 1850000 }],
      totals: { subtotal: 1850000, discount: 185000, shipping: 8000, tax: 0, total: 1673000 },
    });
    expect(readQuotes(context.store)['user-demo']).toEqual(quote);
    quote.items[0].unitPrice = 1;
    expect(readQuotes(context.store)['user-demo'].items[0].unitPrice).toBe(1850000);
    expect((await context.cart.getCart()).lines).toHaveLength(1);
    expect(readCheckout(context.store).orders).toEqual([]);
    expect(readCheckout(context.store).reservations).toEqual({});
  });

  it('allows all configured demo methods and never accepts real payment credentials', async () => {
    const context = setup();
    await context.cart.add(sku, 1);
    for (const paymentMethodId of ['payment-cod', 'payment-mobile', 'payment-card']) {
      expect(
        (await context.orders.quote({ ...input, paymentMethodId })).input.paymentMethodId,
      ).toBe(paymentMethodId);
    }
    await expect(
      context.orders.quote({ ...input, cardNumber: '12345678' } as never),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      context.orders.quote({ ...input, acceptedDemo: false } as never),
    ).rejects.toMatchObject({ code: 'validation' });
    const disabled = {
      ...context.dependencies,
      content: {
        ...context.dependencies.content,
        getCheckoutConfiguration: async () => ({
          ...(await context.dependencies.content.getCheckoutConfiguration()),
          payments: context.data.fixtures.paymentMethods.map((method) => ({
            ...method,
            enabled: false,
          })),
        }),
      },
    };
    await expect(createJsonOrderRepository(disabled).quote(input)).rejects.toMatchObject({
      code: 'validation',
    });
  });

  it('rejects invalid address, coupon, method and unsupported delivery district', async () => {
    const context = setup();
    await context.cart.add(sku, 1);
    for (const change of [
      { address: { ...input.address, phone: '123' } },
      { address: { ...input.address, userId: 'user-second' } },
      { address: { ...input.address, district: 'Unknown district' } },
      { couponCode: 'NO-SUCH-CODE' },
      { couponCode: 'EXPIRED' },
      { shippingMethodId: 'missing' },
      { paymentMethodId: 'missing' },
    ]) {
      await expect(context.orders.quote({ ...input, ...change })).rejects.toMatchObject({
        code: 'validation',
      });
    }
    expect(readQuotes(context.store)).toEqual({});
  });

  it('keeps owner reviews isolated and rejects an identity switch during quote resolution', async () => {
    const context = setup();
    await context.cart.add(sku, 1);
    const first = await context.orders.quote(input);
    context.owner('user-second');
    await expect(context.orders.quote(input)).rejects.toMatchObject({ code: 'validation' });
    await context.cart.add(sku, 2);
    const second = await context.orders.quote(input);
    expect(second.ownerKey).toBe('user-second');
    expect(readQuotes(context.store)['user-demo']).toEqual(first);
    context.auth.getSession
      .mockResolvedValueOnce({ userId: 'user-second', expiresAt: '2026-10-25T00:00:00Z' })
      .mockResolvedValueOnce({ userId: 'user-demo', expiresAt: '2026-10-25T00:00:00Z' });
    await expect(context.orders.quote(input)).rejects.toMatchObject({ code: 'conflict' });
  });

  it('honors cancellation before and during asynchronous data reads without persisting a quote', async () => {
    const context = setup();
    await context.cart.add(sku, 1);
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(context.orders.quote(input, { signal: cancelled.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    const controller = new AbortController();
    const catalogue = {
      ...context.dependencies.catalogue,
      getVariant: async (...args: Parameters<typeof context.dependencies.catalogue.getVariant>) => {
        const result = await context.dependencies.catalogue.getVariant(...args);
        controller.abort();
        return result;
      },
    };
    await expect(
      createJsonOrderRepository({ ...context.dependencies, catalogue }).quote(input, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(readQuotes(context.store)).toEqual({});
  });

  it('rejects a concurrent cart revision and current-aggregate stock reservations', async () => {
    const context = setup();
    await context.cart.add(sku, 1);
    const content = {
      ...context.dependencies.content,
      getCheckoutConfiguration: async () => {
        const result = await context.dependencies.content.getCheckoutConfiguration();
        const state = readCheckout(context.store);
        commitCheckout(context.store, state, state.revision);
        return result;
      },
    };
    await expect(
      createJsonOrderRepository({ ...context.dependencies, content }).quote(input),
    ).rejects.toMatchObject({ code: 'conflict' });
    const state = readCheckout(context.store);
    state.reservations[sku] = 10000;
    commitCheckout(context.store, state, state.revision);
    await expect(context.orders.quote(input)).rejects.toMatchObject({ code: 'conflict' });
    expect(readQuotes(context.store)).toEqual({});
  });

  it('reports failed quote persistence while retaining the cart and all prior data', async () => {
    const context = setup();
    await context.cart.add(sku, 1);
    const previous = context.storage.getItem('bdsolarenergy:checkout');
    context.storage.setItem = vi.fn(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    await expect(context.orders.quote(input)).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    expect(context.storage.getItem('bdsolarenergy:checkout')).toBe(previous);
    expect(readQuotes(context.store)).toEqual({});
  });
});
