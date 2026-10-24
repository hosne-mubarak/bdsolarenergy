import { describe, expect, it } from 'vitest';
import { loadFixtureData } from '../services/json/fixtures';
import { createJsonReadRepositories } from '../services/json/read-repositories';

describe('account navigation configuration', () => {
  it('contains unique valid destinations and is exposed through the content contract', async () => {
    const data = loadFixtureData();
    const links = data.accountNavigation;
    expect(new Set(links.map((link) => link.id)).size).toBe(links.length);
    expect(new Set(links.map((link) => link.path))).toEqual(
      new Set([
        '/account',
        '/account/profile',
        '/account/addresses',
        '/account/orders',
        '/account/wishlist',
        '/account/settings',
        '/account/password',
        '/logout',
      ]),
    );
    const { content } = createJsonReadRepositories(
      { now: () => new Date('2026-10-24T00:00:00Z'), id: () => 'id' },
      data,
    );
    const first = await content.getAccountNavigation();
    first[0].label = 'Changed by caller';
    expect((await content.getAccountNavigation())[0].label).toBe('Overview');
  });
});
