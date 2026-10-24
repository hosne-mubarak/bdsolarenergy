/// <reference types="node" />
import { webcrypto } from 'node:crypto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createShoppingServices } from '../../services/shopping';

const network = vi.fn(() => Promise.reject(new Error('Unexpected network request')));
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
  network.mockClear();
  vi.stubGlobal('fetch', network);
});
afterEach(() => vi.unstubAllGlobals());

function visit(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

function currentAuth() {
  return createShoppingServices(
    createJsonReadRepositories({
      now: () => new Date(),
      id: () => 'recovery-test',
    }),
  ).auth;
}

describe('explicit demo account recovery', () => {
  it('requests and completes a validated local reset without claiming email delivery', async () => {
    const router = visit('/forgot-password');
    await userEvent.type(await screen.findByLabelText('Email address'), 'demo@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Simulate reset request' }));
    expect(await screen.findByText(/No email was sent/)).toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'Open demo reset' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/reset-password'));
    await userEvent.type(await screen.findByLabelText('New password'), 'RenewedSecret123!');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'DifferentSecret123!');
    await userEvent.click(screen.getByRole('button', { name: 'Update demo password' }));
    expect(await screen.findByText('Passwords must match')).toBeVisible();
    await userEvent.clear(screen.getByLabelText('Confirm password'));
    await userEvent.type(screen.getByLabelText('Confirm password'), 'RenewedSecret123!');
    await userEvent.click(screen.getByRole('button', { name: 'Update demo password' }));
    expect(await screen.findByText(/Demo password updated/)).toBeVisible();
    const auth = currentAuth();
    await expect(
      auth.login({ email: 'demo@example.com', password: DEMO_PASSPHRASE, remember: false }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      auth.login({ email: 'demo@example.com', password: 'RenewedSecret123!', remember: false }),
    ).resolves.toMatchObject({ userId: 'user-demo' });
    expect(network).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('bdsolarenergy:identities')).not.toContain(
      'RenewedSecret123!',
    );
  });

  it('offers a recovery path when no reset intent was supplied', async () => {
    visit('/reset-password');
    const main = await screen.findByRole('main');
    const recovery = await within(main).findByRole('link', {
      name: /request.*reset|forgot.*password|start.*reset/i,
    });
    expect(recovery).toHaveAttribute('href', '/forgot-password');
    expect(within(main).queryByRole('button', { name: 'Update demo password' })).toBeNull();
    expect(network).not.toHaveBeenCalled();
  });

  it('labels verification as a demonstration and identifies a guest session', async () => {
    visit('/verify-email');
    expect(await screen.findByRole('heading', { name: /verification/i })).toBeVisible();
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent(/demo/i);
    expect(main).toHaveTextContent(/guest|sign in|not signed/i);
    expect(network).not.toHaveBeenCalled();
  });

  it('changes the current local password and invalidates the obsolete verifier', async () => {
    window.sessionStorage.setItem(
      'bdsolarenergy:session',
      JSON.stringify({
        version: 1,
        updatedAt: '2026-10-24T00:00:00Z',
        data: { userId: 'user-demo', expiresAt: '2099-10-24T00:00:00Z' },
      }),
    );
    visit('/account/password');
    await userEvent.type(await screen.findByLabelText('Current password'), DEMO_PASSPHRASE);
    await userEvent.type(screen.getByLabelText('New password'), 'ChangedSecret456!');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'ChangedSecret456!');
    await userEvent.click(
      screen.getByRole('button', { name: /change.*password|update.*password/i }),
    );
    expect(await screen.findByText(/Demo password (updated|changed)/)).toBeVisible();
    const auth = currentAuth();
    await auth.logout();
    await expect(
      auth.login({ email: 'demo@example.com', password: DEMO_PASSPHRASE, remember: false }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      auth.login({ email: 'demo@example.com', password: 'ChangedSecret456!', remember: false }),
    ).resolves.toMatchObject({ userId: 'user-demo' });
    expect(window.localStorage.getItem('bdsolarenergy:identities')).not.toContain(
      'ChangedSecret456!',
    );
    expect(network).not.toHaveBeenCalled();
  });
});
