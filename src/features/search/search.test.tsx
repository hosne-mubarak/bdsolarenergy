import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { SearchBar } from '../../components/navigation/SearchBar';
import { createAppRoutes } from '../../app/router/routes';

function LocationProbe() {
  const location = useLocation();
  return (
    <p data-testid="route">
      {location.pathname}
      {location.search}
    </p>
  );
}

describe('product search interactions', () => {
  it('offers bounded keyboard suggestions and closes with Escape', async () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <SearchBar />
          <LocationProbe />
        </MemoryRouter>
      </AppProviders>,
    );
    const input = screen.getByRole('combobox', { name: 'Search products' });
    await userEvent.type(input, 'solar');
    expect(await screen.findByRole('listbox')).toBeVisible();
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(5);
    await userEvent.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('route')).toHaveTextContent('/search?q=solar');
  });
  it('navigates to a selected suggestion and can clear the search', async () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <SearchBar />
          <LocationProbe />
        </MemoryRouter>
      </AppProviders>,
    );
    const input = screen.getByRole('combobox', { name: 'Search products' });
    await userEvent.type(input, 'BD-PANELS-1');
    expect(await screen.findByRole('listbox')).toBeVisible();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('route')).toHaveTextContent('/product/panels-550-1');
    await userEvent.clear(screen.getByRole('combobox'));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('route')).toHaveTextContent('/products');
  });
  it('shows actionable empty results for a query that matches nothing', async () => {
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: ['/search?q=unfindable-widget'],
    });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'No products found' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse all products' })).toBeVisible();
  });
});
