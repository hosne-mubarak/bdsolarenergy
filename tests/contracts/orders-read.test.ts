import { describe, expect, it, vi } from 'vitest';
import type { Runtime } from '../../src/services/contracts';
import type { CheckoutInput, Session } from '../../src/types';
import { createJsonCartRepository } from '../../src/services/json/cart';
import { createJsonOrderRepository } from '../../src/services/json/orders';
import { createJsonReadRepositories } from '../../src/services/json/read-repositories';
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
async function setup() {
  let serial = 0;
  let current: Session | null = { userId: 'user-demo', expiresAt: '2026-10-25T00:00:00Z' };
  const runtime: Runtime = {
    now: () => new Date('2026-10-24T00:00:00Z'),
    id: (prefix = 'id') => `${prefix}-${++serial}`,
  };
  const storage = new MemoryStorage();
  const store = createPersistence(storage, runtime);
  const repositories = createJsonReadRepositories(runtime);
  const auth = { getSession: vi.fn(async () => current) };
  const dependencies = { auth, ...repositories, store, runtime };
  const create = () => createJsonOrderRepository(dependencies);
  const orders = create();
  const cart = createJsonCartRepository({
    catalogue: repositories.catalogue,
    store,
    runtime,
    getOwner: async () => current?.userId ?? 'guest',
  });
  await cart.add('product-panels-1-v1', 1);
  const quote = await orders.quote(input);
  const order = await orders.placeOrder(
    { ...input, expectedQuoteId: quote.id },
    'read-order-attempt',
  );
  return {
    auth,
    storage,
    orders,
    order,
    create,
    owner: (id: string | null) => {
      current = id ? { userId: id, expiresAt: '2026-10-25T00:00:00Z' } : null;
    },
  };
}

describe('owned order lookup contract', () => {
  it('restores an immutable confirmation snapshot through a recreated adapter', async () => {
    const context = await setup();
    const restored = await context.create().getOrder(context.order.id);
    expect(restored).toEqual(context.order);
    restored.address.street = 'Mutated caller street';
    restored.items[0].productName = 'Mutated item';
    restored.totals.total = 1;
    expect(await context.orders.getOrder(context.order.id)).toEqual(context.order);
  });

  it('returns identical not-found errors for missing and foreign orders and rejects guests', async () => {
    const context = await setup();
    context.owner('user-second');
    const foreign = await context.orders.getOrder(context.order.id).catch((error) => error);
    const missing = await context.orders.getOrder('unknown-order').catch((error) => error);
    expect(foreign).toMatchObject({ code: 'not_found', message: missing.message });
    context.owner(null);
    await expect(context.orders.getOrder(context.order.id)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('honors cancellation before and during asynchronous owner resolution', async () => {
    const context = await setup();
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      context.orders.getOrder(context.order.id, { signal: cancelled.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    let resolveOwner!: (value: Session | null) => void;
    context.auth.getSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOwner = resolve;
        }),
    );
    const controller = new AbortController();
    const reading = context.orders.getOrder(context.order.id, { signal: controller.signal });
    controller.abort();
    resolveOwner({ userId: 'user-demo', expiresAt: '2026-10-25T00:00:00Z' });
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reports unavailable storage without inventing order success', async () => {
    const context = await setup();
    context.storage.getItem = vi.fn(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    await expect(context.orders.getOrder(context.order.id)).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
  });
});
