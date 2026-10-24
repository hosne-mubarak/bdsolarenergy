/// <reference types="node" />
import { webcrypto } from 'node:crypto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => vi.unstubAllGlobals());
function visit() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: ['/register?returnTo=%2Fcart'],
  });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}
async function fill(email = 'new-customer@example.com') {
  await userEvent.type(await screen.findByLabelText('Full name'), 'নতুন Customer');
  await userEvent.type(screen.getByLabelText('Email address'), email);
  await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Private123!abcd');
  await userEvent.type(screen.getByLabelText('Confirm password'), 'Private123!abcd');
  await userEvent.click(screen.getByRole('checkbox', { name: /agree.*terms/i }));
}
describe('demo registration', () => {
  it('creates a salted local identity and resumes a safe requested page', async () => {
    const router = visit();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create demo account' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cart'));
    const raw = Array.from({ length: window.localStorage.length }, (_, i) =>
      window.localStorage.getItem(window.localStorage.key(i)!),
    ).join('');
    expect(raw).toContain('new-customer@example.com');
    expect(raw).toContain('PBKDF2-SHA-256');
    expect(raw).not.toContain('Private123!abcd');
    expect(window.sessionStorage.getItem('bdsolarenergy:session')).not.toBeNull();
  });
  it('blocks mismatched passwords and missing policy acknowledgement', async () => {
    visit();
    await fill();
    await userEvent.clear(screen.getByLabelText('Confirm password'));
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Different123!');
    await userEvent.click(screen.getByRole('checkbox', { name: /agree.*terms/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Create demo account' }));
    expect(await screen.findByText('Passwords must match')).toBeVisible();
    expect(screen.getByText(/accept the terms/i)).toBeVisible();
    expect(window.localStorage.getItem('bdsolarenergy:identities')).toBeNull();
  });
  it('shows duplicate-email feedback and clears password fields after a rejected attempt', async () => {
    visit();
    await fill('DEMO@EXAMPLE.COM');
    await userEvent.click(screen.getByRole('button', { name: 'Create demo account' }));
    expect(await screen.findByText(/account with this email already exists/i)).toBeVisible();
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('');
    expect(screen.getByLabelText('Confirm password')).toHaveValue('');
    expect(screen.getByLabelText('Email address')).toHaveValue('DEMO@EXAMPLE.COM');
  });
  it('rejects malformed identity fields before any local account is written', async () => {
    visit();
    await userEvent.type(await screen.findByLabelText('Full name'), 'A');
    await userEvent.type(screen.getByLabelText('Email address'), 'bad-email');
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'short');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'short');
    await userEvent.click(screen.getByRole('checkbox', { name: /agree.*terms/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Create demo account' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(window.localStorage.getItem('bdsolarenergy:identities')).toBeNull();
  });
});
