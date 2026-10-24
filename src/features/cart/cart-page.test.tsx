import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';
import { formatMoney } from '../../utils/currency';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

async function addProductAndOpenCart() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: ['/product/panels-550-1'],
  });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  await screen.findByRole('heading', { name: '550W Mono solar panel', level: 1 });
  await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
  await userEvent.click(screen.getByRole('button', { name: /add to cart/i }));
  await screen.findByText(/added to cart/i);
  await userEvent.click(screen.getByRole('link', { name: /^Shopping cart/i }));
  await screen.findByRole('spinbutton', { name: 'Quantity for 550W Mono solar panel' });
  return router;
}

describe('cart page shopping interactions', () => {
  it('adds selected product quantity and computes the basket subtotal', async () => {
    await addProductAndOpenCart();
    expect(
      screen.getByRole('spinbutton', { name: 'Quantity for 550W Mono solar panel' }),
    ).toHaveValue(2);
    expect(screen.getAllByText(formatMoney(3700000)).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /^Shopping cart/i })).toHaveAccessibleName(/2/);
  });

  it('updates quantities through shared rules and removes the last item into an actionable empty state', async () => {
    await addProductAndOpenCart();
    await userEvent.click(
      screen.getByRole('button', { name: 'Increase quantity for 550W Mono solar panel' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('spinbutton', { name: 'Quantity for 550W Mono solar panel' }),
      ).toHaveValue(3),
    );
    expect(screen.getAllByText(formatMoney(5550000)).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Remove 550W Mono solar panel' }));
    expect(await screen.findByRole('heading', { name: /cart is empty/i })).toBeVisible();
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: /browse|shop|explore/i }),
    ).toHaveAttribute('href', '/products');
  });

  it('preserves data when clearing is cancelled and clears only after confirmation', async () => {
    await addProductAndOpenCart();
    await userEvent.click(screen.getByRole('button', { name: 'Clear cart' }));
    expect(screen.getByRole('dialog', { name: 'Clear your cart?' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(
      screen.getByRole('spinbutton', { name: 'Quantity for 550W Mono solar panel' }),
    ).toHaveValue(2);
    await userEvent.click(screen.getByRole('button', { name: 'Clear cart' }));
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Clear your cart?' })).getByRole('button', {
        name: 'Clear cart',
      }),
    );
    expect(await screen.findByRole('heading', { name: /cart is empty/i })).toBeVisible();
  });

  it('applies a valid demo coupon through reusable discount rules', async () => {
    await addProductAndOpenCart();
    await userEvent.type(screen.getByLabelText('Coupon code'), 'SOLAR10');
    await userEvent.click(screen.getByRole('button', { name: 'Apply coupon' }));
    expect(await screen.findByText((text) => text.includes(formatMoney(370000)))).toBeVisible();
  });

  it('shows invalid coupon feedback without applying a discount', async () => {
    await addProductAndOpenCart();
    await userEvent.type(screen.getByLabelText('Coupon code'), 'NOT-A-COUPON');
    await userEvent.click(screen.getByRole('button', { name: 'Apply coupon' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/coupon.*invalid/i);
    expect(screen.getAllByText(formatMoney(3700000)).length).toBeGreaterThan(0);
    expect(screen.queryByText(formatMoney(370000))).not.toBeInTheDocument();
  });
});
