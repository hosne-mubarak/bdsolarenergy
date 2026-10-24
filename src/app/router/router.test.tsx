import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, useQuery } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../providers/AppProviders';
import { createQueryClient } from '../providers/query-client';
import { createAppRoutes } from './routes';

describe('route and provider composition', () => {
  it('protects a nested account URL while retaining its safe return path', async () => {
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/account/profile'] });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/login');
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(
      '/account/profile',
    );
    expect(screen.queryByText(/No account data is available/)).not.toBeInTheDocument();
  });

  it('provides a recoverable unknown-page state', async () => {
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/does-not-exist'] });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'Return home' }));
    expect(
      await screen.findByRole('heading', { name: 'Power a brighter tomorrow.' }),
    ).toBeVisible();
  });

  it('retries a failed route without exposing exception details', async () => {
    const routes = createAppRoutes();
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('private exception details'))
      .mockResolvedValue(null);
    routes[0].children!.push({
      path: 'test-failure',
      loader: load,
      Component: () => <h1>Recovered page</h1>,
    });
    const router = createMemoryRouter(routes, { initialEntries: ['/test-failure'] });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Unable to open this page' })).toBeVisible();
    expect(screen.queryByText('private exception details')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Recovered page' })).toBeVisible();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('retains query state when the provider rerenders', async () => {
    const load = vi.fn().mockResolvedValue('Repository result');
    function Probe() {
      const query = useQuery({ queryKey: ['probe'], queryFn: load });
      return <p>{query.data ?? 'Loading'}</p>;
    }
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const view = render(
      <AppProviders client={client}>
        <Probe />
      </AppProviders>,
    );
    expect(await screen.findByText('Repository result')).toBeVisible();
    view.rerender(
      <AppProviders client={client}>
        <Probe />
      </AppProviders>,
    );
    expect(load).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('does not retry mutations or normalized validation failures', async () => {
    const client = createQueryClient();
    const error = Object.assign(new Error('Invalid input'), { code: 'validation' });
    const read = vi.fn().mockRejectedValue(error);
    await expect(client.fetchQuery({ queryKey: ['validation'], queryFn: read })).rejects.toThrow(
      'Invalid input',
    );
    expect(read).toHaveBeenCalledTimes(1);
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
    client.clear();
  });
});
