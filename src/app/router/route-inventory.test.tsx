import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, matchRoutes, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../providers/AppProviders';
import { createAppRoutes } from './routes';
import { GuestOnlyRoute, ProtectedRoute } from '../../features/auth/RouteGuards';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createShoppingServices } from '../../services/shopping';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { RepositoryError } from '../../services/errors';
import type { PublicRepositories } from '../../services/public';

// Every route in approved plan section 8 has an explicit concrete example and access class.
const inventory = [
  ['/', 'P'],
  ['/products', 'P'],
  ['/category/solar', 'P'],
  ['/category/solar/panels', 'P'],
  ['/search?q=panel', 'P'],
  ['/featured', 'P'],
  ['/best-sellers', 'P'],
  ['/new-arrivals', 'P'],
  ['/offers', 'P'],
  ['/product/panels-550-1', 'P'],
  ['/cart', 'P'],
  ['/wishlist', 'P'],
  ['/checkout', 'A'],
  ['/order-confirmation/order-example', 'A'],
  ['/login', 'G'],
  ['/register', 'G'],
  ['/forgot-password', 'G'],
  ['/reset-password', 'G'],
  ['/verify-email', 'P'],
  ['/logout', 'A'],
  ['/unauthorized', 'P'],
  ['/account', 'A'],
  ['/account/profile', 'A'],
  ['/account/profile/edit', 'A'],
  ['/account/password', 'A'],
  ['/account/addresses', 'A'],
  ['/account/addresses/new', 'A'],
  ['/account/addresses/address-example/edit', 'A'],
  ['/account/orders', 'A'],
  ['/account/orders/order-example', 'A'],
  ['/account/orders/order-example/tracking', 'A'],
  ['/account/wishlist', 'A'],
  ['/account/settings', 'A'],
  ['/about', 'P'],
  ['/contact', 'P'],
  ['/faq', 'P'],
  ['/shipping-delivery', 'P'],
  ['/returns-refunds', 'P'],
  ['/warranty', 'P'],
  ['/privacy', 'P'],
  ['/terms', 'P'],
  ['/unknown-route-example', '404'],
] as const;
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());
function repositories() {
  return createJsonReadRepositories({
    now: () => new Date('2026-10-24T12:00:00Z'),
    id: () => 'route-audit',
  });
}
function visit(path: string, services: PublicRepositories = repositories()) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  const view = render(
    <AppProviders repositories={services}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...view };
}
async function signIn() {
  const current = createShoppingServices(repositories());
  await current.auth.login({
    email: 'demo@example.com',
    password: DEMO_PASSPHRASE,
    remember: false,
  });
}

describe('approved route inventory wiring', () => {
  it.each(inventory)(
    '%s resolves a concrete %s screen and its required access boundary',
    async (path, access) => {
      const matches = matchRoutes(createAppRoutes(), path);
      expect(matches?.length).toBeGreaterThan(0);
      const leaf = matches!.at(-1)!.route;
      expect(leaf.path === '*').toBe(access === '404');
      expect(matches!.some(({ route }) => route.Component === ProtectedRoute)).toBe(access === 'A');
      expect(matches!.some(({ route }) => route.Component === GuestOnlyRoute)).toBe(access === 'G');
      for (const { route } of matches!) {
        const module = typeof route.lazy === 'function' ? await route.lazy() : undefined;
        const component = module?.Component ?? route.Component;
        if (component) expect(component.name).not.toMatch(/scaffold|foundation/i);
        if (route === leaf) expect(component).toBeDefined();
      }
    },
  );
});

describe('route recovery and honest empty/failure states', () => {
  it('rejects missing products, unknown categories and invalid parent-child category pairs', async () => {
    for (const path of [
      '/product/product-missing',
      '/category/missing',
      '/category/electrical/panels',
    ]) {
      const page = visit(path);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        /not found|could not be found|no longer/i,
      );
      expect(within(screen.getByRole('main')).queryAllByRole('article')).toHaveLength(0);
      expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
      page.unmount();
    }
  });

  it('keeps missing owned address/order/tracking IDs recoverable without rendering editors or snapshots', async () => {
    await signIn();
    for (const path of [
      '/account/addresses/address-missing/edit',
      '/order-confirmation/order-missing',
      '/account/orders/order-missing',
      '/account/orders/order-missing/tracking',
    ]) {
      const page = visit(path);
      expect(await screen.findByRole('alert')).toHaveTextContent(/not found|could not be found/i);
      expect(screen.queryByLabelText('Recipient name')).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Order summary' })).toBeNull();
      page.unmount();
    }
  });

  it('offers useful product recovery from empty search, cart, wishlist and order history', async () => {
    await signIn();
    for (const [path, heading] of [
      ['/search?q=definitely-no-matching-product', 'No products found'],
      ['/cart', 'Your cart is empty'],
      ['/wishlist', 'Your wishlist is empty'],
      ['/account/orders', 'No demo orders yet'],
    ]) {
      const page = visit(path);
      expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
      expect(
        within(screen.getByRole('main')).getByRole('link', {
          name: /browse.*products|explore products/i,
        }),
      ).toHaveAttribute('href', '/products');
      page.unmount();
    }
  });

  it('recovers catalogue read failures with a real successful retry', async () => {
    const services = repositories();
    const read = vi
      .spyOn(services.catalogue, 'listProducts')
      .mockRejectedValueOnce(
        new RepositoryError('storage_unavailable', 'Catalogue read unavailable.'),
      );
    visit('/products', services);
    expect(await screen.findByRole('alert')).toHaveTextContent('Catalogue read unavailable.');
    expect(within(screen.getByRole('main')).queryAllByRole('article')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'All products' })).toBeVisible();
    expect(within(screen.getByRole('main')).getAllByRole('article').length).toBeGreaterThan(0);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('keeps the public catalogue readable when storage is denied and reports an unavailable cart instead of zero', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Browser storage denied', 'SecurityError');
    });
    visit('/products');
    expect(await screen.findByRole('heading', { level: 1, name: 'All products' })).toBeVisible();
    expect(within(screen.getByRole('main')).getAllByRole('article').length).toBeGreaterThan(0);
    const cart = await screen.findByRole('link', { name: 'Shopping cart (unavailable)' });
    expect(screen.queryByRole('link', { name: 'Shopping cart (0 items)' })).toBeNull();
    await userEvent.click(cart);
    expect(await screen.findByRole('alert')).toHaveTextContent(/storage|unavailable/i);
    expect(screen.queryByRole('heading', { name: 'Your cart is empty' })).toBeNull();
  });

  it('renders the shared 404 recovery for unknown public and authenticated account paths', async () => {
    await signIn();
    for (const path of ['/not-a-store-page', '/account/not-an-account-page']) {
      const page = visit(path);
      expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
      expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
      page.unmount();
    }
  });
});
