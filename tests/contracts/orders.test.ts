import { describe, expect, it, vi } from 'vitest';
import type { Runtime } from '../../src/services/contracts';
import type { CheckoutInput, Session } from '../../src/types';
import { createJsonCartRepository } from '../../src/services/json/cart';
import { createJsonCheckoutAttemptRepository } from '../../src/services/json/checkout-attempts';
import { commitCheckout, readCheckout } from '../../src/services/json/checkout-state';
import { createJsonOrderRepository } from '../../src/services/json/orders';
import { createJsonReadRepositories } from '../../src/services/json/read-repositories';
import { loadFixtureData } from '../../src/services/json/fixtures';
import { createPersistence, MemoryStorage } from '../../src/services/persistence/store';

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
  let now = new Date('2026-10-24T00:00:00Z');
  let current: Session | null = { userId: 'user-demo', expiresAt: '2026-10-25T00:00:00Z' };
  const runtime: Runtime = { now: () => now, id: (prefix = 'id') => `${prefix}-${++serial}` };
  const storage = new MemoryStorage();
  const store = createPersistence(storage, runtime);
  const repositories = createJsonReadRepositories(runtime, loadFixtureData());
  const auth = { getSession: vi.fn(async () => current) };
  const dependencies = { auth, ...repositories, store, runtime };
  const orders = createJsonOrderRepository(dependencies);
  const createAttempts = () => createJsonCheckoutAttemptRepository({ auth, store, runtime });
  const cart = createJsonCartRepository({
    catalogue: repositories.catalogue,
    store,
    runtime,
    getOwner: async () => current?.userId ?? 'guest',
  });
  return {
    dependencies,
    orders,
    createAttempts,
    attempts: createAttempts(),
    cart,
    store,
    storage,
    runtime,
    owner: (id: string | null) => {
      current = id ? { userId: id, expiresAt: '2026-10-25T00:00:00Z' } : null;
    },
    time: (value: string) => {
      now = new Date(value);
    },
  };
}
async function review(context: ReturnType<typeof setup>, details = input) {
  await context.cart.add(sku, 1);
  const quote = await context.orders.quote(details);
  const key = await context.attempts.getOrCreate(quote.id);
  return { quote, key, input: { ...quote.input, expectedQuoteId: quote.id } };
}

describe('atomic idempotent demo order contract', () => {
  it('commits immutable snapshots, stock reservation and cart clearing in one aggregate write', async () => {
    const context = setup();
    const reviewed = await review(context);
    const write = vi.spyOn(context.storage, 'setItem');
    const order = await context.orders.placeOrder(reviewed.input, reviewed.key);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toBe('bdsolarenergy:checkout');
    expect(order).toMatchObject({
      userId: 'user-demo',
      idempotencyKey: reviewed.key,
      status: 'placed',
      demoOnly: true,
      items: [{ variantId: sku, unitPrice: 1850000, quantity: 1 }],
      totals: reviewed.quote.totals,
      address: {
        recipient: input.address.recipient,
        userId: 'user-demo',
        street: input.address.street,
      },
    });
    const state = readCheckout(context.store);
    expect(state.orders).toEqual([order]);
    expect(state.carts['user-demo'].lines).toEqual([]);
    expect(state.reservations[sku]).toBe(1);
    order.address.street = 'Changed caller street';
    order.items[0].unitPrice = 1;
    expect(readCheckout(context.store).orders[0].address.street).toBe(input.address.street);
    expect(readCheckout(context.store).orders[0].items[0].unitPrice).toBe(1850000);
  });

  it('returns one order for parallel double submits and sequential retries after expiry', async () => {
    const context = setup();
    const reviewed = await review(context);
    const [first, second] = await Promise.all([
      context.orders.placeOrder(reviewed.input, reviewed.key),
      context.orders.placeOrder(reviewed.input, reviewed.key),
    ]);
    expect(second).toEqual(first);
    context.time('2026-10-24T01:00:00Z');
    expect(await context.orders.placeOrder(reviewed.input, reviewed.key)).toEqual(first);
    expect(readCheckout(context.store).orders).toHaveLength(1);
    expect(readCheckout(context.store).reservations[sku]).toBe(1);
  });

  it('retains the attempt key through recreated adapters and failed placement retries', async () => {
    const context = setup();
    const reviewed = await review(context);
    expect(await context.createAttempts().getOrCreate(reviewed.quote.id)).toBe(reviewed.key);
    const write = context.storage.setItem.bind(context.storage);
    context.storage.setItem = vi.fn(() => {
      throw new DOMException('Quota', 'QuotaExceededError');
    });
    const original = context.storage.getItem('bdsolarenergy:checkout');
    await expect(context.orders.placeOrder(reviewed.input, reviewed.key)).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    expect(context.storage.getItem('bdsolarenergy:checkout')).toBe(original);
    expect(readCheckout(context.store).orders).toEqual([]);
    expect(readCheckout(context.store).carts['user-demo'].lines).toHaveLength(1);
    context.storage.setItem = write;
    const restored = createJsonOrderRepository(context.dependencies);
    const key = await context.createAttempts().getOrCreate(reviewed.quote.id);
    const order = await restored.placeOrder(reviewed.input, key);
    expect(order.idempotencyKey).toBe(reviewed.key);
    expect(readCheckout(context.store).orders).toHaveLength(1);
  });

  it('requires a current owned review and explicit demo acknowledgement for new orders', async () => {
    const context = setup();
    const reviewed = await review(context);
    for (const changed of [
      { expectedQuoteId: undefined },
      { expectedQuoteId: 'unknown-quote' },
      { acceptedDemo: false },
      { address: { ...input.address, userId: 'user-second' } },
    ]) {
      await expect(
        context.orders.placeOrder({ ...reviewed.input, ...changed } as never, reviewed.key),
      ).rejects.toMatchObject({
        code: changed.acceptedDemo === false || 'address' in changed ? 'validation' : 'conflict',
      });
    }
    context.time('2026-10-24T00:10:00Z');
    await expect(context.orders.placeOrder(reviewed.input, reviewed.key)).rejects.toMatchObject({
      code: 'conflict',
    });
    expect(readCheckout(context.store).orders).toEqual([]);
    expect(readCheckout(context.store).carts['user-demo'].lines).toHaveLength(1);
  });

  it('requires re-review after a changed price, quantity, address or delivery charge', async () => {
    for (const change of ['price', 'quantity', 'address', 'shipping'] as const) {
      const context = setup();
      const reviewed = await review(context);
      const dependencies = { ...context.dependencies };
      if (change === 'price')
        dependencies.catalogue = {
          ...dependencies.catalogue,
          getVariant: async (...args: Parameters<typeof dependencies.catalogue.getVariant>) => {
            const result = await context.dependencies.catalogue.getVariant(...args);
            result.product.variants[0].price += 10000;
            result.variant.price += 10000;
            return result;
          },
        };
      if (change === 'quantity') await context.cart.setQuantity(sku, 2);
      if (change === 'shipping')
        dependencies.content = {
          ...dependencies.content,
          getCheckoutConfiguration: async () => {
            const config = await context.dependencies.content.getCheckoutConfiguration();
            config.shipping[0].fee += 1000;
            return config;
          },
        };
      const changedInput =
        change === 'address'
          ? { ...reviewed.input, address: { ...input.address, street: 'Another house, Road 20' } }
          : reviewed.input;
      await expect(
        createJsonOrderRepository(dependencies).placeOrder(changedInput, reviewed.key),
      ).rejects.toMatchObject({ code: 'conflict' });
      expect(readCheckout(context.store).orders).toEqual([]);
      expect(readCheckout(context.store).carts['user-demo'].lines).toHaveLength(1);
    }
  });

  it('revalidates coupon expiry and disabled payment options immediately before placement', async () => {
    const context = setup();
    await context.cart.add(sku, 1);
    const dependencies = {
      ...context.dependencies,
      content: {
        ...context.dependencies.content,
        getCheckoutConfiguration: async () => {
          const config = await context.dependencies.content.getCheckoutConfiguration();
          config.coupons.find((coupon) => coupon.code === 'SOLAR10')!.endsAt =
            '2026-10-24T00:01:00Z';
          return config;
        },
      },
    };
    const orders = createJsonOrderRepository(dependencies);
    const quote = await orders.quote({ ...input, couponCode: 'SOLAR10' });
    context.time('2026-10-24T00:02:00Z');
    await expect(
      orders.placeOrder({ ...quote.input, expectedQuoteId: quote.id }, 'coupon-attempt'),
    ).rejects.toMatchObject({ code: 'validation', message: 'This coupon has expired.' });
    const disabled = {
      ...context.dependencies,
      content: {
        ...context.dependencies.content,
        getCheckoutConfiguration: async () => {
          const config = await context.dependencies.content.getCheckoutConfiguration();
          config.payments.forEach((method) => {
            method.enabled = false;
          });
          return config;
        },
      },
    };
    await expect(
      createJsonOrderRepository(disabled).placeOrder(
        { ...quote.input, expectedQuoteId: quote.id },
        'disabled-attempt',
      ),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(readCheckout(context.store).orders).toEqual([]);
  });

  it('uses reservations to reject stock consumed by an earlier order in the same browser aggregate', async () => {
    const context = setup();
    const catalogue = {
      ...context.dependencies.catalogue,
      getVariant: async (...args: Parameters<typeof context.dependencies.catalogue.getVariant>) => {
        const result = await context.dependencies.catalogue.getVariant(...args);
        result.variant.stock = 1;
        result.product.variants.find((variant) => variant.id === args[0])!.stock = 1;
        return result;
      },
    };
    const orders = createJsonOrderRepository({ ...context.dependencies, catalogue });
    await context.cart.add(sku, 1);
    const first = await orders.quote(input);
    context.owner('user-second');
    await context.cart.add(sku, 1);
    const second = await orders.quote(input);
    context.owner('user-demo');
    await orders.placeOrder({ ...first.input, expectedQuoteId: first.id }, 'first-stock-attempt');
    context.owner('user-second');
    await expect(
      orders.placeOrder({ ...second.input, expectedQuoteId: second.id }, 'second-stock-attempt'),
    ).rejects.toMatchObject({ code: 'conflict' });
    const state = readCheckout(context.store);
    expect(state.orders).toHaveLength(1);
    expect(state.reservations[sku]).toBe(1);
    expect(state.carts['user-second'].lines).toHaveLength(1);
  });

  it('keeps successful retry and attempt lookups isolated from guest and second-user access', async () => {
    const context = setup();
    const reviewed = await review(context);
    const first = await context.orders.placeOrder(reviewed.input, reviewed.key);
    context.owner(null);
    await expect(context.orders.placeOrder(reviewed.input, reviewed.key)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await expect(context.attempts.getOrCreate(reviewed.quote.id)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    context.owner('user-second');
    await expect(context.attempts.getOrCreate(reviewed.quote.id)).rejects.toMatchObject({
      code: 'conflict',
    });
    await expect(context.orders.placeOrder(reviewed.input, reviewed.key)).rejects.toMatchObject({
      code: 'validation',
    });
    expect(readCheckout(context.store).orders).toEqual([first]);
  });

  it('rejects session and revision changes during async preparation without overwriting intent', async () => {
    for (const change of ['session', 'revision'] as const) {
      const context = setup();
      const reviewed = await review(context);
      const content = {
        ...context.dependencies.content,
        getCheckoutConfiguration: async () => {
          const config = await context.dependencies.content.getCheckoutConfiguration();
          if (change === 'session') context.owner('user-second');
          else {
            const state = readCheckout(context.store);
            commitCheckout(context.store, state, state.revision);
          }
          return config;
        },
      };
      await expect(
        createJsonOrderRepository({ ...context.dependencies, content }).placeOrder(
          reviewed.input,
          reviewed.key,
        ),
      ).rejects.toMatchObject({ code: 'conflict' });
      expect(readCheckout(context.store).orders).toEqual([]);
      expect(readCheckout(context.store).carts['user-demo'].lines).toHaveLength(1);
    }
  });

  it('rejects a colliding submission identifier without overwriting a retained attempt', async () => {
    const context = setup();
    const reviewed = await review(context);
    const next = await context.orders.quote(input);
    const attempts = createJsonCheckoutAttemptRepository({
      auth: context.dependencies.auth,
      store: context.store,
      runtime: { ...context.runtime, id: () => reviewed.key },
    });
    await expect(attempts.getOrCreate(next.id)).rejects.toMatchObject({ code: 'conflict' });
    expect(await context.createAttempts().getOrCreate(reviewed.quote.id)).toBe(reviewed.key);
    expect(await context.attempts.getOrCreate(next.id)).not.toBe(reviewed.key);
  });

  it('makes a retained key recover a successful order even after the review is superseded', async () => {
    const context = setup();
    const reviewed = await review(context);
    const order = await context.orders.placeOrder(reviewed.input, reviewed.key);
    await context.cart.add(sku, 1);
    await context.orders.quote(input);
    expect(await context.createAttempts().getOrCreate(reviewed.quote.id)).toBe(reviewed.key);
    expect(await context.orders.placeOrder(reviewed.input, reviewed.key)).toEqual(order);
    expect(readCheckout(context.store).orders).toHaveLength(1);
    expect(readCheckout(context.store).carts['user-demo'].lines).toHaveLength(1);
  });
});
