import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createShoppingServices } from '../../services/shopping';
import type { CheckoutInput, Order } from '../../types';
import { formatMoney } from '../../utils/currency';

const input: CheckoutInput = {
  address: {
    recipient: 'History Demo Recipient',
    phone: '01812345678',
    division: 'Dhaka',
    district: 'Dhaka',
    area: 'Dhanmondi',
    street: 'Immutable delivery house 10',
    postcode: '1209',
    isDefault: true,
  },
  shippingMethodId: 'shipping-dhaka',
  paymentMethodId: 'payment-cod',
  couponCode: '',
  acceptedDemo: true,
};
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
async function signIn() {
  const current = createShoppingServices(
    createJsonReadRepositories({ now: () => new Date(), id: () => 'history-test' }),
  );
  await current.auth.login({
    email: 'demo@example.com',
    password: DEMO_PASSPHRASE,
    remember: false,
  });
  return current;
}
async function placeOrders(current: Awaited<ReturnType<typeof signIn>>, count = 1) {
  const orders: Order[] = [];
  for (let index = 0; index < count; index++) {
    await current.cart.add('product-panels-1-v1', 1);
    const quote = await current.orders.quote(input);
    orders.push(
      await current.orders.placeOrder(
        { ...input, expectedQuoteId: quote.id },
        `history-attempt-${index}`,
      ),
    );
  }
  return orders;
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

describe('owned order history, details and deterministic demo tracking', () => {
  it('renders an empty history without inventing sample customer purchases', async () => {
    await signIn();
    visit('/account/orders');
    expect(await screen.findByRole('heading', { name: 'Order history' })).toBeVisible();
    expect(await screen.findByRole('heading', { name: /no.*orders/i })).toBeVisible();
    expect(screen.queryByRole('link', { name: /^View order details/ })).toBeNull();
  });

  it('opens saved order details and tracking, keeping immutable snapshots across refresh', async () => {
    const current = await signIn();
    const [order] = await placeOrders(current);
    await current.customers.updateProfile({
      displayName: 'New profile name',
      phone: '01912345678',
    });
    const first = visit('/account/orders');
    const details = await screen.findByRole('link', { name: /^View order details/ });
    expect(details).toHaveAttribute('href', `/account/orders/${order.id}`);
    await userEvent.click(details);
    expect(await screen.findByRole('heading', { name: 'Order details' })).toBeVisible();
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent(input.address.recipient);
    expect(main).toHaveTextContent(input.address.street);
    expect(main).toHaveTextContent(order.items[0].productName);
    expect(main).toHaveTextContent(order.items[0].sku);
    expect(main).toHaveTextContent(formatMoney(order.totals.total));
    await userEvent.click(screen.getByRole('link', { name: 'Track demo order' }));
    expect(await screen.findByRole('heading', { name: 'Demo order tracking' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent(order.tracking[0].label);
    expect(screen.getByRole('main')).toHaveTextContent(
      /no live shipment|not live|no real shipment/i,
    );
    const trackingPath = first.router.state.location.pathname;
    expect(trackingPath).toBe(`/account/orders/${order.id}/tracking`);
    first.unmount();
    visit(trackingPath);
    expect(await screen.findByRole('heading', { name: 'Demo order tracking' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent(order.tracking[0].label);
  });

  it('paginates six owned orders without missing or duplicating any reference', async () => {
    const current = await signIn();
    const orders = await placeOrders(current, 6);
    visit('/account/orders');
    expect(await screen.findByRole('heading', { name: 'Order history' })).toBeVisible();
    const main = screen.getByRole('main');
    const firstLinks = await within(main).findAllByRole('link', {
      name: /^View order details/,
    });
    expect(firstLinks).toHaveLength(5);
    const firstIds = firstLinks.map((link) => link.getAttribute('href')!.split('/').at(-1));
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(within(main).getAllByRole('link', { name: /^View order details/ })).toHaveLength(1),
    );
    const lastId = within(main)
      .getByRole('link', { name: /^View order details/ })
      .getAttribute('href')!
      .split('/')
      .at(-1);
    expect(new Set([...firstIds, lastId])).toEqual(new Set(orders.map((order) => order.id)));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() =>
      expect(within(main).getAllByRole('link', { name: /^View order details/ })).toHaveLength(5),
    );
  });

  it('keeps another customer’s orders out of history and rejects private detail and tracking URLs', async () => {
    const current = await signIn();
    const [order] = await placeOrders(current);
    await current.auth.logout();
    await current.auth.login({
      email: 'another@example.com',
      password: DEMO_PASSPHRASE,
      remember: false,
    });
    const list = visit('/account/orders');
    expect(await screen.findByRole('heading', { name: /no.*orders/i })).toBeVisible();
    expect(screen.queryByRole('link', { name: /^View order details/ })).toBeNull();
    list.unmount();
    for (const path of [`/account/orders/${order.id}`, `/account/orders/${order.id}/tracking`]) {
      const page = visit(path);
      expect(await screen.findByRole('alert')).toHaveTextContent(/not found|could not be found/i);
      expect(screen.getByRole('main')).not.toHaveTextContent(input.address.street);
      expect(screen.getByRole('main')).not.toHaveTextContent(order.items[0].productName);
      page.unmount();
    }
  });

  it('summarizes the signed-in customer’s actual recent order on the account dashboard', async () => {
    const current = await signIn();
    const [order] = await placeOrders(current);
    visit('/account');
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Recent orders' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent(order.id);
    expect(screen.getByRole('main')).toHaveTextContent(formatMoney(order.totals.total));
    expect(screen.getByRole('link', { name: 'View order history' })).toHaveAttribute(
      'href',
      '/account/orders',
    );
  });
});
