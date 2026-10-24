import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';

function visit(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe('catalogue routes', () => {
  it.each([
    ['/products', 'All products', '48 products'],
    ['/category/solar', 'Solar solutions', '30 products'],
    ['/category/panels', 'Solar panels', '6 products'],
    ['/category/solar/panels', 'Solar panels', '6 products'],
    ['/featured', 'Featured products', '8 products'],
    ['/best-sellers', 'Best sellers', '8 products'],
    ['/new-arrivals', 'New arrivals', '24 products'],
    ['/offers', 'Special offers', '16 products'],
  ])('resolves %s with selected data', async (path, title, count) => {
    visit(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible();
    expect(screen.getByText(count)).toBeVisible();
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
  });
  it.each(['/category/missing', '/category/electrical/panels'])(
    'rejects unknown or mismatched category %s',
    async (path) => {
      visit(path);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'This category could not be found.',
      );
      expect(screen.queryAllByRole('article')).toHaveLength(0);
    },
  );
});

describe('URL filter interactions', () => {
  it('resets the page after filtering and restores prior state with back navigation', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const { act } = await import('@testing-library/react');
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/products?page=2'] });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(await screen.findByText('Page 2 of 4')).toBeVisible();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sunward Demo' }));
    expect(await screen.findByText('16 products')).toBeVisible();
    expect(router.state.location.search).toContain('brand=brand-1');
    expect(router.state.location.search).not.toContain('page=2');
    await act(() => router.navigate(-1));
    expect(await screen.findByText('Page 2 of 4')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Sunward Demo' })).not.toBeChecked();
  });
});
