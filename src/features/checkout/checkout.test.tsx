import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createShoppingServices } from '../../services/shopping';
import type { AddressInput } from '../../types';
import { formatMoney } from '../../utils/currency';

const address: AddressInput = {
  recipient: 'Checkout Customer',
  phone: '01812345678',
  division: 'Dhaka',
  district: 'Dhaka',
  area: 'Dhanmondi',
  street: 'House 10, Road 5',
  postcode: '1209',
  isDefault: true,
};
const acknowledgement = 'I understand this is a demo order and no payment will be collected';
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
async function signedInCart(withItem = true) {
  const current = createShoppingServices(
    createJsonReadRepositories({ now: () => new Date(), id: () => 'checkout-test' }),
  );
  await current.auth.login({
    email: 'demo@example.com',
    password: DEMO_PASSPHRASE,
    remember: false,
  });
  if (withItem) await current.cart.add('product-panels-1-v1', 1);
  return current;
}
function visit(path = '/checkout') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  const view = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...view };
}
async function fillAddress(phone = address.phone) {
  await userEvent.type(await screen.findByLabelText('Recipient name'), address.recipient);
  await userEvent.type(screen.getByLabelText('Phone number'), phone);
  await userEvent.type(screen.getByLabelText('Division'), address.division);
  await userEvent.type(screen.getByLabelText('District'), address.district);
  await userEvent.type(screen.getByLabelText('Area'), address.area);
  await userEvent.type(screen.getByLabelText('Street address'), address.street);
  await userEvent.type(screen.getByLabelText('Postal code'), address.postcode!);
  await userEvent.click(screen.getByRole('button', { name: 'Use this address' }));
}
async function review(coupon = '') {
  await userEvent.selectOptions(screen.getByLabelText('Delivery method'), 'shipping-dhaka');
  await userEvent.selectOptions(screen.getByLabelText('Payment method'), 'payment-cod');
  if (coupon) await userEvent.type(screen.getByLabelText('Coupon code'), coupon);
  await userEvent.click(screen.getByRole('checkbox', { name: acknowledgement }));
  await userEvent.click(screen.getByRole('button', { name: 'Review order' }));
}

describe('validated demo checkout and authoritative quote review', () => {
  it('restores the original checkout URL for a guest signing in', async () => {
    const { router } = visit('/checkout?coupon=SOLAR10');
    expect(await screen.findByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(
      '/checkout?coupon=SOLAR10',
    );
    expect(screen.queryByRole('heading', { name: 'Checkout' })).toBeNull();
  });

  it('blocks checkout for an empty signed-in cart with a catalogue recovery link', async () => {
    await signedInCart(false);
    visit();
    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Review order' })).toBeNull();
    expect(screen.getByRole('link', { name: /explore|browse|products/i })).toHaveAttribute(
      'href',
      '/products',
    );
  });

  it('reviews a valid new address and coupon with domain-calculated totals without placing an order', async () => {
    const current = await signedInCart();
    visit();
    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeVisible();
    await fillAddress();
    await review('SOLAR10');
    expect(await screen.findByRole('heading', { name: 'Review your order' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Review your order' })).toHaveFocus();
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent(address.recipient);
    expect(main).toHaveTextContent(address.street);
    expect(main).toHaveTextContent(formatMoney(1_850_000));
    expect(main).toHaveTextContent(formatMoney(185_000));
    expect(main).toHaveTextContent(formatMoney(8_000));
    expect(main).toHaveTextContent(formatMoney(1_673_000));
    expect(main).toHaveTextContent(/demo|simulation/i);
    expect((await current.cart.getCart()).lines).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Edit checkout' }));
    expect(await screen.findByRole('button', { name: 'Review order' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Delivery address' })).toHaveFocus();
    expect(screen.getByLabelText('Coupon code')).toHaveValue('SOLAR10');
  });

  it('uses an owned saved default address and exposes simulated payment choices without credential fields', async () => {
    const current = await signedInCart();
    const saved = await current.customers.saveAddress(address);
    visit();
    const select = await screen.findByLabelText('Saved address');
    expect(screen.getByRole('option', { name: /Checkout Customer.*default/ })).toBeInTheDocument();
    await userEvent.selectOptions(select, saved.id);
    expect(select).toHaveValue(saved.id);
    expect(screen.getByRole('option', { name: 'New address' })).toBeInTheDocument();
    const payment = screen.getByLabelText('Payment method');
    await userEvent.selectOptions(payment, 'payment-card');
    expect(screen.queryByLabelText(/card number|cvv|security code/i)).toBeNull();
    await userEvent.selectOptions(payment, 'payment-mobile');
    expect(screen.queryByLabelText(/^(account number|pin|otp)$/i)).toBeNull();
    await userEvent.click(screen.getByRole('checkbox', { name: acknowledgement }));
    await userEvent.click(screen.getByRole('button', { name: 'Review order' }));
    expect(await screen.findByRole('heading', { name: 'Review your order' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent(address.street);
  });

  it('rejects an invalid delivery phone before review without mutating the cart', async () => {
    const current = await signedInCart();
    visit();
    await fillAddress('123');
    await waitFor(() =>
      expect(screen.getByLabelText('Phone number')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(screen.queryByRole('heading', { name: 'Review your order' })).toBeNull();
    expect((await current.cart.getCart()).lines).toHaveLength(1);
  });

  it('keeps delivery input available when an invalid coupon prevents a quote', async () => {
    const current = await signedInCart();
    visit();
    await fillAddress();
    await review('DOES-NOT-EXIST');
    expect(await screen.findByRole('alert')).toHaveTextContent(/coupon|code/i);
    expect(screen.queryByRole('heading', { name: 'Review your order' })).toBeNull();
    expect(screen.getByLabelText('Coupon code')).toHaveValue('DOES-NOT-EXIST');
    expect((await current.cart.getCart()).lines).toHaveLength(1);
  });

  it('retains new delivery fields after review and requires edited addresses to be validated again', async () => {
    await signedInCart();
    visit();
    await fillAddress();
    expect(screen.queryByRole('checkbox', { name: 'Make this my default address' })).toBeNull();
    await review();
    expect(await screen.findByRole('heading', { name: 'Review your order' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Edit checkout' }));
    expect(await screen.findByLabelText('Recipient name')).toHaveValue(address.recipient);
    expect(screen.getByLabelText('Phone number')).toHaveValue(address.phone);
    expect(screen.getByLabelText('Street address')).toHaveValue(address.street);
    const phone = screen.getByLabelText('Phone number');
    await userEvent.clear(phone);
    await userEvent.type(phone, '123');
    expect(screen.getByRole('button', { name: 'Review order' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Use this address' }));
    await waitFor(() => expect(phone).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByRole('button', { name: 'Review order' })).toBeDisabled();
    await userEvent.clear(phone);
    await userEvent.type(phone, '01912345678');
    await userEvent.click(screen.getByRole('button', { name: 'Use this address' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review order' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Review order' }));
    expect(await screen.findByRole('heading', { name: 'Review your order' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent('01912345678');
  });
});
