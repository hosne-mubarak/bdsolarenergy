import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../providers/AppProviders';
import { createAppRoutes } from '../router/routes';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
function visit(path = '/products') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}
describe('accessible route focus', () => {
  it('places focus on the main landmark after a client-side destination change', async () => {
    const router = visit();
    await screen.findByRole('heading', { name: 'All products' });
    const footer = screen.getByRole('contentinfo');
    await userEvent.click(within(footer).getByRole('link', { name: 'Our story' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Energy for everyday possibilities' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/about');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });

  it('preserves the price action through filter updates and clears URL-backed fields without remounting', async () => {
    const router = visit();
    const minimum = await screen.findByLabelText('Minimum price (৳)');
    await userEvent.type(minimum, '20000');
    const apply = screen.getByRole('button', { name: 'Apply price range' });
    await userEvent.click(apply);
    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('min')).toBe('20000'),
    );
    await waitFor(() =>
      expect(screen.getByText(/^\d+ products$/)).not.toHaveTextContent(/^48 products$/),
    );
    expect(apply).toHaveFocus();
    expect(screen.getByLabelText('Minimum price (৳)')).toHaveValue(20000);
    const clear = screen.getByRole('button', { name: 'Clear filters' });
    await userEvent.click(clear);
    expect(await screen.findByText('48 products')).toBeVisible();
    expect(minimum).toHaveValue(null);
    expect(clear).toHaveFocus();
  });

  it('keeps focus on an active catalogue filter when only query parameters change', async () => {
    const router = visit();
    const availability = await screen.findByLabelText('Availability');
    await userEvent.selectOptions(availability, 'in_stock');
    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('stock')).toBe('in_stock'),
    );
    expect(await screen.findByText('40 products')).toBeVisible();
    expect(screen.getByLabelText('Availability')).toHaveValue('in_stock');
    expect(screen.getByLabelText('Availability')).toHaveFocus();
    expect(screen.getByRole('main')).not.toHaveFocus();
  });
});
