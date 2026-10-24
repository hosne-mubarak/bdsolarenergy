import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { readCheckout } from '../../services/json/checkout-state';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createShoppingServices } from '../../services/shopping';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());
async function reviewCart() {
  const current = createShoppingServices(
    createJsonReadRepositories({ now: () => new Date(), id: () => 'placement-test' }),
  );
  await current.auth.login({
    email: 'demo@example.com',
    password: DEMO_PASSPHRASE,
    remember: false,
  });
  await current.cart.add('product-panels-1-v1', 1);
  const address = await current.customers.saveAddress({
    recipient: 'Demo Checkout Customer',
    phone: '01812345678',
    division: 'Dhaka',
    district: 'Dhaka',
    area: 'Dhanmondi',
    street: 'House 10, Road 5',
    postcode: '1209',
    isDefault: true,
  });
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/checkout'] });
  const view = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  await userEvent.selectOptions(await screen.findByLabelText('Saved address'), address.id);
  await userEvent.click(
    screen.getByRole('checkbox', {
      name: 'I understand this is a demo order and no payment will be collected',
    }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Review order' }));
  expect(await screen.findByRole('heading', { name: 'Review your order' })).toBeVisible();
  return { current, router, ...view };
}

describe('demo order placement interactions', () => {
  it('double activation places one local order, clears its cart and exposes a confirmation link', async () => {
    const { current } = await reviewCart();
    await userEvent.dblClick(screen.getByRole('button', { name: 'Place demo order' }));
    expect(await screen.findByRole('heading', { name: 'Demo order confirmed' })).toBeVisible();
    const state = readCheckout(current.store);
    expect(state.orders).toHaveLength(1);
    expect((await current.cart.getCart()).lines).toEqual([]);
    expect(screen.getByRole('main')).toHaveTextContent(state.orders[0].id);
    expect(screen.getByRole('link', { name: 'View order history' })).toHaveAttribute(
      'href',
      '/account/orders',
    );
    expect(screen.getByRole('main')).toHaveTextContent(/demo|simulat/i);
  });

  it('preserves the cart after a failed local commit and safely retries to one order', async () => {
    const { current } = await reviewCart();
    const original = Storage.prototype.setItem;
    let rejectCommit = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (rejectCommit && key === 'bdsolarenergy:checkout')
        throw new DOMException('Demo quota exceeded', 'QuotaExceededError');
      original.call(this, key, value);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Place demo order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/storage|save|unavailable/i);
    expect(screen.queryByRole('heading', { name: 'Demo order confirmed' })).toBeNull();
    expect(readCheckout(current.store).orders).toEqual([]);
    expect((await current.cart.getCart()).lines).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Place demo order' })).toBeEnabled(),
    );
    rejectCommit = false;
    await userEvent.click(screen.getByRole('button', { name: 'Place demo order' }));
    expect(await screen.findByRole('heading', { name: 'Demo order confirmed' })).toBeVisible();
    expect(readCheckout(current.store).orders).toHaveLength(1);
    expect((await current.cart.getCart()).lines).toEqual([]);
  });

  it('requires a new review when the cart changes after the quoted summary', async () => {
    const { current } = await reviewCart();
    await current.cart.setQuantity('product-panels-1-v1', 2);
    await userEvent.click(screen.getByRole('button', { name: 'Place demo order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/review|changed|quote/i);
    expect(readCheckout(current.store).orders).toEqual([]);
    expect((await current.cart.getCart()).lines[0].quantity).toBe(2);
    await userEvent.click(screen.getByRole('button', { name: 'Edit checkout' }));
    await userEvent.click(screen.getByRole('button', { name: 'Review order' }));
    expect(await screen.findByRole('heading', { name: 'Review your order' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Place demo order' }));
    expect(await screen.findByRole('heading', { name: 'Demo order confirmed' })).toBeVisible();
    expect(readCheckout(current.store).orders).toHaveLength(1);
    expect(readCheckout(current.store).orders[0].items[0].quantity).toBe(2);
  });
});
