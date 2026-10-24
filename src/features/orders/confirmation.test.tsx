import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createShoppingServices } from '../../services/shopping';
import type { CheckoutInput } from '../../types';
import { formatMoney } from '../../utils/currency';

const input: CheckoutInput = {
  address: {
    recipient: 'Original Demo Recipient',
    phone: '01812345678',
    division: 'Dhaka',
    district: 'Dhaka',
    area: 'Dhanmondi',
    street: 'Original delivery house 10',
    postcode: '1209',
    isDefault: true,
  },
  shippingMethodId: 'shipping-dhaka',
  paymentMethodId: 'payment-cod',
  couponCode: 'SOLAR10',
  acceptedDemo: true,
};
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
function services() {
  return createShoppingServices(
    createJsonReadRepositories({ now: () => new Date(), id: () => 'confirmation-test' }),
  );
}
async function seedOrder() {
  const current = services();
  await current.auth.login({
    email: 'demo@example.com',
    password: DEMO_PASSPHRASE,
    remember: false,
  });
  await current.cart.add('product-panels-1-v1', 1);
  const savedAddress = await current.customers.saveAddress(input.address);
  const quote = await current.orders.quote(input);
  const order = await current.orders.placeOrder(
    { ...input, expectedQuoteId: quote.id },
    'confirmation-attempt',
  );
  return { current, savedAddress, order };
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

describe('owned demo order confirmation', () => {
  it('loads an immutable placed-order snapshot directly and after an application refresh', async () => {
    const { current, savedAddress, order } = await seedOrder();
    await current.customers.updateProfile({ displayName: 'Updated profile', phone: '01912345678' });
    await current.customers.saveAddress(
      { ...input.address, recipient: 'Updated recipient', street: 'Updated saved house 99' },
      savedAddress.id,
    );
    const first = visit(`/order-confirmation/${order.id}`);
    expect(await screen.findByRole('heading', { name: 'Demo order confirmed' })).toBeVisible();
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent(order.id);
    expect(main).toHaveTextContent(input.address.recipient);
    expect(main).toHaveTextContent(input.address.street);
    expect(main).toHaveTextContent(order.items[0].productName);
    expect(main).toHaveTextContent(order.items[0].sku);
    expect(main).toHaveTextContent(formatMoney(order.totals.total));
    expect(main).not.toHaveTextContent('Updated saved house 99');
    expect(main).toHaveTextContent('No real payment was collected. No delivery will occur.');
    expect(screen.getByRole('link', { name: 'View order history' })).toHaveAttribute(
      'href',
      '/account/orders',
    );
    first.unmount();
    visit(`/order-confirmation/${order.id}`);
    expect(await screen.findByRole('heading', { name: 'Demo order confirmed' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent(input.address.street);
    expect(screen.getByRole('main')).toHaveTextContent(formatMoney(order.totals.total));
  });

  it('shows a recoverable error for an unknown order reference', async () => {
    await seedOrder();
    visit('/order-confirmation/order-missing');
    expect(await screen.findByRole('alert')).toHaveTextContent(/not found|could not be found/i);
    expect(screen.queryByRole('heading', { name: 'Demo order confirmed' })).toBeNull();
    expect(screen.queryByText(input.address.street)).toBeNull();
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
  });

  it('does not reveal another customer’s confirmation through a direct URL', async () => {
    const { current, order } = await seedOrder();
    await current.auth.logout();
    await current.auth.login({
      email: 'another@example.com',
      password: DEMO_PASSPHRASE,
      remember: false,
    });
    visit(`/order-confirmation/${order.id}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(/not found|could not be found/i);
    expect(screen.queryByRole('heading', { name: 'Demo order confirmed' })).toBeNull();
    expect(screen.getByRole('main')).not.toHaveTextContent(input.address.street);
    expect(screen.getByRole('main')).not.toHaveTextContent(order.items[0].productName);
  });

  it('preserves a direct confirmation URL while redirecting a signed-out customer', async () => {
    const { current, order } = await seedOrder();
    await current.auth.logout();
    const path = `/order-confirmation/${order.id}`;
    const { router } = visit(path);
    expect(await screen.findByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(path);
    expect(screen.queryByRole('heading', { name: 'Demo order confirmed' })).toBeNull();
    expect(screen.getByRole('main')).not.toHaveTextContent(input.address.street);
  });
});
