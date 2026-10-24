import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { AuthProvider } from '../../app/providers/AuthProvider';
import { RepositoryProvider } from '../../app/providers/RepositoryProvider';
import { ShoppingContext } from '../../app/providers/shopping-context';
import { ToastProvider } from '../../app/providers/ToastProvider';
import { createAppRoutes } from '../../app/router/routes';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createPersistence, MemoryStorage } from '../../services/persistence/store';
import { createShoppingServices } from '../../services/shopping';
import type { Session } from '../../types';

const runtime = { now: () => new Date(), id: () => 'guard-test' };
const services = () => createShoppingServices(createJsonReadRepositories(runtime));
const credentials = (email = 'demo@example.com') => ({
  email,
  password: DEMO_PASSPHRASE,
  remember: false,
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
function visit(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, client };
}
async function signIn(email = 'demo@example.com') {
  await userEvent.type(await screen.findByRole('textbox', { name: 'Email address' }), email);
  await userEvent.type(screen.getByLabelText('Password', { exact: true }), DEMO_PASSPHRASE);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

async function seedPrivateShopping() {
  const current = services();
  await current.auth.login(credentials());
  await current.cart.add('product-panels-1-v1', 1);
  await current.wishlist.toggle('product-panels-1');
  return current;
}

describe('demo access guards and identity transitions', () => {
  it('expires an old session and resumes the original private URL including its query', async () => {
    window.sessionStorage.setItem(
      'bdsolarenergy:session',
      JSON.stringify({
        version: 1,
        updatedAt: '2026-10-24T00:00:00Z',
        data: { userId: 'user-demo', expiresAt: '2020-01-01T00:00:00Z' },
      }),
    );
    const { router } = visit('/account/profile?tab=delivery');
    expect(await screen.findByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(
      '/account/profile?tab=delivery',
    );
    expect(screen.queryByRole('heading', { name: 'Your profile' })).toBeNull();
    await signIn();
    await waitFor(() => expect(router.state.location.pathname).toBe('/account/profile'));
    expect(router.state.location.search).toBe('?tab=delivery');
    expect(await screen.findByRole('heading', { name: 'Your profile' })).toBeVisible();
  });

  it('waits for session restoration without flashing private content or redirecting to login', async () => {
    const repositories = createJsonReadRepositories(runtime);
    const current = createShoppingServices(repositories, {
      store: createPersistence(new MemoryStorage(), runtime),
      sessionStore: createPersistence(new MemoryStorage(), runtime),
    });
    let restore!: (session: Session) => void;
    const restoration = new Promise<Session>((resolve) => {
      restore = resolve;
    });
    vi.spyOn(current.auth, 'getSession').mockReturnValue(restoration);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/account/profile'] });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <RepositoryProvider repositories={repositories}>
            <ShoppingContext.Provider value={current}>
              <AuthProvider>
                <RouterProvider router={router} />
              </AuthProvider>
            </ShoppingContext.Provider>
          </RepositoryProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/restoring.*session|checking.*session/i)).toBeVisible();
    expect(router.state.location.pathname).toBe('/account/profile');
    expect(screen.queryByRole('heading', { name: 'Your profile' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Sign in to your account' })).toBeNull();
    await act(async () => restore({ userId: 'user-demo', expiresAt: '2099-10-24T00:00:00Z' }));
    expect(await screen.findByRole('heading', { name: 'Your profile' })).toBeVisible();
    client.clear();
  });

  it('merges guest shopping once with stock-limit notices and clears guest intent after success', async () => {
    const current = services();
    await current.auth.login(credentials());
    await current.cart.add('product-panels-1-v1', 4);
    await current.wishlist.toggle('product-panels-1');
    await current.auth.logout();
    await current.cart.add('product-panels-1-v1', 4);
    await current.wishlist.toggle('product-panels-1');
    await current.wishlist.toggle('product-panels-6');
    const { router } = visit('/login?returnTo=%2Fcart');
    await signIn();
    await waitFor(() => expect(router.state.location.pathname).toBe('/cart'));
    expect(
      await screen.findByRole('spinbutton', { name: 'Quantity for 550W Mono solar panel' }),
    ).toHaveValue(5);
    expect(screen.getByRole('link', { name: 'Shopping cart (5 items)' })).toBeVisible();
    expect(
      await within(screen.getByRole('main')).findByText(
        /quantity.*reduced|quantity.*limit|saved quantity.*reduced/i,
      ),
    ).toBeVisible();
    expect((await current.wishlist.list()).productIds).toEqual([
      'product-panels-1',
      'product-panels-6',
    ]);
    const cart = JSON.parse(window.localStorage.getItem('bdsolarenergy:checkout')!);
    const wishlist = JSON.parse(window.localStorage.getItem('bdsolarenergy:wishlists')!);
    expect(cart.data.carts.guest.lines).toEqual([]);
    expect(wishlist.data.byOwner.guest.productIds).toEqual([]);
    await act(() => router.navigate('/login'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/account'));
    expect((await current.cart.getCart()).lines).toEqual([
      { variantId: 'product-panels-1-v1', quantity: 5 },
    ]);
  });

  it('redirects authenticated guest-only visits and clears sessions/private cache on explicit logout', async () => {
    await seedPrivateShopping();
    const { router, client } = visit('/login');
    expect(await screen.findByRole('heading', { name: 'Your account', level: 1 })).toBeVisible();
    expect(router.state.location.pathname).toBe('/account');
    expect(await screen.findByRole('link', { name: 'Shopping cart (1 items)' })).toBeVisible();
    expect(client.getQueryData(['shopping', 'cart', 'user-demo'])).toMatchObject({
      ownerKey: 'user-demo',
    });
    await act(() => router.navigate('/logout'));
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(window.localStorage.getItem('bdsolarenergy:session')).toBeNull();
    expect(window.sessionStorage.getItem('bdsolarenergy:session')).toBeNull();
    expect(client.getQueryData(['shopping', 'cart', 'user-demo'])).toBeUndefined();
    expect(await screen.findByRole('link', { name: 'Shopping cart (0 items)' })).toBeVisible();
  });

  it('does not show the prior customer’s cart or wishlist after a different account signs in', async () => {
    await seedPrivateShopping();
    const { router } = visit('/cart');
    expect(
      await screen.findByRole('spinbutton', { name: 'Quantity for 550W Mono solar panel' }),
    ).toHaveValue(1);
    await act(() => router.navigate('/logout'));
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    await act(() => router.navigate('/login?returnTo=%2Fcart'));
    await signIn('another@example.com');
    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
    expect(
      screen.queryByRole('spinbutton', { name: 'Quantity for 550W Mono solar panel' }),
    ).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'Wishlist (0 items)' }));
    expect(await screen.findByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
  });
});
