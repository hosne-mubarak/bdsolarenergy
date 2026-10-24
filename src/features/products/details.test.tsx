import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';
import { formatMoney } from '../../utils/currency';

function renderProduct(path = '/product/panels-550-1') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe('product details and options', () => {
  it('updates SKU and selling price when a different product option is selected', async () => {
    renderProduct();
    expect(
      await screen.findByRole('heading', { name: '550W Mono solar panel', level: 1 }),
    ).toBeVisible();
    expect(screen.getByText(/BD-PANELS-1-1/)).toBeVisible();
    expect(screen.getByText(formatMoney(1850000))).toBeVisible();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Product option' }),
      'product-panels-1-v2',
    );
    expect(screen.getByText(/BD-PANELS-1-2/)).toBeVisible();
    expect(screen.getByText(formatMoney(2000000))).toBeVisible();
    expect(screen.queryByText(/BD-PANELS-1-1/)).not.toBeInTheDocument();
  });

  it('bounds the quantity selector by stock and the per-order limit', async () => {
    renderProduct();
    const quantity = await screen.findByRole('spinbutton', { name: 'Quantity' });
    expect(quantity).toHaveValue(1);
    for (let index = 0; index < 6; index++)
      await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(quantity).toHaveValue(5);
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    for (let index = 0; index < 6; index++)
      await userEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(quantity).toHaveValue(1);
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
  });

  it('displays specifications, reviews and a dimensioned product image', async () => {
    renderProduct();
    await screen.findByRole('heading', { name: '550W Mono solar panel', level: 1 });
    expect(screen.getByRole('heading', { name: /specifications/i })).toBeVisible();
    expect(screen.getByText('Rated capacity')).toBeVisible();
    expect(screen.getByRole('heading', { name: /reviews/i })).toBeVisible();
    expect(screen.getByText('Helpful for our project')).toBeVisible();
    const images = within(screen.getByRole('main'))
      .getAllByRole('img')
      .filter((element) => element instanceof HTMLImageElement);
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
    }
  });

  it('makes unavailable inventory explicit and disables quantity changes', async () => {
    renderProduct('/product/panels-675-6');
    await screen.findByRole('heading', { name: '675W Mono solar panel', level: 1 });
    expect(screen.getByText('Out of stock')).toBeVisible();
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('recovers clearly from an unknown product slug', async () => {
    renderProduct('/product/not-a-real-product');
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be found/i);
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
  });
});
