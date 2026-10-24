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
    createJsonReadRepositories({ now: () => new Date(), id: () => 'settings-test' }),
  );
}
async function signIn() {
  const current = services();
  await current.auth.login({
    email: 'demo@example.com',
    password: DEMO_PASSPHRASE,
    remember: false,
  });
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
function demoKeys(storage: Storage) {
  return Object.keys(storage).filter((key) => key.startsWith('bdsolarenergy:'));
}
async function openFooterReset() {
  const footer = await screen.findByRole('contentinfo');
  await userEvent.click(within(footer).getByRole('button', { name: 'Reset demo data' }));
  return screen.findByRole('dialog', { name: 'Reset all demo data?' });
}

describe('account preferences and explicit demo cleanup', () => {
  it('saves fixture-defined preferences and restores them on a fresh account mount', async () => {
    const current = await signIn();
    const first = visit('/account/settings');
    const updates = await screen.findByRole('checkbox', { name: 'Order update preference' });
    const compact = screen.getByRole('checkbox', { name: 'Compact product cards' });
    expect(updates).not.toBeChecked();
    expect(compact).not.toBeChecked();
    await userEvent.click(updates);
    await userEvent.click(compact);
    await userEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(await screen.findByText('Preferences saved')).toBeVisible();
    expect(screen.getByRole('main')).toHaveClass('compact-products');
    expect(await current.customers.getPreferences()).toEqual({
      orderUpdates: true,
      compactCards: true,
    });
    first.unmount();
    visit('/account/settings');
    expect(await screen.findByRole('checkbox', { name: 'Order update preference' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Compact product cards' })).toBeChecked();
    expect(screen.getByRole('main')).toHaveClass('compact-products');
  });

  it('preserves all saved data when cleanup is cancelled', async () => {
    const current = await signIn();
    await current.cart.add('product-panels-1-v1', 1);
    visit('/products');
    const localBefore = { ...window.localStorage };
    const sessionBefore = { ...window.sessionStorage };
    const dialog = await openFooterReset();
    expect(dialog).toHaveTextContent(/cart|orders|addresses|session/i);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect({ ...window.localStorage }).toEqual(localBefore);
    expect({ ...window.sessionStorage }).toEqual(sessionBefore);
    expect((await current.cart.getCart()).lines).toHaveLength(1);
  });

  it('clears only application data in both stores after public confirmation and returns home', async () => {
    const current = await signIn();
    await current.cart.add('product-panels-1-v1', 1);
    window.localStorage.setItem('other-application:theme', 'dark');
    window.sessionStorage.setItem('other-application:tab', 'keep');
    expect(demoKeys(window.localStorage).length).toBeGreaterThan(0);
    expect(demoKeys(window.sessionStorage).length).toBeGreaterThan(0);
    const { router } = visit('/products');
    const dialog = await openFooterReset();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset demo data' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(demoKeys(window.localStorage)).toEqual([]);
    expect(demoKeys(window.sessionStorage)).toEqual([]);
    expect(window.localStorage.getItem('other-application:theme')).toBe('dark');
    expect(window.sessionStorage.getItem('other-application:tab')).toBe('keep');
    expect(await current.auth.getSession()).toBeNull();
  });

  it('completes a reset from protected settings before releasing its session transition', async () => {
    const current = await signIn();
    await current.customers.updatePreferences({ orderUpdates: true, compactCards: true });
    const { router } = visit('/account/settings');
    const main = await screen.findByRole('main');
    await screen.findByRole('heading', { name: 'Account settings' });
    await userEvent.click(within(main).getByRole('button', { name: 'Reset demo data' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset all demo data?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset demo data' }));
    expect(await screen.findByText('Demo data reset')).toBeVisible();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await current.auth.getSession()).toBeNull();
    expect(demoKeys(window.localStorage)).toEqual([]);
    expect(demoKeys(window.sessionStorage)).toEqual([]);
    await router.navigate('/account/settings');
    expect(await screen.findByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/login');
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(
      '/account/settings',
    );
  });

  it('shows a storage removal failure without claiming a successful reset', async () => {
    const current = await signIn();
    await current.cart.add('product-panels-1-v1', 1);
    visit('/products');
    const dialog = await openFooterReset();
    const remove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
      if (key.startsWith('bdsolarenergy:'))
        throw new DOMException('Storage denied', 'SecurityError');
      remove.call(this, key);
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset demo data' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /storage|reset|unavailable/i,
    );
    expect(demoKeys(window.localStorage).length).toBeGreaterThan(0);
    expect(screen.queryByText(/demo data (has been |was )?reset/i)).toBeNull();
  });
});
