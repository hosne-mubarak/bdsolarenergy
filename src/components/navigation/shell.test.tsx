import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { RepositoryError } from '../../services/errors';
import type { PublicRepositories } from '../../services/public';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';

function renderShell(repositories?: PublicRepositories) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/about'] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AppProviders repositories={repositories} client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

function repositories() {
  return createJsonReadRepositories({
    now: () => new Date('2026-10-24T00:00:00Z'),
    id: () => 'shell-test',
  });
}

describe('repository-driven storefront shell', () => {
  it('renders store identity, search and footer navigation from a functioning provider', async () => {
    renderShell();
    const header = await screen.findByRole('banner');
    expect(await within(header).findByText('bdsolarenergy')).toBeVisible();
    expect(within(header).getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(await screen.findByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
  });

  it('opens and closes mobile navigation with restored focus', async () => {
    renderShell();
    const open = await screen.findByRole('button', { name: /open.*menu|open.*navigation/i });
    await userEvent.click(open);
    const dialog = await screen.findByRole('dialog', { name: 'Navigation' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(open).toHaveFocus();
  });
});

describe('shell read-failure recovery', () => {
  it('shows an unavailable store-contact state and retries without an endless loading message', async () => {
    const source = repositories();
    const read = source.content.getSiteSettings;
    vi.spyOn(source.content, 'getSiteSettings')
      .mockRejectedValueOnce(new RepositoryError('unavailable'))
      .mockImplementation(read);
    renderShell(source);
    const footer = await screen.findByRole('contentinfo');
    expect(await within(footer).findByRole('alert')).toHaveTextContent(
      'Store information is unavailable.',
    );
    expect(within(footer).queryByText('Store information is loading.')).toBeNull();
    await userEvent.click(within(footer).getByRole('button', { name: 'Retry store information' }));
    expect(await within(footer).findByRole('link', { name: 'hello@example.com' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com',
    );
    expect(within(footer).queryByRole('alert')).toBeNull();
  });

  it('allows navigation retry from inside the mobile dialog after a category read fails', async () => {
    const source = repositories();
    const read = source.catalogue.listCategories;
    vi.spyOn(source.catalogue, 'listCategories')
      .mockRejectedValueOnce(new RepositoryError('unavailable'))
      .mockImplementation(read);
    renderShell(source);
    await userEvent.click(await screen.findByRole('button', { name: 'Open navigation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Navigation' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Navigation is unavailable.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retry navigation' }));
    expect(await within(dialog).findByRole('link', { name: 'Solar panels' })).toBeVisible();
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });
});
