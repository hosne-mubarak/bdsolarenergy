import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createShoppingServices } from '../../services/shopping';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());
function services() {
  return createShoppingServices(
    createJsonReadRepositories({ now: () => new Date(), id: () => 'recovery-test' }),
  );
}
async function signIn(remember = false) {
  const current = services();
  await current.auth.login({ email: 'demo@example.com', password: DEMO_PASSPHRASE, remember });
  return current;
}
function visit(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  const view = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...view };
}
async function footerReset() {
  const footer = await screen.findByRole('contentinfo');
  await userEvent.click(within(footer).getByRole('button', { name: 'Reset demo data' }));
  return screen.findByRole('dialog', { name: 'Reset all demo data?' });
}

describe('public recovery when saved data cannot restore', () => {
  it.each(['local session', 'tab session', 'identities'] as const)(
    'preserves newer %s data until explicit public cleanup, then restores normal sign-in',
    async (aggregate) => {
      await signIn(aggregate === 'local session');
      const storage = aggregate === 'tab session' ? window.sessionStorage : window.localStorage;
      const key = aggregate === 'identities' ? 'bdsolarenergy:identities' : 'bdsolarenergy:session';
      const newer = JSON.stringify({
        version: 99,
        updatedAt: new Date().toISOString(),
        data: { preserved: 'future payload' },
      });
      storage.setItem(key, newer);
      window.localStorage.setItem('unrelated:theme', 'keep');
      const { router } = visit('/account/settings');
      expect(await screen.findByRole('alert')).toHaveTextContent(/newer version/i);
      expect(screen.queryByRole('heading', { name: 'Account settings' })).toBeNull();
      expect(storage.getItem(key)).toBe(newer);
      const cancelled = await footerReset();
      await userEvent.click(within(cancelled).getByRole('button', { name: 'Cancel' }));
      expect(storage.getItem(key)).toBe(newer);
      const dialog = await footerReset();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Reset demo data' }));
      expect(await screen.findByText('Demo data reset')).toBeVisible();
      await waitFor(() => expect(router.state.location.pathname).toBe('/'));
      expect(storage.getItem(key)).toBeNull();
      expect(window.localStorage.getItem('unrelated:theme')).toBe('keep');
      await router.navigate('/account/settings');
      expect(await screen.findByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
      expect(router.state.location.pathname).toBe('/login');
    },
  );

  it('announces a corrupt cart reset while preserving account, address, wishlist and unrelated data', async () => {
    const current = await signIn();
    await current.customers.updateProfile({
      displayName: 'Preserved Customer',
      phone: '01712345678',
    });
    await current.customers.saveAddress({
      recipient: 'Preserved Customer',
      phone: '01712345678',
      division: 'Dhaka',
      district: 'Dhaka',
      area: 'Dhanmondi',
      street: 'House 10, Road 5',
      postcode: '1209',
      isDefault: true,
    });
    await current.wishlist.toggle('product-panels-1');
    await current.cart.add('product-panels-1-v1', 1);
    const retained = ['identities', 'addresses', 'wishlists'].map((key) => [
      key,
      window.localStorage.getItem(`bdsolarenergy:${key}`),
    ]);
    window.localStorage.setItem('unrelated:theme', 'keep');
    window.localStorage.setItem('bdsolarenergy:checkout', '{invalid JSON');
    visit('/cart');
    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
    expect(
      await screen.findByText(/Saved checkout data was invalid or outdated and has been reset/),
    ).toBeVisible();
    for (const [key, saved] of retained)
      expect(window.localStorage.getItem(`bdsolarenergy:${key}`)).toBe(saved);
    expect(window.localStorage.getItem('unrelated:theme')).toBe('keep');
    expect((await current.customers.getProfile()).displayName).toBe('Preserved Customer');
    expect(await current.customers.listAddresses()).toHaveLength(1);
    expect((await current.wishlist.list()).productIds).toEqual(['product-panels-1']);
  });

  it('keeps public products usable when browser storage access is denied and reports unavailable shopping data', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage denied', 'SecurityError');
    });
    visit('/product/panels-550-1');
    expect(await screen.findByRole('heading', { name: '550W Mono solar panel' })).toBeVisible();
    const cart = await screen.findByRole('link', { name: 'Shopping cart (unavailable)' });
    expect(screen.queryByRole('link', { name: 'Shopping cart (0 items)' })).toBeNull();
    const wishlist = await screen.findByRole('button', {
      name: 'Wishlist unavailable for 550W Mono solar panel',
    });
    expect(wishlist).toBeDisabled();
    expect(wishlist).not.toHaveAttribute('aria-pressed');
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Browser storage is unavailable.*check storage settings/i,
    );
    expect(screen.queryByText('Added to cart')).toBeNull();
    expect(screen.getByRole('heading', { name: '550W Mono solar panel' })).toBeVisible();
    await userEvent.click(cart);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(/storage is unavailable/i);
    expect(screen.queryByRole('heading', { name: 'Your cart is empty' })).toBeNull();
  });

  it('retains private form input and the saved profile when browser writes fail', async () => {
    const current = await signIn();
    await current.customers.updateProfile({ displayName: 'Saved Customer', phone: '01712345678' });
    const original = window.localStorage.getItem('bdsolarenergy:identities');
    const { router } = visit('/account/profile/edit');
    const name = await screen.findByLabelText('Full name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Unsaved Customer');
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith('bdsolarenergy:'))
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      write.call(this, key, value);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Browser storage is unavailable/i);
    expect(name).toHaveValue('Unsaved Customer');
    expect(router.state.location.pathname).toBe('/account/profile/edit');
    expect(window.localStorage.getItem('bdsolarenergy:identities')).toBe(original);
    expect((await current.customers.getProfile()).displayName).toBe('Saved Customer');
    expect(screen.queryByText('Profile updated')).toBeNull();
  });
});
