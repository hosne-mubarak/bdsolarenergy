import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../src/app/providers/AppProviders';
import { createAppRoutes } from '../../src/app/router/routes';
import type { OrderRepository, ReadOptions, Runtime } from '../../src/services/contracts';
import { RepositoryError, throwIfAborted } from '../../src/services/errors';
import { DEMO_PASSPHRASE } from '../../src/services/json/auth';
import { createJsonReadRepositories } from '../../src/services/json/read-repositories';
import { createPersistence, MemoryStorage } from '../../src/services/persistence/store';
import { createShoppingServices } from '../../src/services/shopping';
import type { Order } from '../../src/types';

const snapshot: Order = {
  id: 'adapter-order-001',
  userId: 'user-demo',
  idempotencyKey: 'adapter-attempt-001',
  status: 'placed',
  items: [
    {
      productId: 'adapter-product',
      variantId: 'adapter-option',
      productName: 'Adapter supplied solar kit',
      sku: 'ADAPTER-KIT-01',
      imageId: 'adapter-image',
      quantity: 2,
      unitPrice: 123400,
      lineTotal: 246800,
    },
  ],
  address: {
    id: 'adapter-address',
    userId: 'user-demo',
    recipient: 'Adapter Demo Recipient',
    phone: '01712345678',
    division: 'Dhaka',
    district: 'Dhaka',
    area: 'Mirpur',
    street: 'Adapter delivery snapshot 25',
    postcode: '1216',
    isDefault: false,
  },
  totals: { subtotal: 246800, discount: 0, shipping: 8000, tax: 0, total: 254800 },
  shippingMethodId: 'adapter-shipping',
  paymentMethodId: 'adapter-demo-payment',
  couponCode: null,
  createdAt: '2026-10-24T06:00:00Z',
  tracking: [
    {
      status: 'placed',
      label: 'Adapter supplied demo event, no real shipment.',
      at: '2026-10-24T06:00:00Z',
    },
  ],
  demoOnly: true,
};
async function harness(path = `/account/orders/${snapshot.id}`) {
  let sequence = 0;
  const runtime: Runtime = {
    now: () => new Date('2026-10-24T06:30:00Z'),
    id: (prefix = 'id') => `${prefix}-${++sequence}`,
  };
  const repositories = createJsonReadRepositories(runtime);
  const base = createShoppingServices(repositories, {
    runtime,
    store: createPersistence(new MemoryStorage(), runtime),
    sessionStore: createPersistence(new MemoryStorage(), runtime),
  });
  await base.auth.login({ email: 'demo@example.com', password: DEMO_PASSPHRASE, remember: false });
  async function authorize(options?: ReadOptions) {
    throwIfAborted(options?.signal);
    const session = await base.auth.getSession(options);
    throwIfAborted(options?.signal);
    if (!session || session.userId !== snapshot.userId)
      throw new RepositoryError('unauthenticated');
  }
  const adapter = {
    quote: vi.fn(async () => {
      throw new RepositoryError(
        'unavailable',
        'This read-only test adapter does not quote orders.',
      );
    }),
    placeOrder: vi.fn(async () => {
      throw new RepositoryError(
        'unavailable',
        'This read-only test adapter does not place orders.',
      );
    }),
    listOrders: vi.fn(async (_query, options) => {
      await authorize(options);
      return { items: [structuredClone(snapshot)], page: 1, pageSize: 5, total: 1 };
    }),
    getOrder: vi.fn(async (id, options) => {
      await authorize(options);
      if (id !== snapshot.id) throw new RepositoryError('not_found', 'This order was not found.');
      return structuredClone(snapshot);
    }),
    getTracking: vi.fn(async (id, options) => {
      await authorize(options);
      if (id !== snapshot.id) throw new RepositoryError('not_found', 'This order was not found.');
      return structuredClone(snapshot.tracking);
    }),
  } satisfies OrderRepository;
  const services = { ...base, orders: adapter };
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const mount = () =>
    render(
      <AppProviders repositories={repositories} services={services} client={client}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
  return { base, services, adapter, router, client, mount };
}

describe('feature contracts with a replacement order adapter', () => {
  it('uses supplied order snapshots in detail, history and tracking without changing pages or JSON storage', async () => {
    const current = await harness();
    // The default JSON adapter contains no such order; the injected adapter is the only source.
    expect((await current.base.orders.listOrders()).total).toBe(0);
    current.mount();
    expect(await screen.findByRole('heading', { name: 'Order details' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent(snapshot.items[0].productName);
    expect(screen.getByRole('main')).toHaveTextContent(snapshot.address.street);
    const options = current.adapter.getOrder.mock.calls[0][1];
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.signal?.aborted).toBe(false);
    await userEvent.click(screen.getByRole('link', { name: 'Back to order history' }));
    expect(await screen.findByRole('heading', { name: 'Order history' })).toBeVisible();
    expect(screen.getByRole('link', { name: /^View order details/ })).toHaveAttribute(
      'href',
      `/account/orders/${snapshot.id}`,
    );
    expect(current.adapter.listOrders).toHaveBeenCalledWith(
      { page: 1, pageSize: 5 },
      { signal: expect.any(AbortSignal) },
    );
    await userEvent.click(screen.getByRole('link', { name: /^View order details/ }));
    await userEvent.click(await screen.findByRole('link', { name: 'Track demo order' }));
    expect(await screen.findByRole('heading', { name: 'Demo order tracking' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent(snapshot.tracking[0].label);
    expect(current.adapter.getTracking).toHaveBeenCalledWith(snapshot.id, {
      signal: expect.any(AbortSignal),
    });
    expect(current.adapter.quote).not.toHaveBeenCalled();
    expect(current.adapter.placeOrder).not.toHaveBeenCalled();
  });

  it('renders a normalized missing-record result from the replacement adapter with safe recovery', async () => {
    const current = await harness('/account/orders/adapter-order-missing');
    current.mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('This order was not found.');
    expect(screen.getByRole('heading', { name: 'Order not found' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(screen.queryByText(snapshot.items[0].productName)).toBeNull();
  });

  it('keeps the feature owner check when a replacement adapter incorrectly returns another customer’s order', async () => {
    const current = await harness();
    current.adapter.getOrder.mockResolvedValue({
      ...structuredClone(snapshot),
      userId: 'user-second',
    });
    current.mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your session changed. Reload this order.',
    );
    expect(screen.queryByText(snapshot.items[0].productName)).toBeNull();
    expect(screen.queryByText(snapshot.address.street)).toBeNull();
  });

  it('passes cancellation to a pending adapter request when navigation leaves the order page', async () => {
    const current = await harness();
    let observed: AbortSignal | undefined;
    current.adapter.getOrder.mockImplementation(async (_id, options) => {
      observed = options?.signal;
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Cancelled', 'AbortError')),
          { once: true },
        );
      });
    });
    current.mount();
    await screen.findByText('Loading order…');
    await waitFor(() => expect(observed).toBeDefined());
    await act(() => current.router.navigate('/about'));
    await screen.findByRole('heading', { level: 1, name: 'Energy for everyday possibilities' });
    expect(observed?.aborted).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
