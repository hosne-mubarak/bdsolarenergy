import { act, render, screen, within } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { ShoppingContext } from '../../app/providers/shopping-context';
import { createAppRoutes } from '../../app/router/routes';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createShoppingServices } from '../../services/shopping';
import { RepositoryError } from '../../services/errors';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
it('marks cached shopping counts unavailable when a dashboard refresh fails', async () => {
  const repositories = createJsonReadRepositories({
    now: () => new Date('2026-10-24T00:00:00Z'),
    id: () => 'dashboard-feedback',
  });
  const services = createShoppingServices(repositories);
  await services.auth.login({
    email: 'demo@example.com',
    password: DEMO_PASSPHRASE,
    remember: false,
  });
  await services.cart.add('product-panels-1-v1', 1);
  await services.wishlist.toggle('product-panels-1');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/account'] });
  render(
    <AppProviders client={client} repositories={repositories}>
      <ShoppingContext.Provider value={services}>
        <RouterProvider router={router} />
      </ShoppingContext.Provider>
    </AppProviders>,
  );
  expect(await screen.findByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
  const main = screen.getByRole('main');
  const cartCard = within(main).getByRole('link', { name: /Your cart/ });
  const wishlistCard = within(main).getByRole('link', { name: /Saved essentials/ });
  expect(await within(cartCard).findByText('1 items')).toBeVisible();
  expect(await within(wishlistCard).findByText('1 saved products')).toBeVisible();
  vi.spyOn(services.cart, 'getCart').mockRejectedValue(new RepositoryError('storage_unavailable'));
  vi.spyOn(services.wishlist, 'list').mockRejectedValue(new RepositoryError('storage_unavailable'));
  await act(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['shopping', 'cart'] }),
      client.invalidateQueries({ queryKey: ['shopping', 'wishlist'] }),
    ]);
  });
  expect(await within(cartCard).findByText(/Cart information unavailable/)).toBeVisible();
  expect(await within(wishlistCard).findByText(/Wishlist information unavailable/)).toBeVisible();
  expect(within(cartCard).queryByText('1 items')).toBeNull();
  expect(within(wishlistCard).queryByText('1 saved products')).toBeNull();
  expect(cartCard).toHaveAttribute('href', '/cart');
  expect(wishlistCard).toHaveAttribute('href', '/account/wishlist');
  client.clear();
});
