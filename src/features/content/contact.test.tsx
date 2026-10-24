import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { RepositoryError } from '../../services/errors';
import type { PublicRepositories } from '../../services/public';

const title = 'Let’s talk about your next project';
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function repositories() {
  return createJsonReadRepositories({
    now: () => new Date('2026-10-24T12:00:00Z'),
    id: () => 'contact-test',
  });
}
function visit(services: PublicRepositories = repositories()) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/contact'] });
  render(
    <AppProviders repositories={services}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe('explicitly unsent demo contact inquiries', () => {
  it('rejects invalid email and short messages while retaining all entered values', async () => {
    visit();
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible();
    await userEvent.type(screen.getByLabelText('Full name'), 'Demo Customer');
    await userEvent.type(screen.getByLabelText('Email address'), 'invalid-email');
    await userEvent.type(screen.getByLabelText('Subject'), 'Panel advice');
    await userEvent.type(screen.getByLabelText('Message'), 'Short');
    await userEvent.click(screen.getByRole('button', { name: 'Preview demo inquiry' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(screen.getByLabelText('Message')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Full name')).toHaveValue('Demo Customer');
    expect(screen.getByLabelText('Email address')).toHaveValue('invalid-email');
    expect(screen.getByLabelText('Subject')).toHaveValue('Panel advice');
    expect(screen.getByLabelText('Message')).toHaveValue('Short');
    expect(screen.queryByText('Demo inquiry validated. Your message was not sent.')).toBeNull();
  });

  it('validates a long Unicode inquiry locally, retains the draft and explicitly confirms it was not sent', async () => {
    const requests = vi.fn();
    vi.stubGlobal('fetch', requests);
    const services = repositories();
    const settings = await services.content.getSiteSettings();
    visit(services);
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: settings.contact.email })).toHaveAttribute(
      'href',
      `mailto:${settings.contact.email}`,
    );
    expect(within(main).getByRole('link', { name: settings.contact.phone })).toHaveAttribute(
      'href',
      `tel:${settings.contact.phone}`,
    );
    expect(main).toHaveTextContent(settings.contact.address);
    const message = 'আমার সৌর বিদ্যুৎ প্রকল্পের জন্য কিছু পণ্যের তথ্য জানতে চাই।\n'
      .repeat(20)
      .trim();
    await user.type(screen.getByLabelText('Full name'), 'নুসরাত Customer');
    await user.type(screen.getByLabelText('Email address'), 'demo-inquiry@example.com');
    await user.type(screen.getByLabelText('Subject'), 'সৌর প্যানেল সম্পর্কে প্রশ্ন');
    await user.click(screen.getByLabelText('Message'));
    await user.paste(message);
    await user.click(screen.getByRole('button', { name: 'Preview demo inquiry' }));
    const status = await screen.findByText('Demo inquiry validated. Your message was not sent.');
    expect(status).toHaveAttribute('role', 'status');
    expect(screen.getByLabelText('Message')).toHaveValue(message);
    expect(screen.getByLabelText('Full name')).toHaveValue('নুসরাত Customer');
    expect(requests).not.toHaveBeenCalled();
  });

  it('recovers a failed contact-content read through the visible retry action', async () => {
    const services = repositories();
    const getPage = vi
      .spyOn(services.content, 'getPage')
      .mockRejectedValueOnce(
        new RepositoryError('storage_unavailable', 'Contact content unavailable.'),
      );
    visit(services);
    expect(await screen.findByRole('alert')).toHaveTextContent('Contact content unavailable.');
    expect(screen.queryByLabelText('Message')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible();
    expect(screen.getByLabelText('Message')).toBeVisible();
    expect(getPage).toHaveBeenCalledTimes(2);
  });
});
