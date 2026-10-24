import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { ShoppingContext } from '../../app/providers/shopping-context';
import { createAppRoutes } from '../../app/router/routes';
import { WishlistButton } from '../../components/products/WishlistButton';
import type { Runtime } from '../../services/contracts';
import { RepositoryError } from '../../services/errors';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createPersistence, MemoryStorage } from '../../services/persistence/store';
import { createShoppingServices } from '../../services/shopping';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

function renderProduct(path = '/product/panels-550-1') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe('wishlist shopping interactions', () => {
  it('does not offer an unknown saved state as Save and restores the actual state on retry', async () => {
    const runtime: Runtime = {
      now: () => new Date('2026-10-24T00:00:00Z'),
      id: (prefix = 'test') => `${prefix}-1`,
    };
    const repositories = createJsonReadRepositories(runtime);
    const services = createShoppingServices(repositories, {
      runtime,
      store: createPersistence(new MemoryStorage(), runtime),
    });
    await services.wishlist.toggle('product-panels-1');
    const read = vi
      .spyOn(services.wishlist, 'list')
      .mockRejectedValueOnce(new RepositoryError('unavailable'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <AppProviders client={client} repositories={repositories}>
        <ShoppingContext.Provider value={services}>
          <WishlistButton productId="product-panels-1" name="550W Mono solar panel" />
        </ShoppingContext.Provider>
      </AppProviders>,
    );

    expect(
      await screen.findByRole('button', {
        name: 'Wishlist unavailable for 550W Mono solar panel',
      }),
    ).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save 550W Mono solar panel' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /retry wishlist/i }));
    expect(
      await screen.findByRole('button', { name: 'Remove 550W Mono solar panel from wishlist' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(read).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it('saves from details, opens the persisted wishlist and removes its last product', async () => {
    renderProduct();
    const save = await screen.findByRole('button', { name: 'Save 550W Mono solar panel' });
    expect(save).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(save);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove 550W Mono solar panel from wishlist' }),
      ).toHaveAttribute('aria-pressed', 'true'),
    );
    const wishlistLink = screen.getByRole('link', { name: /^Wishlist/ });
    expect(wishlistLink).toHaveAccessibleName(/1/);
    await userEvent.click(wishlistLink);
    expect(await screen.findByRole('heading', { name: /wishlist/i, level: 1 })).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove 550W Mono solar panel from wishlist' }),
    );
    expect(await screen.findByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
  });

  it('allows saving an unavailable product while keeping its cart action disabled', async () => {
    renderProduct('/product/panels-675-6');
    const save = await screen.findByRole('button', { name: 'Save 675W Mono solar panel' });
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
    await userEvent.click(save);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove 675W Mono solar panel from wishlist' }),
      ).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
  });
});
