import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createShoppingServices } from '../../services/shopping';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
function services() {
  return createShoppingServices(
    createJsonReadRepositories({ now: () => new Date(), id: () => 'account-test' }),
  );
}
async function signIn() {
  const current = services();
  await current.auth.login({
    email: 'demo@example.com',
    password: DEMO_PASSPHRASE,
    remember: false,
  });
  return current;
}
function visit(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  const view = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...view };
}

describe('customer account profile', () => {
  it('persists a Unicode name and phone across a fresh application mount while keeping email read-only', async () => {
    const current = await signIn();
    const first = visit('/account/profile/edit');
    expect(await screen.findByRole('heading', { name: 'Edit profile' })).toBeVisible();
    const email = screen.getByLabelText('Email address');
    expect(email).toHaveAttribute('readonly');
    expect(email).toHaveValue('demo@example.com');
    await userEvent.clear(screen.getByLabelText('Full name'));
    await userEvent.type(screen.getByLabelText('Full name'), 'নতুন Customer');
    await userEvent.clear(screen.getByLabelText('Phone number'));
    await userEvent.type(screen.getByLabelText('Phone number'), '01812345678');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(first.router.state.location.pathname).toBe('/account/profile'));
    expect(await screen.findByRole('heading', { name: 'Your profile' })).toBeVisible();
    expect(await current.customers.getProfile()).toMatchObject({
      displayName: 'নতুন Customer',
      phone: '01812345678',
      email: 'demo@example.com',
    });
    first.unmount();
    visit('/account/profile/edit');
    expect(await screen.findByLabelText('Full name')).toHaveValue('নতুন Customer');
    expect(screen.getByLabelText('Phone number')).toHaveValue('01812345678');
    expect(screen.getByLabelText('Email address')).toHaveValue('demo@example.com');
  });

  it('rejects invalid profile fields without changing the saved customer record', async () => {
    const current = await signIn();
    const before = await current.customers.getProfile();
    visit('/account/profile/edit');
    await userEvent.clear(await screen.findByLabelText('Full name'));
    await userEvent.type(screen.getByLabelText('Full name'), 'A');
    await userEvent.clear(screen.getByLabelText('Phone number'));
    await userEvent.type(screen.getByLabelText('Phone number'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('aria-invalid', 'true');
    expect(await current.customers.getProfile()).toEqual(before);
  });

  it('exposes the account dashboard and cancels edits without persisting draft data', async () => {
    const current = await signIn();
    const before = await current.customers.getProfile();
    const { router } = visit('/account');
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeVisible();
    await userEvent.click(await screen.findByRole('link', { name: 'Profile' }));
    expect(await screen.findByRole('heading', { name: 'Your profile' })).toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'Edit profile' }));
    await userEvent.clear(await screen.findByLabelText('Full name'));
    await userEvent.type(screen.getByLabelText('Full name'), 'Unsaved draft');
    await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/account/profile'));
    expect(await current.customers.getProfile()).toEqual(before);
  });

  it('redirects guests from profile data to sign-in with the original return path', async () => {
    const { router } = visit('/account/profile');
    expect(await screen.findByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(
      '/account/profile',
    );
    expect(screen.queryByRole('heading', { name: 'Your profile' })).toBeNull();
  });
});
