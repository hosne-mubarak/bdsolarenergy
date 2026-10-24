import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { AuthProvider } from '../../app/providers/AuthProvider';
import { RepositoryProvider } from '../../app/providers/RepositoryProvider';
import { ShoppingContext } from '../../app/providers/shopping-context';
import { ToastProvider } from '../../app/providers/ToastProvider';
import { createAppRoutes } from '../../app/router/routes';
import { RepositoryError } from '../../services/errors';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createPersistence, MemoryStorage } from '../../services/persistence/store';
import { createShoppingServices } from '../../services/shopping';
import type { Session } from '../../types';
import { LoginPage } from './LoginPage';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

function openLogin(path = '/login') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

async function fillLogin(email = 'demo@example.com', password = DEMO_PASSPHRASE) {
  const address = await screen.findByRole('textbox', { name: 'Email address' });
  const secret = screen.getByLabelText('Password', { exact: true });
  await userEvent.clear(address);
  await userEvent.type(address, email);
  await userEvent.clear(secret);
  await userEvent.type(secret, password);
  return secret;
}

describe('validated demo login', () => {
  it('disables submission while a login attempt is pending and prevents a duplicate call', async () => {
    const repositories = createJsonReadRepositories({
      now: () => new Date('2026-10-24T00:00:00Z'),
      id: () => 'test-id',
    });
    const services = createShoppingServices(repositories, {
      store: createPersistence(new MemoryStorage(), {
        now: () => new Date('2026-10-24T00:00:00Z'),
        id: () => 'test-id',
      }),
    });
    let rejectLogin!: (error: Error) => void;
    const attempt = new Promise<Session>((_, reject) => {
      rejectLogin = reject;
    });
    const login = vi.spyOn(services.auth, 'login').mockReturnValue(attempt);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter([{ path: '/login', Component: LoginPage }], {
      initialEntries: ['/login'],
    });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <RepositoryProvider repositories={repositories}>
            <ShoppingContext.Provider value={services}>
              <AuthProvider>
                <RouterProvider router={router} />
              </AuthProvider>
            </ShoppingContext.Provider>
          </RepositoryProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    await fillLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const submit = screen.getByRole('button', { name: /sign.*in/i });
    expect(submit).toBeDisabled();
    await userEvent.click(submit);
    expect(login).toHaveBeenCalledTimes(1);
    await act(async () => rejectLogin(new RepositoryError('validation', 'Login rejected.')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Login rejected.');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    client.clear();
  });

  it('signs in with remember-me and restores the originally requested internal page', async () => {
    const router = openLogin('/login?returnTo=%2Fcart');
    await fillLogin();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Remember me' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cart'));
    const raw = window.localStorage.getItem('bdsolarenergy:session');
    expect(raw).not.toBeNull();
    const session = JSON.parse(raw!);
    expect(session.data.userId).toBe('user-demo');
    expect(raw).not.toContain(DEMO_PASSPHRASE);
    expect(window.sessionStorage.getItem('bdsolarenergy:session')).toBeNull();
  });

  it('rejects malformed email input without creating a session', async () => {
    openLogin();
    await fillLogin('not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/email/i);
    expect(window.localStorage.getItem('bdsolarenergy:session')).toBeNull();
    expect(window.sessionStorage.getItem('bdsolarenergy:session')).toBeNull();
  });

  it('shows a generic credential error and clears the attempted password', async () => {
    openLogin();
    const password = await fillLogin('demo@example.com', 'WrongPassword123!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(password).toHaveValue('');
    expect(window.sessionStorage.getItem('bdsolarenergy:session')).toBeNull();
  });

  it('toggles password visibility without changing its value', async () => {
    openLogin();
    const password = await fillLogin();
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue(DEMO_PASSPHRASE);
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('uses the account landing instead of an unsafe return URL', async () => {
    const router = openLogin('/login?returnTo=https%3A%2F%2Fevil.test');
    await fillLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/account'));
    expect(window.sessionStorage.getItem('bdsolarenergy:session')).not.toBeNull();
    expect(window.localStorage.getItem('bdsolarenergy:session')).toBeNull();
  });
});
