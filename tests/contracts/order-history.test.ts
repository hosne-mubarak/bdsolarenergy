import { describe, expect, it, vi } from 'vitest';
import type { Runtime } from '../../src/services/contracts';
import type { CheckoutInput, Session } from '../../src/types';
import { createJsonCartRepository } from '../../src/services/json/cart';
import { commitCheckout, readCheckout } from '../../src/services/json/checkout-state';
import { createJsonOrderRepository } from '../../src/services/json/orders';
import { createJsonReadRepositories } from '../../src/services/json/read-repositories';
import { createJsonCustomerRepository } from '../../src/services/json/customers';
import { createPersistence, MemoryStorage } from '../../src/services/persistence/store';

const input: CheckoutInput = {
  address: {
    recipient: 'Original Customer',
    phone: '01712345678',
    division: 'Dhaka',
    district: 'Dhaka',
    area: 'Dhanmondi',
    street: 'Original House 10, Road 5',
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
  const order = await orders.placeOrder({ ...input, expectedQuoteId: quote.id }, 'history-attempt');
  return {
    auth,
    storage,
    store,
    orders,
    order,
    create,
    runtime,
    customers: createJsonCustomerRepository({ auth, store, runtime }),
    owner: (id: string | null) => {
      current = id ? { userId: id, expiresAt: '2026-10-25T00:00:00Z' } : null;
    },
  };
}

describe('owned order history and deterministic tracking', () => {
  it('paginates only owned orders by descending timestamp with an ID tie-break and clamps the last page', async () => {
    const context = await setup();
    const state = readCheckout(context.store);
    state.orders = [
      {
        ...context.order,
        id: 'older',
        idempotencyKey: 'older-key',
        createdAt: '2026-10-20T00:00:00Z',
      },
      {
        ...context.order,
        id: 'b-tied',
        idempotencyKey: 'b-key',
        createdAt: '2026-10-24T00:00:00Z',
      },
      {
        ...context.order,
        id: 'foreign-newest',
        idempotencyKey: 'foreign-key',
        userId: 'user-second',
        createdAt: '2026-10-25T00:00:00Z',
      },
      {
        ...context.order,
        id: 'a-tied',
        idempotencyKey: 'a-key',
        createdAt: '2026-10-24T00:00:00Z',
      },
    ];
    commitCheckout(context.store, state, state.revision);
    const first = await context.orders.listOrders({ page: 1, pageSize: 2 });
    expect(first).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(first.items.map((order) => order.id)).toEqual(['a-tied', 'b-tied']);
    const last = await context.orders.listOrders({ page: 999, pageSize: 2 });
    expect(last).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(last.items.map((order) => order.id)).toEqual(['older']);
    expect(await context.create().listOrders({ page: 1, pageSize: 2 })).toEqual(first);
  });

  it('returns a coherent empty first page and rejects guest access', async () => {
    const context = await setup();
    context.owner('user-second');
    expect(await context.orders.listOrders({ page: 100, pageSize: 5 })).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 5,
    });
    context.owner(null);
    await expect(context.orders.listOrders()).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(context.orders.getTracking(context.order.id)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects malformed pagination and caller-supplied owner IDs', async () => {
    const context = await setup();
    for (const query of [
      { page: 0 },
      { page: 1.5 },
      { pageSize: 0 },
      { pageSize: 51 },
      { pageSize: NaN },
      { userId: 'user-second' },
    ]) {
      await expect(context.orders.listOrders(query as never)).rejects.toMatchObject({
        code: 'validation',
      });
    }
  });

  it('returns only recorded tracking events and keeps unknown/foreign orders indistinguishable', async () => {
    const context = await setup();
    const tracking = await context.orders.getTracking(context.order.id);
    expect(tracking).toEqual(context.order.tracking);
    expect(tracking).toHaveLength(1);
    context.runtime.now = () => new Date('2026-11-24T00:00:00Z');
    expect(await context.orders.getTracking(context.order.id)).toEqual(tracking);
    tracking[0].label = 'Caller changed event';
    expect(await context.orders.getTracking(context.order.id)).toEqual(context.order.tracking);
    context.owner('user-second');
    const foreign = await context.orders.getTracking(context.order.id).catch((error) => error);
    const missing = await context.orders.getTracking('unknown-order').catch((error) => error);
    expect(foreign).toMatchObject({ code: 'not_found', message: missing.message });
  });

  it('preserves historical address/item snapshots after customer and address book edits', async () => {
    const context = await setup();
    const address = await context.customers.saveAddress(input.address);
    await context.customers.updateProfile({
      displayName: 'Changed Customer',
      phone: '01812345678',
    });
    await context.customers.saveAddress(
      { ...input.address, recipient: 'Changed recipient', street: 'New house, Road 99' },
      address.id,
    );
    const history = await context.orders.listOrders();
    expect(history.items[0].address).toEqual(context.order.address);
    history.items[0].address.street = 'Caller changed snapshot';
    history.items[0].items[0].productName = 'Caller changed item';
    expect((await context.orders.listOrders()).items[0]).toEqual(context.order);
  });

  it('honors cancellation before and during asynchronous owner resolution for both reads', async () => {
    const context = await setup();
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(context.orders.listOrders({}, { signal: cancelled.signal })).rejects.toMatchObject(
      { name: 'AbortError' },
    );
    await expect(
      context.orders.getTracking(context.order.id, { signal: cancelled.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    let resolveOwner!: (value: Session | null) => void;
    context.auth.getSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOwner = resolve;
        }),
    );
    const controller = new AbortController();
    const pending = context.orders.listOrders({}, { signal: controller.signal });
    controller.abort();
    resolveOwner({ userId: 'user-demo', expiresAt: '2026-10-25T00:00:00Z' });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reports storage failures instead of an empty order history or invented tracking events', async () => {
    const context = await setup();
    context.storage.getItem = vi.fn(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    await expect(context.orders.listOrders()).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    await expect(context.orders.getTracking(context.order.id)).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
  });
});
