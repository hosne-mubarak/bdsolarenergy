import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { createAppRoutes } from '../../app/router/routes';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { RepositoryError } from '../../services/errors';
import type { PublicRepositories } from '../../services/public';

const pages = [
  ['about', 'Energy for everyday possibilities'],
  ['faq', 'Frequently asked questions'],
  ['shipping-delivery', 'Shipping & delivery'],
  ['returns-refunds', 'Returns & refunds'],
  ['warranty', 'Warranty & support'],
  ['privacy', 'Your privacy'],
  ['terms', 'Terms & conditions'],
] as const;
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
function repositories() {
  return createJsonReadRepositories({
    now: () => new Date('2026-10-24T12:00:00Z'),
    id: () => 'content-test',
  });
}
function visit(path: string, services: PublicRepositories = repositories()) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  const view = render(
    <AppProviders repositories={services}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...view };
}

describe('fixture-backed public information and sample policies', () => {
  it.each(pages)(
    'renders distinct %s content with its update date and sample-content notice',
    async (slug, title) => {
      const services = repositories();
      const expected = await services.content.getPage(slug);
      visit(`/${slug}`, services);
      expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible();
      const main = screen.getByRole('main');
      for (const section of expected.sections) {
        expect(
          within(main).getByRole('heading', { level: 2, name: section.heading }),
        ).toBeVisible();
        expect(main).toHaveTextContent(section.body);
      }
      expect(main.querySelector('time')).toHaveAttribute('dateTime', expected.updatedAt);
      expect(main).toHaveTextContent(/draft|sample|illustrative/i);
      expect(main).toHaveTextContent(/owner approval|owner.*review|review.*owner/i);
    },
  );

  it('uses distinct titles and substantive body text across all seven information pages', async () => {
    const services = repositories();
    const records = await Promise.all(pages.map(([slug]) => services.content.getPage(slug)));
    expect(new Set(records.map((page) => page.title)).size).toBe(pages.length);
    expect(new Set(records.map((page) => page.sections[0].body)).size).toBe(pages.length);
  });

  it('provides native FAQ disclosures with focusable summaries and expanded answers', async () => {
    const services = repositories();
    const expected = await services.content.getPage('faq');
    visit('/faq', services);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Frequently asked questions' }),
    ).toBeVisible();
    const question = expected.faqs[0];
    const summary = screen.getByText(question.question, { selector: 'summary' });
    const details = summary.closest('details')!;
    expect(details).not.toHaveAttribute('open');
    summary.focus();
    expect(summary).toHaveFocus();
    await userEvent.click(summary);
    expect(details).toHaveAttribute('open');
    expect(within(details).getByText(question.answer)).toBeVisible();
    await userEvent.click(summary);
    expect(details).not.toHaveAttribute('open');
  });

  it('resolves every footer policy and help link to its corresponding distinct page', async () => {
    const services = repositories();
    const { router } = visit('/about', services);
    expect(await screen.findByRole('heading', { level: 1, name: pages[0][1] })).toBeVisible();
    const policyLinks = within(screen.getByRole('navigation', { name: 'Policies and help' }))
      .getAllByRole('link')
      .map((link) => ({ label: link.textContent!, href: link.getAttribute('href')! }));
    expect(policyLinks).toHaveLength(6);
    for (const link of policyLinks) {
      const expected = await services.content.getPage(link.href.slice(1));
      await userEvent.click(
        within(screen.getByRole('navigation', { name: 'Policies and help' })).getByRole('link', {
          name: link.label,
        }),
      );
      expect(await screen.findByRole('heading', { level: 1, name: expected.title })).toBeVisible();
      expect(router.state.location.pathname).toBe(link.href);
    }
  });

  it('shows repository failure and retries the original content request successfully', async () => {
    const services = repositories();
    const getPage = vi
      .spyOn(services.content, 'getPage')
      .mockRejectedValueOnce(
        new RepositoryError('storage_unavailable', 'Sample page unavailable.'),
      );
    visit('/shipping-delivery', services);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sample page unavailable.');
    expect(screen.queryByRole('heading', { level: 1, name: 'Shipping & delivery' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Shipping & delivery' }),
    ).toBeVisible();
    expect(getPage).toHaveBeenCalledTimes(2);
  });
});
