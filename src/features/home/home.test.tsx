import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { loadFixtureData } from '../../services/json/fixtures';
import { createJsonReadRepositories } from '../../services/json/read-repositories';
import { RepositoryError } from '../../services/errors';
import type { PublicRepositories } from '../../services/public';
import type { Runtime } from '../../services/contracts';
import { HomePage } from './HomePage';

const runtime: Runtime = {
  now: () => new Date('2026-10-24T00:00:00Z'),
  id: (prefix = 'test') => `${prefix}-1`,
};

function renderHome(repositories: PublicRepositories) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AppProviders repositories={repositories} client={client}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('data-driven homepage', () => {
  it('announces loading while repository data is pending', () => {
    const repositories = createJsonReadRepositories(runtime);
    repositories.content.getBanners = () => new Promise(() => {});
    renderHome(repositories);
    expect(
      screen
        .getAllByRole('status')
        .some((status) => /preparing your energy essentials/i.test(status.textContent ?? '')),
    ).toBe(true);
  });

  it('renders the fixture hero with its configured shopping destination', async () => {
    const data = loadFixtureData();
    renderHome(createJsonReadRepositories(runtime, data));
    const banner = data.fixtures.banners[0];
    expect(await screen.findByRole('heading', { name: banner.title, level: 1 })).toBeVisible();
    expect(screen.getByRole('link', { name: new RegExp(banner.ctaLabel, 'i') })).toHaveAttribute(
      'href',
      banner.ctaPath,
    );
    expect(screen.getByRole('heading', { name: /categor/i })).toBeVisible();
  });

  it('links featured entities to dynamic details and reserves image dimensions', async () => {
    const data = loadFixtureData();
    renderHome(createJsonReadRepositories(runtime, data));
    const product = data.fixtures.products.find(
      (record) => record.id === data.fixtures.settings.collections.featured[0],
    )!;
    const links = await screen.findAllByRole('link', { name: new RegExp(product.name, 'i') });
    expect(links.some((link) => link.getAttribute('href') === `/product/${product.slug}`)).toBe(
      true,
    );
    for (const image of screen
      .getAllByRole('img')
      .filter((element) => element instanceof HTMLImageElement)) {
      expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
      expect(image.getAttribute('alt')?.trim().length).toBeGreaterThan(0);
    }
  });

  it('retains a useful homepage when banners and featured collections are empty', async () => {
    const data = loadFixtureData();
    data.fixtures.banners = [];
    data.fixtures.settings.collections.featured = [];
    renderHome(createJsonReadRepositories(runtime, data));
    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible();
    expect(screen.getByRole('heading', { name: /categor/i })).toBeVisible();
    expect(
      screen
        .getAllByRole('link')
        .some((link) => link.getAttribute('href')?.startsWith('/category/')),
    ).toBe(true);
  });

  it('shows an actionable failure and reloads real repository data on retry', async () => {
    const repositories = createJsonReadRepositories(runtime);
    const original = repositories.content.getBanners.bind(repositories.content);
    const banners = vi
      .fn()
      .mockRejectedValueOnce(
        new RepositoryError('unavailable', 'The catalogue could not be loaded.'),
      )
      .mockImplementation(original);
    repositories.content.getBanners = banners;
    renderHome(repositories);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The catalogue could not be loaded.',
    );
    await userEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible();
    expect(banners).toHaveBeenCalledTimes(2);
  });
});
