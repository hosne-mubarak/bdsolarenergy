import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';
import { DEMO_PASSPHRASE } from '../../services/json/auth';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { createShoppingServices } from '../../services/shopping';
import type { AddressInput } from '../../types';

const sample: AddressInput = {
  recipient: 'নতুন Customer',
  phone: '01812345678',
  division: 'Dhaka',
  district: 'Dhaka',
  area: 'ধানমন্ডি',
  street: 'বাড়ি ১০, Road 5',
  postcode: '',
  isDefault: true,
};
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
function services() {
  return createShoppingServices(
    createJsonReadRepositories({ now: () => new Date(), id: () => 'address-test' }),
  );
}
async function signIn(email = 'demo@example.com') {
  const current = services();
  await current.auth.login({ email, password: DEMO_PASSPHRASE, remember: false });
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
async function fillAddress({
  recipient = sample.recipient,
  phone = sample.phone,
  street = sample.street,
  isDefault = true,
} = {}) {
  await userEvent.type(await screen.findByLabelText('Recipient name'), recipient);
  await userEvent.type(screen.getByLabelText('Phone number'), phone);
  await userEvent.type(screen.getByLabelText('Division'), sample.division);
  await userEvent.type(screen.getByLabelText('District'), sample.district);
  await userEvent.type(screen.getByLabelText('Area'), sample.area);
  await userEvent.type(screen.getByLabelText('Street address'), street);
  const checkbox = screen.getByRole('checkbox', { name: 'Make this my default address' });
  if ((checkbox as HTMLInputElement).checked !== isDefault) await userEvent.click(checkbox);
}

describe('customer address book', () => {
  it('adds, edits and restores Unicode addresses with exactly one selected default', async () => {
    const current = await signIn();
    const first = visit('/account/addresses/new');
    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByRole('heading', { name: 'Address book' })).toBeVisible();
    expect((await current.customers.listAddresses())[0]).toMatchObject({
      ...sample,
      isDefault: true,
    });
    await userEvent.click(screen.getByRole('link', { name: 'Add address' }));
    await fillAddress({
      recipient: 'নুসরাত Customer',
      street: 'House 20, Road 9',
      isDefault: true,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    const card = (await screen.findByRole('heading', { name: 'নুসরাত Customer' })).closest(
      'article',
    )!;
    expect(within(card).getByText('Default address')).toBeVisible();
    expect(screen.getAllByText('Default address')).toHaveLength(1);
    await userEvent.click(within(card).getByRole('link', { name: 'Edit address' }));
    const street = await screen.findByLabelText('Street address');
    await userEvent.clear(street);
    await userEvent.type(street, 'নতুন বাড়ি ২২, Road 11');
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(first.router.state.location.pathname).toBe('/account/addresses'));
    first.unmount();
    visit('/account/addresses');
    expect(await screen.findByRole('heading', { name: 'নুসরাত Customer' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent('নতুন বাড়ি ২২, Road 11');
    const saved = await current.customers.listAddresses();
    expect(saved.filter((address) => address.isDefault)).toHaveLength(1);
    expect(saved.find((address) => address.isDefault)).toMatchObject({
      recipient: 'নুসরাত Customer',
      street: 'নতুন বাড়ি ২২, Road 11',
    });
  });

  it('preserves a cancelled deletion and removes the address only after confirmation', async () => {
    const current = await signIn();
    await current.customers.saveAddress(sample);
    visit('/account/addresses');
    const card = (await screen.findByRole('heading', { name: sample.recipient })).closest(
      'article',
    )!;
    await userEvent.click(within(card).getByRole('button', { name: 'Delete address' }));
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Delete this address?' })).getByRole(
        'button',
        { name: 'Cancel' },
      ),
    );
    expect(await current.customers.listAddresses()).toHaveLength(1);
    await userEvent.click(within(card).getByRole('button', { name: 'Delete address' }));
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Delete this address?' })).getByRole(
        'button',
        { name: 'Delete address' },
      ),
    );
    expect(await screen.findByRole('heading', { name: 'No saved addresses' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Add address' })).toBeVisible();
    expect(await current.customers.listAddresses()).toEqual([]);
  });

  it('blocks an invalid phone without persisting an address', async () => {
    const current = await signIn();
    visit('/account/addresses/new');
    await fillAddress({ phone: '123' });
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Phone number')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(await current.customers.listAddresses()).toEqual([]);
  });

  it('does not disclose another customer’s address through a direct edit URL', async () => {
    const current = await signIn('another@example.com');
    const address = await current.customers.saveAddress({
      ...sample,
      recipient: 'Other customer',
      street: 'Private demo street 99',
    });
    await current.auth.logout();
    await current.auth.login({
      email: 'demo@example.com',
      password: DEMO_PASSPHRASE,
      remember: false,
    });
    visit(`/account/addresses/${address.id}/edit`);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /access|could not be found|not found|unavailable/i,
    );
    expect(screen.queryByLabelText('Recipient name')).toBeNull();
    expect(screen.queryByText('Private demo street 99')).toBeNull();
    expect(await current.customers.listAddresses()).toEqual([]);
  });
});
