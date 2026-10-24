import { describe, expect, it } from 'vitest';
import { productQuerySchema } from '../../src/schemas';
import type { CatalogueRepository, ContentRepository, Runtime } from '../../src/services/contracts';
import { createJsonReadRepositories } from '../../src/services/json/read-repositories';

const runtime: Runtime = {
  now: () => new Date('2026-10-24T00:00:00Z'),
  id: (prefix = 'test') => `${prefix}-1`,
};
const makeRepositories = (): { catalogue: CatalogueRepository; content: ContentRepository } =>
  createJsonReadRepositories(runtime);

describe('JSON read repository contract', () => {
  it('returns a typed catalogue page and stable pagination over all 48 products', async () => {
    const { catalogue } = makeRepositories();
    const first = await catalogue.listProducts(productQuerySchema.parse({ page: 1 }));
    const second = await catalogue.listProducts(productQuerySchema.parse({ page: 2 }));
    expect(first).toMatchObject({ total: 48, page: 1, pageSize: 12 });
    expect(first.items).toHaveLength(12);
    expect(second.items).toHaveLength(12);
    expect(new Set([...first.items, ...second.items].map((product) => product.id)).size).toBe(24);
    const beyond = await catalogue.listProducts(productQuerySchema.parse({ page: 99 }));
    expect(beyond.items).toHaveLength(12);
    expect(beyond.page).toBe(4);
    expect(beyond.total).toBe(48);
  });

  it('returns product details, variant ownership and derived review summaries', async () => {
    const { catalogue } = makeRepositories();
    const first = (await catalogue.listProducts(productQuerySchema.parse({}))).items[0];
    const product = await catalogue.getProduct(first.slug);
    expect((await catalogue.getProductById(first.id)).id).toBe(product.id);
    const selected = await catalogue.getVariant(product.variants[0].id);
    expect(selected.variant.productId).toBe(product.id);
    expect(selected.product.id).toBe(product.id);
    const reviews = await catalogue.getReviews(product.id);
    expect(product.reviewCount).toBe(reviews.length);
    expect(product.rating).toBe(
      reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0,
    );
    expect(product.rating).toBeGreaterThanOrEqual(0);
    expect(product.rating).toBeLessThanOrEqual(5);
    expect(reviews.every((review) => review.productId === product.id)).toBe(true);
  });

  it('exposes category, brand and image entities through contracts', async () => {
    const { catalogue } = makeRepositories();
    expect((await catalogue.listCategories()).length).toBeGreaterThanOrEqual(8);
    expect((await catalogue.listBrands()).length).toBeGreaterThanOrEqual(4);
    const images = await catalogue.listImages();
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((image) => image.src.startsWith('/images/') && image.alt.length > 0)).toBe(
      true,
    );
  });

  it('returns an empty review collection and zero rating for an unreviewed product', async () => {
    const { catalogue } = makeRepositories();
    const products = await catalogue.listProducts(productQuerySchema.parse({ pageSize: 100 }));
    const unreviewed = products.items.find((product) => product.reviewCount === 0);
    expect(unreviewed).toBeDefined();
    expect(unreviewed!.rating).toBe(0);
    expect(await catalogue.getReviews(unreviewed!.id)).toEqual([]);
  });

  it('exposes content/settings/checkout configuration without UI fixture access', async () => {
    const { content } = makeRepositories();
    expect((await content.getSiteSettings()).currency).toBe('BDT');
    expect((await content.getNavigation()).length).toBeGreaterThan(0);
    expect((await content.getPage('about')).slug).toBe('about');
    expect((await content.getPage('faq')).faqs.length).toBeGreaterThan(0);
    const checkout = await content.getCheckoutConfiguration();
    expect(checkout.shipping.length).toBeGreaterThanOrEqual(2);
    expect(checkout.payments.every((payment) => payment.demoOnly)).toBe(true);
    expect(checkout.coupons).toEqual(await content.getCoupons());
    expect(await content.getDefaultPreferences()).toMatchObject({
      compactCards: expect.any(Boolean),
      orderUpdates: expect.any(Boolean),
    });
    const now = runtime.now().getTime();
    const banners = await content.getBanners();
    expect(banners.length).toBeGreaterThan(0);
    expect(
      banners.every(
        (banner) =>
          (!banner.startsAt || Date.parse(banner.startsAt) <= now) &&
          (!banner.endsAt || Date.parse(banner.endsAt) >= now),
      ),
    ).toBe(true);
  });

  it('normalizes missing product, SKU and content identifiers', async () => {
    const { catalogue, content } = makeRepositories();
    for (const operation of [
      () => catalogue.getProduct('missing'),
      () => catalogue.getProductById('missing'),
      () => catalogue.getVariant('missing'),
      () => content.getPage('missing'),
    ]) {
      await expect(operation()).rejects.toMatchObject({ code: 'not_found' });
    }
  });

  it('honors cancellation both before a read and while its microtask is pending', async () => {
    const { catalogue, content } = makeRepositories();
    const before = new AbortController();
    before.abort();
    await expect(
      catalogue.listProducts(productQuerySchema.parse({}), { signal: before.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    const during = new AbortController();
    const read = content.getSiteSettings({ signal: during.signal });
    during.abort();
    await expect(read).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('isolates returned records and nested variant objects from later reads', async () => {
    const { catalogue, content } = makeRepositories();
    const first = (await catalogue.listProducts(productQuerySchema.parse({}))).items[0];
    const originalName = first.name;
    const originalPrice = first.variants[0].price;
    first.name = 'Caller mutation';
    first.variants[0].price = 0;
    const refreshed = await catalogue.getProduct(first.slug);
    expect(refreshed.name).toBe(originalName);
    expect(refreshed.variants[0].price).toBe(originalPrice);
    const settings = await content.getSiteSettings();
    const originalCollection = [...settings.collections.featured];
    settings.collections.featured.length = 0;
    expect((await content.getSiteSettings()).collections.featured).toEqual(originalCollection);
  });
});
